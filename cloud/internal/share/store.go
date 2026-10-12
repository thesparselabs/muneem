package share

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func sentAtOf(ctx context.Context, tx pgx.Tx, businessID, shareID string) (*time.Time, error) {
	var at *time.Time
	err := tx.QueryRow(ctx, `SELECT sent_at FROM share_email WHERE business_id = $1 AND share_id = $2 AND status = 'sent'`, businessID, shareID).Scan(&at)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return at, err
}

func sentSince(ctx context.Context, tx pgx.Tx, businessID string, since time.Time) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM share_email WHERE business_id = $1 AND created_at > $2`, businessID, since).Scan(&n)
	return n, err
}

func claim(ctx context.Context, tx pgx.Tx, businessID, shareID, deviceID, recipient string, bytes int) error {
	_, err := tx.Exec(ctx, `INSERT INTO share_email (business_id, share_id, device_id, recipient, bytes, status) VALUES ($1, $2, $3, $4, $5, 'sending')
		ON CONFLICT (business_id, share_id) DO UPDATE SET device_id = EXCLUDED.device_id, recipient = EXCLUDED.recipient, bytes = EXCLUDED.bytes`,
		businessID, shareID, deviceID, recipient, bytes)
	return err
}

func markSent(ctx context.Context, tx pgx.Tx, businessID, shareID string) (time.Time, error) {
	var at time.Time
	err := tx.QueryRow(ctx, `UPDATE share_email SET status = 'sent', sent_at = COALESCE(sent_at, now()) WHERE business_id = $1 AND share_id = $2 RETURNING sent_at`,
		businessID, shareID).Scan(&at)
	return at, err
}
