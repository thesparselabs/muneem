package backups

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type row struct {
	ID            string
	BusinessID    string
	DeviceID      string
	ObjectKey     string
	Bytes         int64
	SHA256        string
	KeyID         string
	SchemaVersion int
	Status        string
	CreatedAt     time.Time
	ConfirmedAt   *time.Time
}

const columns = `id, business_id, device_id, object_key, bytes, sha256, key_id, schema_version, status, created_at, confirmed_at`

func scanRow(r pgx.Row) (*row, error) {
	var b row
	err := r.Scan(&b.ID, &b.BusinessID, &b.DeviceID, &b.ObjectKey, &b.Bytes, &b.SHA256, &b.KeyID, &b.SchemaVersion, &b.Status, &b.CreatedAt, &b.ConfirmedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &b, err
}

func insertPending(ctx context.Context, tx pgx.Tx, b row) error {
	_, err := tx.Exec(ctx, `INSERT INTO backup (id, business_id, device_id, object_key, bytes, sha256, key_id, schema_version, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`, b.ID, b.BusinessID, b.DeviceID, b.ObjectKey, b.Bytes, b.SHA256, b.KeyID, b.SchemaVersion)
	return err
}

func byID(ctx context.Context, tx pgx.Tx, id string) (*row, error) {
	return scanRow(tx.QueryRow(ctx, `SELECT `+columns+` FROM backup WHERE id = $1`, id))
}

func markReady(ctx context.Context, tx pgx.Tx, id string) (*row, error) {
	return scanRow(tx.QueryRow(ctx, `UPDATE backup SET status = 'ready', confirmed_at = COALESCE(confirmed_at, now()) WHERE id = $1 RETURNING `+columns, id))
}

func deleteRow(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(ctx, `DELETE FROM backup WHERE id = $1`, id)
	return err
}

func listReady(ctx context.Context, tx pgx.Tx, businessID string) ([]row, error) {
	return collect(tx.Query(ctx, `SELECT `+columns+` FROM backup WHERE business_id = $1 AND status = 'ready' ORDER BY confirmed_at DESC, id DESC`, businessID))
}

// expired is every ready backup past the newest keep, and every pending one older than staleBefore.
func expired(ctx context.Context, tx pgx.Tx, businessID string, keep int, staleBefore time.Time) ([]row, error) {
	return collect(tx.Query(ctx, `SELECT `+columns+` FROM (
		SELECT *, row_number() OVER (ORDER BY confirmed_at DESC, id DESC) AS n FROM backup WHERE business_id = $1 AND status = 'ready') r WHERE n > $2
		UNION ALL SELECT `+columns+` FROM backup WHERE business_id = $1 AND status = 'pending' AND created_at < $3`, businessID, keep, staleBefore))
}

func collect(rows pgx.Rows, err error) ([]row, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []row
	for rows.Next() {
		b, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

type wrappedKey struct {
	BusinessID string
	KeyID      string
	Version    string
	Nonce      []byte
	Wrapped    []byte
}

const keyColumns = `business_id, key_id, master_key_version, nonce, wrapped`

func scanKey(r pgx.Row) (*wrappedKey, error) {
	var k wrappedKey
	err := r.Scan(&k.BusinessID, &k.KeyID, &k.Version, &k.Nonce, &k.Wrapped)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &k, err
}

func getKey(ctx context.Context, tx pgx.Tx, businessID string, keyID *string) (*wrappedKey, error) {
	if keyID != nil {
		return scanKey(tx.QueryRow(ctx, `SELECT `+keyColumns+` FROM backup_key WHERE business_id = $1 AND key_id = $2`, businessID, *keyID))
	}
	return scanKey(tx.QueryRow(ctx, `SELECT `+keyColumns+` FROM backup_key WHERE business_id = $1 ORDER BY created_at, key_id LIMIT 1`, businessID))
}

func insertKey(ctx context.Context, tx pgx.Tx, businessID, keyID, deviceID, version string, nonce, wrapped []byte) error {
	_, err := tx.Exec(ctx, `INSERT INTO backup_key (business_id, key_id, nonce, wrapped, device_id, master_key_version) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (business_id, key_id) DO NOTHING`,
		businessID, keyID, nonce, wrapped, deviceID, version)
	return err
}

// keysNotUnder is every escrowed key wrapped under a master key other than version (owner role: no tenant scope).
func keysNotUnder(ctx context.Context, q pgx.Tx, version string) ([]wrappedKey, error) {
	rows, err := q.Query(ctx, `SELECT `+keyColumns+` FROM backup_key WHERE master_key_version <> $1 ORDER BY business_id, key_id`, version)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []wrappedKey
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *k)
	}
	return out, rows.Err()
}

// replaceWrapping swaps one key's wrapping only if it is still under the version it was read under.
func replaceWrapping(ctx context.Context, tx pgx.Tx, k wrappedKey, version string, nonce, wrapped []byte) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE backup_key SET master_key_version = $4, nonce = $5, wrapped = $6
		WHERE business_id = $1 AND key_id = $2 AND master_key_version = $3`, k.BusinessID, k.KeyID, k.Version, version, nonce, wrapped)
	return tag.RowsAffected() == 1, err
}
