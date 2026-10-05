package health_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/sparselabs/muneem/cloud/internal/health"
	"github.com/sparselabs/muneem/cloud/internal/store"
	"github.com/sparselabs/muneem/cloud/internal/testdb"
)

const (
	shopA = "01J0000000000000000000BA01"
	shopB = "01J0000000000000000000BB01"
)

// seed builds two shops: A has every problem the probes look for, B is healthy and has never backed up.
func seed(t *testing.T, db *store.DB) {
	t.Helper()
	stmts := []string{
		`INSERT INTO organization (id, name) VALUES ('O1', 'Org')`,
		`INSERT INTO app_user (id, name, identifier, password_hash) VALUES ('U1', 'Owner', 'owner@example.test', 'x')`,
		`INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_by, created_at) VALUES
			('` + shopA + `', 'O1', 'A', 'retail', '27', 'regular', 'U1', now() - interval '10 days'),
			('` + shopB + `', 'O1', 'B', 'retail', '27', 'regular', 'U1', now() - interval '3 days')`,
		`INSERT INTO device (id, organization_id, business_id, registered_by, installation_id, public_key, platform, app_version, schema_version, status,
			last_seen_at, outbox_depth, oldest_pending_at, negative_stock_count) VALUES
			('DA1', 'O1', '` + shopA + `', 'U1', 'i1', 'k', 'win32', '1.0.0', 20, 'active', now(), 600, now() - interval '2 hours', 3),
			('DA2', 'O1', '` + shopA + `', 'U1', 'i2', 'k', 'win32', '1.0.0', 20, 'active', now() - interval '2 days', 0, NULL, 0),
			('DA3', 'O1', '` + shopA + `', 'U1', 'i3', 'k', 'win32', '1.0.0', 20, 'revoked', NULL, 9999, now() - interval '30 days', 99),
			('DB1', 'O1', '` + shopB + `', 'U1', 'i4', 'k', 'win32', '1.0.0', 20, 'active', now(), 0, NULL, 0)`,
		`INSERT INTO dead_letter (business_id, device_id, operation_id, entity_type, entity_id, operation, error_code, error_detail) VALUES
			('` + shopA + `', 'DA1', 'OPX', 'sale', 'S1', '{}', 'TOTAL_MISMATCH', 'x'),
			('` + shopA + `', 'DA1', 'OPX', 'sale', 'S1', '{}', 'TOTAL_MISMATCH', 'x'),
			('` + shopA + `', 'DA1', 'OPY', 'sale', 'S2', '{}', 'PAYLOAD_INVALID', 'x')`,
		`INSERT INTO sync_operation (business_id, device_id, operation_id, entity_type, entity_id, payload_hash, status, device_seq) VALUES
			('` + shopA + `', 'DA1', 'OPY', 'sale', 'S2', 'h', 'applied', 2)`,
		`INSERT INTO conflict_log (id, business_id, kind, entity_type, entity_id, device_id, operation_id, detail, created_at) VALUES
			('C1', '` + shopA + `', 'audit_chain_broken', 'audit_log', 'a', 'DA1', 'o1', '{}', now() - interval '1 hour'),
			('C2', '` + shopA + `', 'audit_chain_broken', 'audit_log', 'b', 'DA1', 'o2', '{}', now() - interval '3 days'),
			('C3', '` + shopA + `', 'late_arrival', 'sale', 'c', 'DA1', 'o3', '{}', now())`,
		`INSERT INTO backup (id, business_id, device_id, object_key, bytes, sha256, key_id, schema_version, status, confirmed_at) VALUES
			('K1', '` + shopA + `', 'DA1', 'k1', 1, 'h', 'key', 20, 'ready', now() - interval '30 hours'),
			('K2', '` + shopA + `', 'DA1', 'k2', 1, 'h', 'key', 20, 'pending', NULL)`,
		`INSERT INTO journal_entry (id, business_id, entry_no, entry_date, doc_date, period_id, source, ref_type, ref_id, late_posting, origin_device_id, server_seq) VALUES
			('J1', '` + shopA + `', '1', '2026-10-01', '2026-10-01', 'P', 'sale', 'sale', 'S0', false, 'DA1', 1),
			('J2', '` + shopA + `', '2', '2026-10-01', '2026-10-01', 'P', 'sale', 'sale', 'S9', false, 'DA1', 2)`,
		`INSERT INTO journal_line (journal_id, line_no, business_id, account_code, debit_paise, credit_paise) VALUES
			('J1', 1, '` + shopA + `', '1000', 500, 0), ('J1', 2, '` + shopA + `', '4000', 0, 500),
			('J2', 1, '` + shopA + `', '1000', 500, 0), ('J2', 2, '` + shopA + `', '4000', 0, 499)`,
		`INSERT INTO device_integrity (device_id, business_id, checked_at, tie_out_failures, replay_mismatches, audit_chain_ok, journal_count,
			journal_debit_paise, journal_credit_paise, documents_seq, outbox_depth) VALUES
			('DA1', '` + shopA + `', now() - interval '1 hour', 0, 0, true, 1, 500, 700, 1, 0),
			('DA2', '` + shopA + `', now() - interval '2 days', 2, 4, false, 9, 9, 9, 1, 3)`,
	}
	for _, s := range stmts {
		if _, err := db.Pool.Exec(context.Background(), s); err != nil {
			t.Fatalf("%v\n%s", err, s)
		}
	}
}

// asAPIRole runs fn in a transaction as the RLS-bound API role with no tenant set, as the probe job does in production.
func asAPIRole(t *testing.T, db *store.DB, fn func(tx pgx.Tx)) {
	t.Helper()
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(context.Background(), `SET LOCAL ROLE muneem_api`); err != nil {
		t.Fatal(err)
	}
	fn(tx)
}

