// Package health runs the business-health probes (ADR-0053): cheap cross-tenant SQL on a schedule, exported as gauges.
package health

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type Business struct {
	BusinessID            string
	DevicesActive         int
	DevicesSilent         int
	OutboxDepthMax        int
	OldestPendingAt       *time.Time
	NegativeStockMax      int
	DeadLettersUnresolved int64
	AuditChainBreaks      int64
	NewestBackupAt        *time.Time
	BusinessCreatedAt     time.Time
}

type Device struct {
	BusinessID      string
	DeviceID        string
	OutboxDepth     int
	OldestPendingAt *time.Time
	LastSeenAt      *time.Time
}

type Rejection struct {
	BusinessID string
	Code       string
	Rejected   int64
}

type Imbalance struct {
	BusinessID string
	Journals   int64
}

// DeviceIntegrity is a device's last integrity report; the diffs are device minus cloud, nil when not comparable.
type DeviceIntegrity struct {
	BusinessID       string
	DeviceID         string
	CheckedAt        time.Time
	TieOutFailures   int
	ReplayMismatches int
	AuditChainOk     bool
	JournalCountDiff *int64
	DebitDiffPaise   *int64
	CreditDiffPaise  *int64
}

// Source reads the probe aggregates; SQLSource reads them through migration 0008's SECURITY DEFINER functions.
type Source interface {
	Businesses(ctx context.Context, silentAfter, breaksWithin time.Duration) ([]Business, error)
	Devices(ctx context.Context, topN int) ([]Device, error)
	Rejections(ctx context.Context, within time.Duration) ([]Rejection, error)
	UnbalancedJournals(ctx context.Context) ([]Imbalance, error)
	DeviceIntegrity(ctx context.Context) ([]DeviceIntegrity, error)
}

// Querier is a pool, a connection or a transaction.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

type SQLSource struct{ Q Querier }

func (s SQLSource) Businesses(ctx context.Context, silentAfter, breaksWithin time.Duration) ([]Business, error) {
	rows, err := s.Q.Query(ctx, `SELECT business_id, devices_active, devices_silent, outbox_depth_max, oldest_pending_at, negative_stock_max,
		dead_letters_unresolved, audit_chain_breaks, newest_backup_at, business_created_at FROM health_businesses($1, $2)`, silentAfter, breaksWithin)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Business, error) {
		var b Business
		err := r.Scan(&b.BusinessID, &b.DevicesActive, &b.DevicesSilent, &b.OutboxDepthMax, &b.OldestPendingAt, &b.NegativeStockMax,
			&b.DeadLettersUnresolved, &b.AuditChainBreaks, &b.NewestBackupAt, &b.BusinessCreatedAt)
		return b, err
	})
}

func (s SQLSource) Devices(ctx context.Context, topN int) ([]Device, error) {
	rows, err := s.Q.Query(ctx, `SELECT business_id, device_id, outbox_depth, oldest_pending_at, last_seen_at FROM health_devices($1)`, topN)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Device, error) {
		var d Device
		err := r.Scan(&d.BusinessID, &d.DeviceID, &d.OutboxDepth, &d.OldestPendingAt, &d.LastSeenAt)
		return d, err
	})
}

func (s SQLSource) Rejections(ctx context.Context, within time.Duration) ([]Rejection, error) {
	rows, err := s.Q.Query(ctx, `SELECT business_id, code, rejected FROM health_rejections($1)`, within)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Rejection])
}

func (s SQLSource) UnbalancedJournals(ctx context.Context) ([]Imbalance, error) {
	rows, err := s.Q.Query(ctx, `SELECT business_id, journals FROM health_unbalanced_journals()`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Imbalance])
}

func (s SQLSource) DeviceIntegrity(ctx context.Context) ([]DeviceIntegrity, error) {
	rows, err := s.Q.Query(ctx, `SELECT business_id, device_id, checked_at, tie_out_failures, replay_mismatches, audit_chain_ok,
		journal_count_diff, journal_debit_diff_paise, journal_credit_diff_paise FROM health_device_integrity()`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[DeviceIntegrity])
}
