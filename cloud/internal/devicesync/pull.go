package devicesync

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Feed serves change_log pages per stream. It returns the caller's own changes too: the device skips them (7e).
type Feed struct{ DB *store.DB }

var ErrNotMember = errors.New("not a member of this business")

func (f *Feed) Pull(ctx context.Context, c Caller, businessID, stream string, since int64, limit int) (*PullResponse, error) {
	out := &PullResponse{Changes: []Change{}, NextSeq: since}
	err := f.DB.WithTx(ctx, c.scope(businessID), func(tx pgx.Tx) error {
		if _, err := store.GetMembership(ctx, tx, c.UserID, businessID); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return ErrNotMember
			}
			return err
		}
		page, err := readChanges(ctx, tx, businessID, stream, since, limit+1)
		if err != nil {
			return err
		}
		if len(page) > limit {
			out.HasMore, page = true, page[:limit]
		}
		out.Changes = page
		if len(page) > 0 {
			out.NextSeq = page[len(page)-1].Seq
		}
		if c.DeviceID == "" {
			return nil
		}
		return notePull(ctx, tx, c.DeviceID, out.NextSeq)
	})
	out.ServerTime = time.Now().UTC()
	return out, err
}

// Control records control messages; device revocation is the first (7c).
type Control struct{}

// DeviceRevoked puts a control change on the business's stream inside the revoking transaction.
func (Control) DeviceRevoked(ctx context.Context, tx pgx.Tx, businessID, deviceID string) error {
	if _, err := tx.Exec(ctx, "SELECT set_config('app.business_id', $1, true)", businessID); err != nil {
		return err
	}
	if err := lockBusiness(ctx, tx, businessID); err != nil {
		return err
	}
	payload, err := json.Marshal(map[string]any{"deviceId": deviceID, "status": "revoked", "revokedAt": time.Now().UTC()})
	if err != nil {
		return err
	}
	s := stored{EntityType: ControlDevice, EntityID: deviceID, Stream: StreamControl, Version: 1, Payload: payload, Writer: deviceID}
	seq, err := appendChange(ctx, tx, businessID, s)
	if err != nil {
		return err
	}
	return upsertEntity(ctx, tx, businessID, s, seq)
}
