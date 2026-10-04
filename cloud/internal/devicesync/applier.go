package devicesync

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/conflict"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
)

var stateCodeRe = regexp.MustCompile(`^\d{2}$`)

// applier runs one operation inside its transaction: idempotency, business, dependencies, verification, then storage.
type applier struct {
	ctx        context.Context
	tx         pgx.Tx
	caller     Caller
	businessID string
	op         Operation
	journals   []*verify.Journal
	reviews    []conflictRow
}

type step func() (Result, bool, error)

func (a *applier) run() (Result, error) {
	if err := lockBusiness(a.ctx, a.tx, a.businessID); err != nil {
		return Result{}, err
	}
	for _, s := range []step{a.idempotent, a.knownEntity, a.business, a.auditEntry, a.dependencies, a.verified} {
		if r, done, err := s(); done || err != nil {
			return r, err
		}
	}
	return a.store()
}

func (a *applier) idempotent() (Result, bool, error) {
	prior, err := getOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op.OperationID)
	if err != nil || prior == nil || prior.Status != StatusApplied {
		return Result{}, false, err
	}
	if prior.PayloadHash != a.op.PayloadHash {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: "operation id reused with a different payload"}
	}
	return duplicate(a.op, prior.ServerSeq), true, nil
}

func (a *applier) knownEntity() (Result, bool, error) {
	if _, ok := streamOf[a.op.EntityType]; !ok {
		return deferred(a.op, CodeUnknownEntity, "this server does not know entity type "+a.op.EntityType), true, nil
	}
	if len(a.op.Payload) == 0 || a.op.Payload[0] != '{' {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: "payload must be an object"}
	}
	return Result{}, false, nil
}

func (a *applier) business() (Result, bool, error) {
	if a.op.EntityType == "business" && a.op.EntityID != a.businessID {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: "a business operation must be for the pushed business"}
	}
	exists, err := businessExists(a.ctx, a.tx, a.businessID)
	if err != nil || exists {
		return Result{}, false, err
	}
	if a.op.EntityType != "business" || a.op.OperationType != "create" {
		return deferred(a.op, CodeBusinessUnknown, "the business has not reached the cloud yet"), true, nil
	}
	return Result{}, false, createOfflineBusiness(a.ctx, a.tx, a.caller.UserID, a.op)
}

func (a *applier) dependencies() (Result, bool, error) {
	if a.op.DependsOn != nil {
		ok, err := operationApplied(a.ctx, a.tx, a.businessID, *a.op.DependsOn)
		if err != nil || !ok {
			return deferred(a.op, CodeDependencyMissing, "waiting for operation "+*a.op.DependsOn), err == nil, err
		}
	}
	refs, err := references(a.op)
	if err != nil {
		return Result{}, true, &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	for _, r := range refs {
		ok, err := entityLive(a.ctx, a.tx, a.businessID, r.entityType, r.entityID)
		if err != nil || !ok {
			return deferred(a.op, CodeDependencyMissing, fmt.Sprintf("waiting for %s %s", r.entityType, r.entityID)), err == nil, err
		}
	}
	return Result{}, false, nil
}

type txLookup struct {
	a   *applier
	err error
}

func (l *txLookup) JournalDebit(id string) (int64, bool) {
	d, ok, err := journalDebit(l.a.ctx, l.a.tx, l.a.businessID, id)
	if err != nil {
		l.err = err
	}
	return d, ok
}

func (a *applier) verified() (Result, bool, error) {
	if streamOf[a.op.EntityType] == StreamDocuments {
		js, err := verify.Journals(a.op.EntityType, a.op.Payload)
		if err == nil {
			err = verify.Balanced(js)
		}
		if err != nil {
			return Result{}, true, err
		}
		a.journals = js
	}
	lk := &txLookup{a: a}
	err := verify.Operation(a.op.EntityType, a.op.OperationType, a.op.Payload, lk)
	if lk.err != nil {
		return Result{}, true, lk.err
	}
	return Result{}, err != nil, err
}

func (a *applier) store() (Result, error) {
	cur, err := getEntity(a.ctx, a.tx, a.businessID, a.op.EntityType, a.op.EntityID)
	if err != nil {
		return Result{}, err
	}
	var s *stored
	if streamOf[a.op.EntityType] == StreamDocuments {
		s, err = a.document(cur)
	} else {
		s, err = a.resolved(cur)
	}
	if err != nil {
		return Result{}, err
	}
	if s == nil {
		return a.unchanged(cur)
	}
	seq, err := a.persist(*s)
	if err != nil {
		return Result{}, err
	}
	if err := a.project(seq); err != nil {
		return Result{}, err
	}
	if err := a.recordReviews(seq); err != nil {
		return Result{}, err
	}
	return applied(a.op, seq), recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, &seq, nil)
}

