package snapshot

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// pgSource reads inside one repeatable-read transaction. Documents come from change_log with every version, since
// entity_state keeps only a document's latest (a cancelled sale would otherwise arrive as just its cancel); the other
// streams are each entity's latest state, tombstones included as deletes.
type pgSource struct {
	tx         pgx.Tx
	businessID string
}

func (s pgSource) Watermark(ctx context.Context) (int64, error) {
	var seq int64
	err := s.tx.QueryRow(ctx, `SELECT COALESCE(MAX(seq), 0) FROM change_log WHERE business_id = $1`, s.businessID).Scan(&seq)
	return seq, err
}

func (s pgSource) Count(ctx context.Context, stream string, asOf int64) (int64, error) {
	var n int64
	var err error
	if stream == devicesync.StreamDocuments {
		err = s.tx.QueryRow(ctx, `SELECT COUNT(*) FROM change_log WHERE business_id = $1 AND stream = $2 AND seq <= $3`,
			s.businessID, stream, asOf).Scan(&n)
	} else {
		err = s.tx.QueryRow(ctx, `SELECT COUNT(*) FROM entity_state WHERE business_id = $1 AND entity_type = ANY($2) AND last_seq <= $3`,
			s.businessID, devicesync.LatestStateTypes[stream], asOf).Scan(&n)
	}
	return n, err
}

func (s pgSource) Each(ctx context.Context, stream string, asOf int64, emit func(devicesync.Change) error) error {
	var rows pgx.Rows
	var err error
	if stream == devicesync.StreamDocuments {
		rows, err = s.tx.Query(ctx, `SELECT seq, stream, entity_type, entity_id, op, version, origin_device_id, payload FROM change_log
			WHERE business_id = $1 AND stream = $2 AND seq <= $3 ORDER BY seq`, s.businessID, stream, asOf)
	} else {
		rows, err = s.tx.Query(ctx, `SELECT last_seq, $4::text, entity_type, entity_id, CASE WHEN deleted_at IS NULL THEN 'upsert' ELSE 'delete' END,
			version, origin_device_id, payload FROM entity_state WHERE business_id = $1 AND entity_type = ANY($2) AND last_seq <= $3
			ORDER BY array_position($2::text[], entity_type), last_seq`, s.businessID, devicesync.LatestStateTypes[stream], asOf, stream)
	}
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var c devicesync.Change
		if err := rows.Scan(&c.Seq, &c.Stream, &c.EntityType, &c.EntityID, &c.Op, &c.Version, &c.OriginDeviceID, &c.Payload); err != nil {
			return err
		}
		if err := emit(c); err != nil {
			return err
		}
	}
	return rows.Err()
}
