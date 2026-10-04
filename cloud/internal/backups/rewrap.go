package backups

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

type RewrapResult struct {
	Rewrapped int
	Failed    int
}

// Rewrap moves every escrowed key under the active master key, one key per transaction (ADR-0052). It runs as the
// owner role, which RLS does not scope; a key it cannot unwrap is counted and logged, and the rest still move.
func Rewrap(ctx context.Context, db *store.DB, w *Wrapper, log *slog.Logger) (RewrapResult, error) {
	var res RewrapResult
	var stale []wrappedKey
	err := pgx.BeginFunc(ctx, db.Pool, func(tx pgx.Tx) error {
		var err error
		stale, err = keysNotUnder(ctx, tx, w.Active())
		return err
	})
	if err != nil {
		return res, err
	}
	for _, k := range stale {
		if err := rewrapOne(ctx, db, w, k); err != nil {
			res.Failed++
			log.Error("backup key not rewrapped", "business_id", k.BusinessID, "key_id", k.KeyID, "master_key_version", k.Version, "error", err)
			continue
		}
		res.Rewrapped++
	}
	if res.Failed > 0 {
		return res, fmt.Errorf("%d backup keys could not be rewrapped", res.Failed)
	}
	return res, nil
}

var errMoved = errors.New("the key changed while it was being rewrapped")

func rewrapOne(ctx context.Context, db *store.DB, w *Wrapper, k wrappedKey) error {
	key, err := w.Unwrap(k.Version, k.BusinessID, k.KeyID, k.Nonce, k.Wrapped)
	if err != nil {
		return err
	}
	version, nonce, wrapped, err := w.Wrap(k.BusinessID, k.KeyID, key)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, db.Pool, func(tx pgx.Tx) error {
		ok, err := replaceWrapping(ctx, tx, k, version, nonce, wrapped)
		if err == nil && !ok {
			err = errMoved
		}
		return err
	})
}