// unchanged acknowledges a write that changes nothing (a repeated cancel, a delete of a deleted row).
func (a *applier) unchanged(cur *entityRow) (Result, error) {
	seq := cur.LastSeq
	return applied(a.op, seq), recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, &seq, nil)
}

func (a *applier) persist(s stored) (int64, error) { return persist(a.ctx, a.tx, a.businessID, s) }

func persist(ctx context.Context, tx pgx.Tx, businessID string, s stored) (int64, error) {
	seq, err := appendChange(ctx, tx, businessID, s)
	if err != nil {
		return 0, err
	}
	return seq, upsertEntity(ctx, tx, businessID, s, seq)
}

func (a *applier) project(seq int64) error {
	for _, j := range a.journals {
		if err := projectJournal(a.ctx, a.tx, a.businessID, a.caller.DeviceID, seq, j); err != nil {
			return err
		}
	}
	return nil
}

func (a *applier) origin() *string { id := a.caller.DeviceID; return &id }

func (a *applier) stored(version int, payload json.RawMessage, del bool, origin *string) *stored {
	return &stored{EntityType: a.op.EntityType, EntityID: a.op.EntityID, Stream: streamOf[a.op.EntityType], Version: version, Payload: payload,
		Delete: del, Origin: origin, Writer: a.caller.DeviceID}
}

func (a *applier) review(kind string, detail any) {
	a.reviews = append(a.reviews, conflictRow{ID: ulid.Make().String(), Kind: kind, EntityType: a.op.EntityType, EntityID: a.op.EntityID,
		DeviceID: a.caller.DeviceID, OperationID: a.op.OperationID, Detail: detail})
}

// Every review item is kept in conflict_log and sent down the control stream, so each device lists it (ADR-0041).
func (a *applier) recordReviews(seq int64) error {
	for _, r := range a.reviews {
		if err := recordReview(a.ctx, a.tx, a.businessID, r, seq); err != nil {
			return err
		}
	}
	return nil
}

func recordReview(ctx context.Context, tx pgx.Tx, businessID string, r conflictRow, seq int64) error {
	if err := insertConflict(ctx, tx, businessID, r, seq); err != nil {
		return err
	}
	item, err := json.Marshal(map[string]any{"id": r.ID, "kind": r.Kind, "entityType": r.EntityType, "entityId": r.EntityID,
		"deviceId": r.DeviceID, "operationId": r.OperationID, "serverSeq": seq, "detail": r.Detail})
	if err != nil {
		return err
	}
	_, err = persist(ctx, tx, businessID, stored{EntityType: ControlReviewItem, EntityID: r.ID, Stream: StreamControl, Version: 1, Payload: item,
		Writer: r.DeviceID})
	return err
}

func (a *applier) document(cur *entityRow) (*stored, error) {
	if cur == nil {
		if a.op.OperationType != "create" {
			return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: "an update of a document the cloud does not hold"}
		}
		return a.stored(1, a.op.Payload, false, a.origin()), a.lateArrivals()
	}
	if a.op.OperationType == "create" {
		return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: "document " + a.op.EntityID + " already exists"}
	}
	if a.op.OperationType == "cancel" && cancelled(cur.Payload) {
		return nil, nil
	}
	next, err := laterVersion(cur.Payload, a.op.OperationType, a.op.Payload)
	if err != nil {
		return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	return a.stored(cur.Version+1, next, false, a.origin()), a.lateArrivals()
}

// A document's later version keeps the whole document and carries the operation under its type (ADR-0040 as built).
func laterVersion(current json.RawMessage, operationType string, op json.RawMessage) (json.RawMessage, error) {
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(current, &doc); err != nil {
		return nil, err
	}
	doc[operationType] = op
	return json.Marshal(doc)
}

