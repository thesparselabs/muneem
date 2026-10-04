package devicesync

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
)

// lockBusiness serializes sync writes per business until commit, so change_log seqs commit in order and a puller
// paging by seq never steps past one that is still in flight.
func lockBusiness(ctx context.Context, tx pgx.Tx, businessID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('muneem.sync:' || $1, 0))`, businessID)
	return err
}

type opRecord struct {
	PayloadHash string
	Status      string
	ServerSeq   *int64
}

func getOperation(ctx context.Context, tx pgx.Tx, businessID, deviceID, operationID string) (*opRecord, error) {
	r := &opRecord{}
	err := tx.QueryRow(ctx, `SELECT payload_hash, status, server_seq FROM sync_operation WHERE business_id = $1 AND device_id = $2 AND operation_id = $3`,
		businessID, deviceID, operationID).Scan(&r.PayloadHash, &r.Status, &r.ServerSeq)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return r, err
}

// operationApplied is true when any device's operation with this id has applied (dependencies cross devices after a pull).
func operationApplied(ctx context.Context, tx pgx.Tx, businessID, operationID string) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM sync_operation WHERE business_id = $1 AND operation_id = $2 AND status = 'applied')`,
		businessID, operationID).Scan(&ok)
	return ok, err
}

func recordOperation(ctx context.Context, tx pgx.Tx, businessID, deviceID string, op Operation, status string, serverSeq *int64, errorCode *string) error {
	_, err := tx.Exec(ctx, `INSERT INTO sync_operation (business_id, device_id, operation_id, entity_type, entity_id, payload_hash, status, server_seq, error_code, device_seq)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (business_id, device_id, operation_id) DO UPDATE SET payload_hash = EXCLUDED.payload_hash, status = EXCLUDED.status,
		server_seq = EXCLUDED.server_seq, error_code = EXCLUDED.error_code, updated_at = now() WHERE sync_operation.status <> 'applied'`,
		businessID, deviceID, op.OperationID, op.EntityType, op.EntityID, op.PayloadHash, status, serverSeq, errorCode, op.Seq)
	return err
}

type entityRow struct {
	Version int
	Payload json.RawMessage
	Writer  string
	LastSeq int64
	Deleted bool
}

func getEntity(ctx context.Context, tx pgx.Tx, businessID, entityType, entityID string) (*entityRow, error) {
	e := &entityRow{}
	err := tx.QueryRow(ctx, `SELECT version, payload, writer_device_id, last_seq, deleted_at IS NOT NULL FROM entity_state
		WHERE business_id = $1 AND entity_type = $2 AND entity_id = $3 FOR UPDATE`, businessID, entityType, entityID).
		Scan(&e.Version, &e.Payload, &e.Writer, &e.LastSeq, &e.Deleted)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return e, err
}

