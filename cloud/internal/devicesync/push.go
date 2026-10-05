package devicesync

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Caller is the authenticated user and the signed device making a sync call (ADR-0039).
type Caller struct {
	UserID   string
	DeviceID string
	SkewMs   *int
}

func (c Caller) scope(businessID string) store.Scope {
	return store.Scope{UserID: c.UserID, BusinessID: businessID, DeviceID: c.DeviceID}
}

// Ingest applies pushed operations, each in its own transaction (LLD §7.1).
type Ingest struct {
	DB  *store.DB
	Log *slog.Logger
}

func (s *Ingest) Push(ctx context.Context, c Caller, req *PushRequest) (*PushResponse, error) {
	results := make([]Result, 0, len(req.Operations))
	var pushed *int64
	for _, op := range req.Operations {
		r, err := s.pushOne(ctx, c, req.BusinessID, op)
		if err != nil {
			return nil, err
		}
		results = append(results, r)
		if r.Status == StatusApplied || r.Status == StatusDuplicate {
			seq := op.Seq
			if pushed == nil || seq > *pushed {
				pushed = &seq
			}
		}
	}
	next, err := s.bookkeep(ctx, c, req.BusinessID, pushed)
	if err != nil {
		return nil, err
	}
	return &PushResponse{ServerTime: time.Now().UTC(), NextPullSeq: next, Results: results}, nil
}

func (s *Ingest) pushOne(ctx context.Context, c Caller, businessID string, op Operation) (Result, error) {
	var res Result
	var failure *verify.Failure
	err := s.DB.WithTx(ctx, c.scope(businessID), func(tx pgx.Tx) error {
		r, err := (&applier{ctx: ctx, tx: tx, caller: c, businessID: businessID, op: op}).run()
		if f, ok := asFailure(err); ok {
			failure = f
			return err
		}
		res = r
		return err
	})
	if failure != nil {
		return s.reject(ctx, c, businessID, op, failure)
	}
	return res, err
}

// reject keeps the operation whole in dead-letter; nothing it carried is stored (ADR-0038).
func (s *Ingest) reject(ctx context.Context, c Caller, businessID string, op Operation, f *verify.Failure) (Result, error) {
	err := s.DB.WithTx(ctx, c.scope(businessID), func(tx pgx.Tx) error {
		if err := insertDeadLetter(ctx, tx, businessID, c.DeviceID, op, f.Code, f.Detail); err != nil {
			return err
		}
		if f.Code == CodeAuditChainBroken {
			if err := recordChainBreak(ctx, tx, businessID, c.DeviceID, op, f.Detail); err != nil {
				return err
			}
		}
		return recordOperation(ctx, tx, businessID, c.DeviceID, op, StatusRejected, nil, &f.Code)
	})
	if err != nil {
		return Result{}, err
	}
	s.Log.Error("sync operation rejected", "alert", true, "code", f.Code, "detail", f.Detail, "business_id", businessID,
		"device_id", c.DeviceID, "operation_id", op.OperationID, "entity_type", op.EntityType, "entity_id", op.EntityID)
	return rejected(op, f.Code, f.Detail), nil
}

func (s *Ingest) bookkeep(ctx context.Context, c Caller, businessID string, pushed *int64) (int64, error) {
	var next int64
	err := s.DB.WithTx(ctx, c.scope(businessID), func(tx pgx.Tx) error {
		exists, err := businessExists(ctx, tx, businessID)
		if err != nil || !exists {
			return err
		}
		if err := notePush(ctx, tx, c.DeviceID, businessID, pushed, c.SkewMs); err != nil {
			return err
		}
		next, err = lastSeq(ctx, tx, businessID)
		return err
	})
	return next, err
}

var errBusinessMismatch = errors.New("device belongs to another business")

// Authorize checks the caller may sync this business: a member of it, or (for a business created offline) not yet
// known to the cloud. A device already bound to another business may not push into this one.
func Authorize(ctx context.Context, db *store.DB, c Caller, businessID string) (allowed bool, err error) {
	err = db.WithTx(ctx, c.scope(businessID), func(tx pgx.Tx) error {
		if c.DeviceID != "" {
			bound, err := deviceBusiness(ctx, tx, c.DeviceID)
			if err != nil {
				return err
			}
			if bound != nil && *bound != businessID {
				return errBusinessMismatch
			}
		}
		exists, err := businessExists(ctx, tx, businessID)
		if err != nil {
			return err
		}
		if !exists {
			allowed = true
			return nil
		}
		_, err = store.GetMembership(ctx, tx, c.UserID, businessID)
		allowed = err == nil
		if errors.Is(err, store.ErrNotFound) {
			return nil
		}
		return err
	})
	if errors.Is(err, errBusinessMismatch) {
		return false, nil
	}
	return allowed, err
}