func cancelled(payload json.RawMessage) bool {
	var p struct {
		Status string `json:"status"`
		Cancel *struct {
			Status string `json:"status"`
		} `json:"cancel"`
	}
	return json.Unmarshal(payload, &p) == nil && (p.Status == "cancelled" || (p.Cancel != nil && p.Cancel.Status == "cancelled"))
}

// A journal dated in a month the business has locked is stored as sent and listed for review (ADR-0040).
func (a *applier) lateArrivals() error {
	for _, j := range a.journals {
		periodID, locked, err := periodLocked(a.ctx, a.tx, a.businessID, j.EntryDate)
		if err != nil {
			return err
		}
		if locked {
			a.review("late_arrival", map[string]any{"journalId": j.ID, "entryNo": j.EntryNo, "entryDate": j.EntryDate, "lockedPeriodId": periodID})
		}
	}
	return nil
}

func (a *applier) resolved(cur *entityRow) (*stored, error) {
	in, err := conflict.Decode(a.op.Payload)
	if err != nil {
		return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	current, baseline, err := a.current(cur, in)
	if err != nil {
		return nil, err
	}
	out := conflict.Resolve(current, conflict.Incoming{EntityType: a.op.EntityType, Tombstone: a.tombstone(in), Payload: in,
		Device: a.caller.DeviceID, Baseline: baseline})
	if out.Ignored {
		return a.tombstoneWon(cur, out, in)
	}
	if len(out.Fields) > 0 {
		a.review("field_conflict", map[string]any{"fields": out.Fields, "sent": in, "stored": out.Payload})
	}
	if err := a.duplicateBarcode(in, out.Delete); err != nil {
		return nil, err
	}
	if !conflict.Differs(out.Payload, in) {
		return a.stored(out.Version, a.op.Payload, out.Delete, a.origin()), nil
	}
	merged, err := json.Marshal(out.Payload)
	return a.stored(out.Version, merged, out.Delete, nil), err
}

func (a *applier) current(cur *entityRow, in conflict.Payload) (*conflict.Current, conflict.Payload, error) {
	if cur == nil {
		return nil, nil, nil
	}
	payload, err := conflict.Decode(cur.Payload)
	if err != nil {
		return nil, nil, err
	}
	current := &conflict.Current{Version: cur.Version, Payload: payload, Deleted: cur.Deleted, Writer: cur.Writer}
	sent, ok := in["version"].(float64)
	if !ok || int(sent)-1 >= cur.Version {
		return current, nil, nil
	}
	raw, err := baselinePayload(a.ctx, a.tx, a.businessID, a.op.EntityType, a.op.EntityID, int(sent)-1)
	if err != nil || raw == nil {
		return current, conflict.Payload{}, err
	}
	baseline, err := conflict.Decode(raw)
	return current, baseline, err
}

func (a *applier) tombstone(in conflict.Payload) bool {
	if a.op.OperationType == "void" {
		return true
	}
	for _, k := range []string{"deletedAt", "deleted_at"} {
		if v, ok := in[k]; ok && v != nil {
			return true
		}
	}
	return false
}

// tombstoneWon re-sends the delete with no origin, so the device that edited a deleted row drops its edit too.
func (a *applier) tombstoneWon(cur *entityRow, out conflict.Outcome, in conflict.Payload) (*stored, error) {
	if !out.Tombstone {
		return nil, nil
	}
	a.review("tombstone_wins", map[string]any{"rule": conflict.RuleTombstoneWins, "sent": in, "stored": out.Payload})
	return a.stored(cur.Version+1, cur.Payload, true, nil), nil
}

// The same barcode on two products keeps both rows and adds a duplicate-candidate review item (ADR-0041).
func (a *applier) duplicateBarcode(in conflict.Payload, deleting bool) error {
	if a.op.EntityType != "barcode" || deleting {
		return nil
	}
	code, _ := in["code"].(string)
	product, _ := in["productId"].(string)
	if code == "" {
		return nil
	}
	others, err := barcodesWithCode(a.ctx, a.tx, a.businessID, code, product)
	if err != nil || len(others) == 0 {
		return err
	}
	a.review("duplicate_barcode", map[string]any{"code": code, "productId": product, "otherBarcodeIds": others})
	return nil
}