func entityLive(ctx context.Context, tx pgx.Tx, businessID, entityType, entityID string) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM entity_state WHERE business_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL)`,
		businessID, entityType, entityID).Scan(&ok)
	return ok, err
}

// baselinePayload is the newest stored payload at or below a version: the version a device's edit was based on.
func baselinePayload(ctx context.Context, tx pgx.Tx, businessID, entityType, entityID string, version int) (json.RawMessage, error) {
	var p json.RawMessage
	err := tx.QueryRow(ctx, `SELECT payload FROM change_log WHERE business_id = $1 AND entity_type = $2 AND entity_id = $3 AND version <= $4
		ORDER BY version DESC, seq DESC LIMIT 1`, businessID, entityType, entityID, version).Scan(&p)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

type stored struct {
	EntityType string
	EntityID   string
	Stream     string
	Version    int
	Payload    json.RawMessage
	Delete     bool
	Origin     *string
	Writer     string
}

func (s stored) op() string {
	if s.Delete {
		return "delete"
	}
	return "upsert"
}

func appendChange(ctx context.Context, tx pgx.Tx, businessID string, s stored) (int64, error) {
	var seq int64
	err := tx.QueryRow(ctx, `INSERT INTO change_log (business_id, stream, entity_type, entity_id, op, version, payload, origin_device_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING seq`,
		businessID, s.Stream, s.EntityType, s.EntityID, s.op(), s.Version, s.Payload, s.Origin).Scan(&seq)
	return seq, err
}

func upsertEntity(ctx context.Context, tx pgx.Tx, businessID string, s stored, seq int64) error {
	var deletedAt *time.Time
	if s.Delete {
		now := time.Now().UTC()
		deletedAt = &now
	}
	_, err := tx.Exec(ctx, `INSERT INTO entity_state (business_id, entity_type, entity_id, version, payload, origin_device_id, writer_device_id, last_seq, deleted_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (business_id, entity_type, entity_id) DO UPDATE SET version = EXCLUDED.version, payload = EXCLUDED.payload,
		origin_device_id = EXCLUDED.origin_device_id, writer_device_id = EXCLUDED.writer_device_id, last_seq = EXCLUDED.last_seq,
		deleted_at = EXCLUDED.deleted_at, updated_at = now()`,
		businessID, s.EntityType, s.EntityID, s.Version, s.Payload, s.Origin, s.Writer, seq, deletedAt)
	return err
}

func projectJournal(ctx context.Context, tx pgx.Tx, businessID, deviceID string, seq int64, j *verify.Journal) error {
	ct, err := tx.Exec(ctx, `INSERT INTO journal_entry (id, business_id, entry_no, entry_date, doc_date, period_id, source, ref_type, ref_id, narration,
		branch_id, terminal_id, late_posting, reversal_of, origin_device_id, server_seq)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`,
		j.ID, businessID, j.EntryNo, j.EntryDate, j.DocDate, j.PeriodID, j.Source, j.RefType, j.RefID, j.Narration, j.BranchID, j.TerminalID,
		j.LatePosting, j.ReversalOf, deviceID, seq)
	if err != nil || ct.RowsAffected() == 0 {
		return err
	}
	for i, l := range j.Lines {
		var partyType, partyID *string
		if l.Party != nil {
			partyType, partyID = &l.Party.PartyType, &l.Party.PartyID
		}
		if _, err := tx.Exec(ctx, `INSERT INTO journal_line (journal_id, line_no, business_id, account_role, account_code, debit_paise, credit_paise, party_type, party_id)
			VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6,$7,$8,$9)`,
			j.ID, i+1, businessID, l.Account.Role, l.Account.Code, l.DebitPaise, l.CreditPaise, partyType, partyID); err != nil {
			return err
		}
	}
	return nil
}

func journalDebit(ctx context.Context, tx pgx.Tx, businessID, journalID string) (int64, bool, error) {
	var debit *int64
	err := tx.QueryRow(ctx, `SELECT SUM(l.debit_paise) FROM journal_entry e JOIN journal_line l ON l.journal_id = e.id WHERE e.business_id = $1 AND e.id = $2`,
		businessID, journalID).Scan(&debit)
	if err != nil || debit == nil {
		return 0, false, err
	}
	return *debit, true, nil
}

// periodLocked reads the business's lock for the month holding a date: the latest pushed period row covering it.
func periodLocked(ctx context.Context, tx pgx.Tx, businessID, date string) (string, bool, error) {
	var id, status string
	err := tx.QueryRow(ctx, `SELECT entity_id, payload->>'status' FROM entity_state
		WHERE business_id = $1 AND entity_type = 'accounting_period' AND payload->>'periodStart' <= $2 AND payload->>'periodEnd' >= $2
		ORDER BY updated_at DESC, last_seq DESC LIMIT 1`, businessID, date).Scan(&id, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return id, status == "locked", err
}

func barcodesWithCode(ctx context.Context, tx pgx.Tx, businessID, code, exceptProduct string) ([]string, error) {
	rows, err := tx.Query(ctx, `SELECT entity_id FROM entity_state WHERE business_id = $1 AND entity_type = 'barcode' AND deleted_at IS NULL
		AND payload->>'code' = $2 AND payload->>'productId' <> $3 ORDER BY entity_id`, businessID, code, exceptProduct)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

type conflictRow struct {
	ID          string
	Kind        string
	EntityType  string
	EntityID    string
	DeviceID    string
	OperationID string
	Detail      any
}

func insertConflict(ctx context.Context, tx pgx.Tx, businessID string, c conflictRow, seq int64) error {
	detail, err := json.Marshal(c.Detail)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO conflict_log (id, business_id, kind, entity_type, entity_id, device_id, operation_id, detail, server_seq)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, c.ID, businessID, c.Kind, c.EntityType, c.EntityID, c.DeviceID, c.OperationID, detail, seq)
	return err
}

func insertDeadLetter(ctx context.Context, tx pgx.Tx, businessID, deviceID string, op Operation, code, detail string) error {
	raw, err := json.Marshal(op)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dead_letter (business_id, device_id, operation_id, entity_type, entity_id, operation, error_code, error_detail)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, businessID, deviceID, op.OperationID, op.EntityType, op.EntityID, raw, code, detail)
	return err
}

func lastSeq(ctx context.Context, tx pgx.Tx, businessID string) (int64, error) {
	var seq int64
	err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM change_log WHERE business_id = $1`, businessID).Scan(&seq)
	return seq, err
}

