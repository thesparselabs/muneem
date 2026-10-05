// Package admin is Muneem's operator tooling (Stage 9i, ADR-0057): cross-shop reads, a few audited actions, and the
// server-rendered admin page. Shop users never reach it; operators never reach shop routes.
package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

const (
	adminRole    = "muneem_admin"
	silentHours  = 24
	previewChars = "2048"
	deviceCap    = 200
)

var errResolved = errors.New("dead letter already resolved")

// Directory reads across shops as muneem_admin (migration 0009). Every transaction drops to that role, so its own
// SELECT policies decide what it sees, and the only writes it can make are dead-letter resolutions and admin.* audit rows.
type Directory struct{ DB *store.DB }

func (d *Directory) withTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := d.DB.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx, "SET LOCAL ROLE "+adminRole); err != nil {
		return fmt.Errorf("set role %s: %w", adminRole, err)
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Page is a bounded slice of a newest-first or id-ordered list; Cursor is the last key of the previous page.
type Page struct {
	Limit  int
	Cursor string
}

const (
	defaultLimit = 50
	maxLimit     = 100
)

func PageOf(limit *int, cursor *string) (Page, error) {
	p := Page{Limit: defaultLimit}
	if limit != nil {
		if *limit < 1 || *limit > maxLimit {
			return p, fmt.Errorf("limit must be 1 to %d", maxLimit)
		}
		p.Limit = *limit
	}
	if cursor != nil {
		if len(*cursor) > 64 {
			return p, errors.New("cursor is malformed")
		}
		p.Cursor = *cursor
	}
	return p, nil
}

// trim cuts the extra row a query fetched to learn whether another page follows.
func trim[T any](rows []T, p Page, key func(T) string) ([]T, *string) {
	if len(rows) <= p.Limit {
		return rows, nil
	}
	rows = rows[:p.Limit]
	next := key(rows[len(rows)-1])
	return rows, &next
}

// A dead letter is open until an operator resolves it or the device's same operation applies (a later push or a resend).
const appliedSince = `EXISTS (SELECT 1 FROM sync_operation s WHERE s.business_id = dl.business_id
	AND s.device_id = dl.device_id AND s.operation_id = dl.operation_id AND s.status = 'applied')`

const openDeadLetter = `dl.resolved_at IS NULL AND NOT ` + appliedSince

const shopSQL = `SELECT b.id, b.name, o.id, o.name, b.created_at, d.active, d.total, d.silent, d.last_seen, d.depth,
	(SELECT count(DISTINCT dl.device_id || ':' || dl.operation_id) FROM dead_letter dl WHERE dl.business_id = b.id AND ` + openDeadLetter + `),
	(SELECT count(*) FROM conflict_log c WHERE c.business_id = b.id AND c.kind <> 'audit_chain_broken'),
	(SELECT count(*) FROM conflict_log c WHERE c.business_id = b.id AND c.kind = 'audit_chain_broken'),
	(SELECT max(k.confirmed_at) FROM backup k WHERE k.business_id = b.id AND k.status = 'ready')
	FROM business b JOIN organization o ON o.id = b.organization_id
	CROSS JOIN LATERAL (SELECT count(*) FILTER (WHERE dv.status = 'active') AS active, count(*) AS total,
		count(*) FILTER (WHERE dv.status = 'active' AND (dv.last_seen_at IS NULL OR dv.last_seen_at < now() - make_interval(hours => $1))) AS silent,
		max(dv.last_seen_at) AS last_seen, max(dv.outbox_depth) FILTER (WHERE dv.status = 'active') AS depth
		FROM device dv WHERE dv.business_id = b.id) d`

func scanShop(r pgx.CollectableRow) (adminapi.ShopSummary, error) {
	var s adminapi.ShopSummary
	err := r.Scan(&s.BusinessId, &s.BusinessName, &s.OrganizationId, &s.OrganizationName, &s.CreatedAt, &s.DevicesActive, &s.DevicesTotal,
		&s.DevicesSilent, &s.LastSeenAt, &s.OutboxDepthMax, &s.DeadLettersOpen, &s.ReviewItems, &s.AuditChainBreaks, &s.LatestBackupAt)
	return s, err
}

func (d *Directory) Shops(ctx context.Context, p Page) (adminapi.ShopPage, error) {
	var out adminapi.ShopPage
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, shopSQL+` WHERE b.id > $2 ORDER BY b.id LIMIT $3`, silentHours, p.Cursor, p.Limit+1)
		if err != nil {
			return err
		}
		items, err := pgx.CollectRows(rows, scanShop)
		out.Items, out.NextCursor = trim(items, p, func(s adminapi.ShopSummary) string { return s.BusinessId })
		return err
	})
	return out, err
}

