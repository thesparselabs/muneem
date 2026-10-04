package devicesync

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Snapshots builds and serves hydration bundles (7f); internal/devicesync/snapshot implements it.
type Snapshots interface {
	Request(ctx context.Context, c Caller, businessID string) (*Snapshot, error)
	Get(ctx context.Context, c Caller, snapshotID string) (*Snapshot, error)
}

var ErrSnapshotNotFound = errors.New("snapshot not found")

// CanBootstrap lets a member's signed device hydrate a business before it has pushed to it (a device being added);
// a device already bound to another business may not.
func CanBootstrap(ctx context.Context, tx pgx.Tx, c Caller, businessID string) error {
	if _, err := store.GetMembership(ctx, tx, c.UserID, businessID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return ErrNotMember
		}
		return err
	}
	bound, err := deviceBusiness(ctx, tx, c.DeviceID)
	if err != nil {
		return err
	}
	if bound != nil && *bound != businessID {
		return ErrNotMember
	}
	return nil
}