func readChanges(ctx context.Context, tx pgx.Tx, businessID, stream string, since int64, limit int) ([]Change, error) {
	rows, err := tx.Query(ctx, `SELECT seq, stream, entity_type, entity_id, op, version, origin_device_id, payload FROM change_log
		WHERE business_id = $1 AND stream = $2 AND seq > $3 ORDER BY seq LIMIT $4`, businessID, stream, since, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Change, error) {
		var c Change
		err := r.Scan(&c.Seq, &c.Stream, &c.EntityType, &c.EntityID, &c.Op, &c.Version, &c.OriginDeviceID, &c.Payload)
		return c, err
	})
}

func notePush(ctx context.Context, tx pgx.Tx, deviceID, businessID string, lastPushSeq *int64, skewMs *int) error {
	_, err := tx.Exec(ctx, `UPDATE device SET last_seen_at = now(), updated_at = now(), business_id = COALESCE(business_id, $2),
		last_push_seq = GREATEST(COALESCE(last_push_seq, 0), COALESCE($3, 0)), clock_skew_ms = COALESCE($4, clock_skew_ms) WHERE id = $1`,
		deviceID, businessID, lastPushSeq, skewMs)
	return err
}

func noteHeartbeat(ctx context.Context, tx pgx.Tx, deviceID string, hb Heartbeat) error {
	_, err := tx.Exec(ctx, `UPDATE device SET outbox_depth = $2, oldest_pending_at = $3, negative_stock_count = $4, heartbeat_at = now() WHERE id = $1`,
		deviceID, clampCount(hb.OutboxDepth), hb.OldestPendingAt, clampCount(hb.NegativeStockCount))
	return err
}

// noteIntegrity keeps the newest report per device; an older one arriving late never replaces it.
func noteIntegrity(ctx context.Context, tx pgx.Tx, businessID, deviceID string, r Integrity) error {
	_, err := tx.Exec(ctx, `INSERT INTO device_integrity (device_id, business_id, checked_at, tie_out_failures, replay_mismatches, audit_chain_ok,
		journal_count, journal_debit_paise, journal_credit_paise, documents_seq, outbox_depth)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (device_id) DO UPDATE SET business_id = EXCLUDED.business_id, checked_at = EXCLUDED.checked_at,
		tie_out_failures = EXCLUDED.tie_out_failures, replay_mismatches = EXCLUDED.replay_mismatches, audit_chain_ok = EXCLUDED.audit_chain_ok,
		journal_count = EXCLUDED.journal_count, journal_debit_paise = EXCLUDED.journal_debit_paise, journal_credit_paise = EXCLUDED.journal_credit_paise,
		documents_seq = EXCLUDED.documents_seq, outbox_depth = EXCLUDED.outbox_depth, received_at = now()
		WHERE device_integrity.checked_at < EXCLUDED.checked_at`,
		deviceID, businessID, r.CheckedAt, clampCount(r.TieOutFailures), clampCount(r.ReplayMismatches), r.AuditChainOk,
		max(r.JournalCount, 0), max(r.JournalDebitPaise, 0), max(r.JournalCreditPaise, 0), max(r.DocumentsSeq, 0), clampCount(r.OutboxDepth))
	return err
}

// clampCount keeps telemetry from ever failing a push on an INT column.
func clampCount(n int) int {
	return min(max(n, 0), math.MaxInt32)
}

func notePull(ctx context.Context, tx pgx.Tx, deviceID string, seq int64) error {
	_, err := tx.Exec(ctx, `UPDATE device SET last_seen_at = now(), updated_at = now(), last_pull_seq = GREATEST(COALESCE(last_pull_seq, 0), $2) WHERE id = $1`,
		deviceID, seq)
	return err
}

func deviceBusiness(ctx context.Context, tx pgx.Tx, deviceID string) (*string, error) {
	var b *string
	err := tx.QueryRow(ctx, `SELECT business_id FROM device WHERE id = $1`, deviceID).Scan(&b)
	return b, err
}