func (d *Directory) Shop(ctx context.Context, businessID string) (adminapi.ShopDetail, error) {
	var out adminapi.ShopDetail
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, shopSQL+` WHERE b.id = $2`, silentHours, businessID)
		if err != nil {
			return err
		}
		shop, err := pgx.CollectExactlyOneRow(rows, scanShop)
		if errors.Is(err, pgx.ErrNoRows) {
			return store.ErrNotFound
		}
		if err != nil {
			return err
		}
		out.Shop = shop
		rows, err = tx.Query(ctx, deviceSQL+` WHERE business_id = $2 ORDER BY created_at, id LIMIT $3`, silentHours, businessID, deviceCap)
		if err != nil {
			return err
		}
		out.Devices, err = pgx.CollectRows(rows, scanDevice)
		return err
	})
	return out, err
}

const deviceSQL = `SELECT id, business_id, name, status, platform, app_version, schema_version, last_seen_at, last_push_seq, last_pull_seq,
	outbox_depth, clock_skew_ms, created_at, status = 'active' AND (last_seen_at IS NULL OR last_seen_at < now() - make_interval(hours => $1))
	FROM device`

func scanDevice(r pgx.CollectableRow) (adminapi.AdminDevice, error) {
	var v adminapi.AdminDevice
	err := r.Scan(&v.Id, &v.BusinessId, &v.Name, &v.Status, &v.Platform, &v.AppVersion, &v.SchemaVersion, &v.LastSeenAt, &v.LastPushSeq,
		&v.LastPullSeq, &v.OutboxDepth, &v.ClockSkewMs, &v.CreatedAt, &v.Silent)
	return v, err
}

func (d *Directory) Device(ctx context.Context, deviceID string) (adminapi.AdminDevice, error) {
	var out adminapi.AdminDevice
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, deviceSQL+` WHERE id = $2`, silentHours, deviceID)
		if err != nil {
			return err
		}
		out, err = pgx.CollectExactlyOneRow(rows, scanDevice)
		if errors.Is(err, pgx.ErrNoRows) {
			return store.ErrNotFound
		}
		return err
	})
	return out, err
}

const deadLetterSQL = `SELECT dl.id, dl.business_id, dl.device_id, dl.operation_id, dl.entity_type, dl.entity_id, dl.error_code, dl.error_detail,
	dl.created_at, left(coalesce(dl.operation->>'payload', ''), ` + previewChars + `), ` + appliedSince + `,
	dl.resolved_at, dl.resolved_by, dl.resolution, dl.resolution_note FROM dead_letter dl`

func scanDeadLetter(r pgx.CollectableRow) (adminapi.DeadLetter, error) {
	var v adminapi.DeadLetter
	err := r.Scan(&v.Id, &v.BusinessId, &v.DeviceId, &v.OperationId, &v.EntityType, &v.EntityId, &v.ErrorCode, &v.ErrorDetail, &v.CreatedAt,
		&v.PayloadPreview, &v.AppliedSince, &v.ResolvedAt, &v.ResolvedBy, &v.Resolution, &v.ResolutionNote)
	return v, err
}

