package snapshot

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

type row struct {
	ID         string
	BusinessID string
	Status     string
	AsOfSeq    *int64
	ObjectKey  *string
	Bytes      *int64
	ExpiresAt  *time.Time
	CreatedAt  time.Time
}

const rowColumns = `id, business_id, status, as_of_seq, object_key, bytes, expires_at, created_at`

func scanRow(r pgx.Row) (*row, error) {
	s := &row{}
	err := r.Scan(&s.ID, &s.BusinessID, &s.Status, &s.AsOfSeq, &s.ObjectKey, &s.Bytes, &s.ExpiresAt, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return s, err
}

// lockRequests serializes bootstrap requests per business (not pushes), so two devices asking at once share a build.
func lockRequests(ctx context.Context, tx pgx.Tx, businessID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('muneem.snapshot:' || $1, 0))`, businessID)
	return err
}

func currentSeq(ctx context.Context, tx pgx.Tx, businessID string) (int64, error) {
	var seq int64
	err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM change_log WHERE business_id = $1`, businessID).Scan(&seq)
	return seq, err
}

// reusable is a build still running, or a ready bundle close enough to now and alive long enough to download.
func reusable(ctx context.Context, tx pgx.Tx, businessID string, minSeq int64, buildingSince, aliveUntil time.Time) (*row, error) {
	return scanRow(tx.QueryRow(ctx, `SELECT `+rowColumns+` FROM snapshot WHERE business_id = $1
		AND ((status = 'building' AND created_at > $3) OR (status = 'ready' AND as_of_seq >= $2 AND expires_at > $4))
		ORDER BY created_at DESC LIMIT 1`, businessID, minSeq, buildingSince, aliveUntil))
}

func insertBuilding(ctx context.Context, tx pgx.Tx, id, businessID string) (*row, error) {
	return scanRow(tx.QueryRow(ctx, `INSERT INTO snapshot (id, business_id, status) VALUES ($1, $2, 'building') RETURNING `+rowColumns,
		id, businessID))
}

func byID(ctx context.Context, tx pgx.Tx, id string) (*row, error) {
	return scanRow(tx.QueryRow(ctx, `SELECT `+rowColumns+` FROM snapshot WHERE id = $1`, id))
}

func markReady(ctx context.Context, tx pgx.Tx, id string, h Header, key string, bytes int64, expires time.Time) error {
	_, err := tx.Exec(ctx, `UPDATE snapshot SET status = 'ready', as_of_seq = $2, object_key = $3, bytes = $4, expires_at = $5, updated_at = now()
		WHERE id = $1`, id, h.AsOfSeq, key, bytes, expires)
	return err
}

func markFailed(ctx context.Context, tx pgx.Tx, id, reason string) error {
	_, err := tx.Exec(ctx, `UPDATE snapshot SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`, id, reason)
	return err
}

func (r *row) status(staleBefore time.Time) string {
	if r.Status == devicesync.SnapshotBuilding && r.CreatedAt.Before(staleBefore) {
		return devicesync.SnapshotFailed
	}
	return r.Status
}
