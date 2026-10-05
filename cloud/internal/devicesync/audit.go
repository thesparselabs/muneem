package devicesync

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/auditchain"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
)

// auditEntry keeps an audit row on its device's chain, after checking it links (ADR-0048). It never enters the change
// log, so no device pulls it.
func (a *applier) auditEntry() (Result, bool, error) {
	if a.op.EntityType != auditchain.EntityType {
		return Result{}, false, nil
	}
	e, err := auditchain.Decode(a.op.Payload)
	if err == nil && (e.BusinessID != a.businessID || e.ID != a.op.EntityID) {
		err = errors.New("not an audit row of this business")
	}
	if err != nil {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	tip, err := auditTip(a.ctx, a.tx, a.businessID, e.DeviceID, e.Seq)
	if err != nil {
		return Result{}, true, err
	}
	verdict, detail, err := auditchain.Check(e, tip)
	if err != nil {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	switch verdict {
	case auditchain.Broken:
		return Result{}, true, &verify.Failure{Code: CodeAuditChainBroken, Detail: detail}
	case auditchain.Gap:
		return deferred(a.op, CodeDependencyMissing, detail), true, nil
	case auditchain.Duplicate:
		return duplicate(a.op, nil), true, recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, nil, nil)
	}
	if err := insertAuditEntry(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, e); err != nil {
		return Result{}, true, err
	}
	return Result{OperationID: a.op.OperationID, Status: StatusApplied}, true,
		recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, nil, nil)
}

func auditTip(ctx context.Context, tx pgx.Tx, businessID, deviceID string, seq int64) (auditchain.Tip, error) {
	var t auditchain.Tip
	err := tx.QueryRow(ctx, `SELECT (SELECT hash FROM audit_entry WHERE business_id = $1 AND device_id = $2 AND seq = $3),
		COALESCE(l.seq, 0), COALESCE(l.hash, '')
		FROM (SELECT 1) one LEFT JOIN LATERAL (SELECT seq, hash FROM audit_entry WHERE business_id = $1 AND device_id = $2 ORDER BY seq DESC LIMIT 1) l ON true`,
		businessID, deviceID, seq).Scan(&t.HeldHash, &t.LastSeq, &t.LastHash)
	return t, err
}

func insertAuditEntry(ctx context.Context, tx pgx.Tx, businessID, pushedBy string, op Operation, e *auditchain.Entry) error {
	_, err := tx.Exec(ctx, `INSERT INTO audit_entry (business_id, device_id, seq, prev_hash, hash, row, operation_id, pushed_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, businessID, e.DeviceID, e.Seq, e.PrevHash, e.Hash, op.Payload, op.OperationID, pushedBy)
	return err
}

// A refused audit row is listed for review on every device, once per operation, beside its dead letter.
func recordChainBreak(ctx context.Context, tx pgx.Tx, businessID, deviceID string, op Operation, detail string) error {
	if err := lockBusiness(ctx, tx, businessID); err != nil {
		return err
	}
	var seen bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM conflict_log WHERE business_id = $1 AND kind = 'audit_chain_broken' AND operation_id = $2)`,
		businessID, op.OperationID).Scan(&seen); err != nil || seen {
		return err
	}
	at, err := lastSeq(ctx, tx, businessID)
	if err != nil {
		return err
	}
	chain := struct {
		DeviceID string `json:"device_id"`
		Seq      int64  `json:"seq"`
	}{}
	if e, err := auditchain.Decode(op.Payload); err == nil {
		chain.DeviceID, chain.Seq = e.DeviceID, e.Seq
	}
	return recordReview(ctx, tx, businessID, conflictRow{ID: ulid.Make().String(), Kind: "audit_chain_broken", EntityType: auditchain.EntityType,
		EntityID: op.EntityID, DeviceID: deviceID, OperationID: op.OperationID,
		Detail: map[string]any{"rule": "audit_chain", "chainDeviceId": chain.DeviceID, "seq": chain.Seq, "detail": detail}}, at)
}