func (d *Directory) DeadLetters(ctx context.Context, businessID string, openOnly bool, p Page) (adminapi.DeadLetterPage, error) {
	var out adminapi.DeadLetterPage
	before := int64(0)
	if p.Cursor != "" {
		n, err := strconv.ParseInt(p.Cursor, 10, 64)
		if err != nil || n <= 0 {
			return out, errBadCursor
		}
		before = n
	}
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, deadLetterSQL+` WHERE dl.business_id = $1 AND ($2 = 0 OR dl.id < $2) AND (NOT $3 OR (`+openDeadLetter+`))
			ORDER BY dl.id DESC LIMIT $4`, businessID, before, openOnly, p.Limit+1)
		if err != nil {
			return err
		}
		items, err := pgx.CollectRows(rows, scanDeadLetter)
		out.Items, out.NextCursor = trim(items, p, func(v adminapi.DeadLetter) string { return strconv.FormatInt(v.Id, 10) })
		return err
	})
	return out, err
}

var errBadCursor = errors.New("cursor is malformed")

// StoredLetter is a dead letter with its operation exactly as stored, and the account that registered its device.
type StoredLetter struct {
	Letter    adminapi.DeadLetter
	Operation json.RawMessage
	Owner     string
}

// DeadLetter is one dead letter with its whole operation; numbers stay exact (json.Number), as paise must.
func (d *Directory) DeadLetter(ctx context.Context, id int64) (StoredLetter, error) {
	var out StoredLetter
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		var err error
		out.Letter, err = d.deadLetter(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT dl.operation, dv.registered_by FROM dead_letter dl JOIN device dv ON dv.id = dl.device_id WHERE dl.id = $1`, id).
			Scan(&out.Operation, &out.Owner); err != nil {
			return err
		}
		dec := json.NewDecoder(bytes.NewReader(out.Operation))
		dec.UseNumber()
		var whole map[string]any
		if err := dec.Decode(&whole); err != nil {
			return err
		}
		out.Letter.Operation = &whole
		return nil
	})
	return out, err
}

func (d *Directory) deadLetter(ctx context.Context, tx pgx.Tx, id int64) (adminapi.DeadLetter, error) {
	rows, err := tx.Query(ctx, deadLetterSQL+` WHERE dl.id = $1`, id)
	if err != nil {
		return adminapi.DeadLetter{}, err
	}
	v, err := pgx.CollectExactlyOneRow(rows, scanDeadLetter)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, store.ErrNotFound
	}
	return v, err
}

// resolve closes every open dead letter of the letter's device operation, and audits it, in one transaction. A dismissal
// of a letter already closed is refused; a resend resolves whatever is still open.
func (d *Directory) resolve(ctx context.Context, id int64, resolution adminapi.DeadLetterResolution, a Actor, after any) (adminapi.DeadLetter, error) {
	var out adminapi.DeadLetter
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		cur, err := d.deadLetter(ctx, tx, id)
		if err != nil {
			return err
		}
		if resolution == adminapi.Dismissed && cur.ResolvedAt != nil {
			return errResolved
		}
		if _, err := tx.Exec(ctx, `UPDATE dead_letter SET resolved_at = now(), resolved_by = $4, resolution = $5, resolution_note = $6
			WHERE business_id = $1 AND device_id = $2 AND operation_id = $3 AND resolved_at IS NULL`,
			cur.BusinessId, cur.DeviceId, cur.OperationId, a.OperatorID, string(resolution), a.Reason); err != nil {
			return err
		}
		if err := a.audit(ctx, tx, &cur.BusinessId, &cur.DeviceId, "admin.dead_letter."+string(resolution), "dead_letter", strconv.FormatInt(id, 10), cur, after); err != nil {
			return err
		}
		out, err = d.deadLetter(ctx, tx, id)
		return err
	})
	return out, err
}

const reviewSQL = `SELECT id, kind, entity_type, entity_id, device_id, operation_id, detail, server_seq, created_at FROM conflict_log
	WHERE business_id = $1 AND (kind = 'audit_chain_broken') = $2 AND ($3 = '' OR id < $3) ORDER BY id DESC LIMIT $4`

// ReviewItems lists the conflict log newest first: chain breaks alone, or every other kind.
func (d *Directory) ReviewItems(ctx context.Context, businessID string, chainBreaks bool, p Page) (adminapi.ReviewItemPage, error) {
	var out adminapi.ReviewItemPage
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, reviewSQL, businessID, chainBreaks, p.Cursor, p.Limit+1)
		if err != nil {
			return err
		}
		items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (adminapi.ReviewItem, error) {
			var v adminapi.ReviewItem
			err := r.Scan(&v.Id, &v.Kind, &v.EntityType, &v.EntityId, &v.DeviceId, &v.OperationId, &v.Detail, &v.ServerSeq, &v.CreatedAt)
			return v, err
		})
		out.Items, out.NextCursor = trim(items, p, func(v adminapi.ReviewItem) string { return v.Id })
		return err
	})
	return out, err
}

func (d *Directory) Backups(ctx context.Context, businessID string, p Page) (adminapi.BackupPage, error) {
	var out adminapi.BackupPage
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, device_id, bytes, status, schema_version, key_id, created_at, confirmed_at FROM backup
			WHERE business_id = $1 AND ($2 = '' OR id < $2) ORDER BY id DESC LIMIT $3`, businessID, p.Cursor, p.Limit+1)
		if err != nil {
			return err
		}
		items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (adminapi.Backup, error) {
			var v adminapi.Backup
			err := r.Scan(&v.Id, &v.DeviceId, &v.Bytes, &v.Status, &v.SchemaVersion, &v.KeyId, &v.CreatedAt, &v.ConfirmedAt)
			return v, err
		})
		out.Items, out.NextCursor = trim(items, p, func(v adminapi.Backup) string { return v.Id })
		return err
	})
	return out, err
}

