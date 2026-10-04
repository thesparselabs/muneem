package devicesync

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/jackc/pgx/v5"

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
}

type step func() (Result, bool, error)

func (a *applier) run() (Result, error) {
	if err := lockBusiness(a.ctx, a.tx, a.businessID); err != nil {
		return Result{}, err
	}
	for _, s := range []step{a.idempotent, a.knownEntity, a.business, a.dependencies, a.verified} {
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
	return applied(a.op, seq), recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, &seq, nil)
}

// unchanged acknowledges a write that changes nothing (a repeated cancel, a delete of a deleted row).
func (a *applier) unchanged(cur *entityRow) (Result, error) {
	seq := cur.LastSeq
	return applied(a.op, seq), recordOperation(a.ctx, a.tx, a.businessID, a.caller.DeviceID, a.op, StatusApplied, &seq, nil)
}

func (a *applier) persist(s stored) (int64, error) {
	seq, err := appendChange(a.ctx, a.tx, a.businessID, s)
	if err != nil {
		return 0, err
	}
	return seq, upsertEntity(a.ctx, a.tx, a.businessID, s, seq)
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

func (a *applier) document(cur *entityRow) (*stored, error) {
	if cur == nil {
		if a.op.OperationType != "create" {
			return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: "an update of a document the cloud does not hold"}
		}
		return a.stored(1, a.op.Payload, false, a.origin()), nil
	}
	if a.op.OperationType == "create" {
		return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: "document " + a.op.EntityID + " already exists"}
	}
	if a.op.OperationType == "cancel" && cancelled(cur.Payload) {
		return nil, nil
	}
	return a.stored(cur.Version+1, a.op.Payload, false, a.origin()), nil
}

func cancelled(payload json.RawMessage) bool {
	var p struct {
		Status string `json:"status"`
	}
	return json.Unmarshal(payload, &p) == nil && p.Status == "cancelled"
}

// Masters and config replace in arrival order; the conflict matrix arrives in 7c.
func (a *applier) resolved(cur *entityRow) (*stored, error) {
	version := 1
	if cur != nil {
		version = cur.Version + 1
	}
	return a.stored(version, a.op.Payload, a.op.OperationType == "void", a.origin()), nil
}