func TestProbesExportEachShopsHealthThroughTheAPIRole(t *testing.T) {
	db := testdb.OpenOwn(t, "health")
	testdb.Reset(t, db)
	seed(t, db)
	asAPIRole(t, db, func(tx pgx.Tx) {
		var visible int
		if err := tx.QueryRow(context.Background(), `SELECT count(*) FROM dead_letter`).Scan(&visible); err != nil {
			t.Fatal(err)
		}
		if visible != 0 {
			t.Fatalf("RLS let the API role read %d dead letters without a tenant", visible)
		}
		reg := prometheus.NewRegistry()
		p := &health.Prober{Source: health.SQLSource{Q: tx}, Gauges: health.NewGauges(reg), Opt: health.DefaultOptions}
		if !p.RunOnce(context.Background()) {
			t.Fatal("probe did not run")
		}
		expect(t, reg, map[string]float64{
			`muneem_business_devices{business_id="` + shopA + `",state="active"}`:                         2,
			`muneem_business_devices{business_id="` + shopA + `",state="silent"}`:                         1,
			`muneem_business_devices{business_id="` + shopB + `",state="silent"}`:                         0,
			`muneem_business_outbox_depth_max{business_id="` + shopA + `"}`:                               600,
			`muneem_business_negative_stock_max{business_id="` + shopA + `"}`:                             3,
			`muneem_business_dead_letters_unresolved{business_id="` + shopA + `"}`:                        1,
			`muneem_business_audit_chain_breaks_recent{business_id="` + shopA + `"}`:                      1,
			`muneem_business_unbalanced_journals{business_id="` + shopA + `"}`:                            1,
			`muneem_business_unbalanced_journals{business_id="` + shopB + `"}`:                            0,
			`muneem_business_rejections_recent{business_id="` + shopA + `",code="TOTAL_MISMATCH"}`:        2,
			`muneem_business_rejections_recent{business_id="` + shopA + `",code="PAYLOAD_INVALID"}`:       1,
			`muneem_device_outbox_depth{business_id="` + shopA + `",device_id="DA1"}`:                     600,
			`muneem_device_journal_diff{business_id="` + shopA + `",device_id="DA1",kind="count"}`:        0,
			`muneem_device_journal_diff{business_id="` + shopA + `",device_id="DA1",kind="debit_paise"}`:  0,
			`muneem_device_journal_diff{business_id="` + shopA + `",device_id="DA1",kind="credit_paise"}`: 200,
			`muneem_device_audit_chain_ok{business_id="` + shopA + `",device_id="DA1"}`:                   1,
			`muneem_device_audit_chain_ok{business_id="` + shopA + `",device_id="DA2"}`:                   0,
			`muneem_device_tie_out_failures{business_id="` + shopA + `",device_id="DA2"}`:                 2,
			`muneem_device_replay_mismatches{business_id="` + shopA + `",device_id="DA2"}`:                4,
		})
		within(t, reg, `muneem_device_integrity_age_seconds{business_id="`+shopA+`",device_id="DA2"}`, 2*86400)
		if v := value(t, reg, `muneem_device_journal_diff{business_id="`+shopA+`",device_id="DA2",kind="count"}`); v != nil {
			t.Fatalf("a device with unsent operations was compared: %v", *v)
		}
		within(t, reg, `muneem_business_outbox_oldest_age_seconds{business_id="`+shopA+`"}`, 2*3600)
		within(t, reg, `muneem_business_backup_age_seconds{business_id="`+shopA+`"}`, 30*3600)
		within(t, reg, `muneem_business_backup_age_seconds{business_id="`+shopB+`"}`, 3*86400)
		within(t, reg, `muneem_business_outbox_oldest_age_seconds{business_id="`+shopB+`"}`, 0)
		if v := value(t, reg, `muneem_device_outbox_depth{business_id="`+shopA+`",device_id="DA3"}`); v != nil {
			t.Fatalf("a revoked device was exported: %v", *v)
		}
	})
}

func TestTopDevicesBoundsPerDeviceSeries(t *testing.T) {
	db := testdb.OpenOwn(t, "health")
	testdb.Reset(t, db)
	seed(t, db)
	reg := prometheus.NewRegistry()
	opt := health.DefaultOptions
	opt.TopDevices = 1
	p := &health.Prober{Source: health.SQLSource{Q: db.Pool}, Gauges: health.NewGauges(reg), Opt: opt}
	p.RunOnce(context.Background())
	if n := testutil.CollectAndCount(reg, "muneem_device_outbox_depth"); n != 1 {
		t.Fatalf("%d device series, want 1", n)
	}
	if v := value(t, reg, `muneem_device_outbox_depth{business_id="`+shopA+`",device_id="DA1"}`); v == nil {
		t.Fatal("the device with the oldest waiting operation was not the one kept")
	}
}

func TestOptionsFromEnv(t *testing.T) {
	env := map[string]string{"MUNEEM_HEALTH_PROBE_INTERVAL": "30s", "MUNEEM_HEALTH_LEDGER_INTERVAL": "0", "MUNEEM_HEALTH_TOP_DEVICES": "5"}
	o, err := health.OptionsFromEnv(func(k string) string { return env[k] })
	if err != nil || o.Interval != 30*time.Second || o.LedgerInterval != 0 || o.TopDevices != 5 {
		t.Fatalf("%+v %v", o, err)
	}
	env["MUNEEM_HEALTH_TOP_DEVICES"] = "0"
	if _, err := health.OptionsFromEnv(func(k string) string { return env[k] }); err == nil {
		t.Fatal("TOP_DEVICES=0 accepted")
	}
}