type account struct {
	UserID       string
	PasswordHash string
	Active       bool
	Operator     bool
}

func (d *Directory) account(ctx context.Context, identifier string) (*account, error) {
	var a account
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT u.id, u.password_hash, u.is_active,
			EXISTS (SELECT 1 FROM operator_grant g WHERE g.user_id = u.id AND g.revoked_at IS NULL) FROM app_user u WHERE u.identifier = $1`,
			identifier).Scan(&a.UserID, &a.PasswordHash, &a.Active, &a.Operator)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, store.ErrNotFound
	}
	return &a, err
}

func (d *Directory) isOperator(ctx context.Context, userID string) (bool, error) {
	var ok bool
	err := d.withTx(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM operator_grant g JOIN app_user u ON u.id = g.user_id
			WHERE g.user_id = $1 AND g.revoked_at IS NULL AND u.is_active)`, userID).Scan(&ok)
	})
	return ok, err
}

// Audit writes one admin.* row on its own; actions audit inside their own transaction instead.
func (d *Directory) Audit(ctx context.Context, a Actor, businessID *string, action, entityType, entityID string, after any) error {
	return d.withTx(ctx, func(tx pgx.Tx) error {
		return a.audit(ctx, tx, businessID, nil, action, entityType, entityID, nil, after)
	})
}

// Actor is who acts, why, and under which request: the who/what/why of every admin audit row.
type Actor struct {
	OperatorID string
	Reason     string
	RequestID  string
}

func (a Actor) audit(ctx context.Context, tx pgx.Tx, businessID, deviceID *string, action, entityType, entityID string, before, after any) error {
	var who *string
	if a.OperatorID != "" {
		who = &a.OperatorID
	}
	body := map[string]any{"at": time.Now().UTC()}
	if a.Reason != "" {
		body["reason"] = a.Reason
	}
	if after != nil {
		body["result"] = after
	}
	return store.Audit(ctx, tx, businessID, who, deviceID, action, entityType, &entityID, before, body, a.RequestID)
}
