// Package testdb gives integration tests a migrated Postgres (MUNEEM_TEST_DATABASE_URL); they skip when it is unset.
package testdb

import (
	"context"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

const EnvURL = "MUNEEM_TEST_DATABASE_URL"

var migrateOnce sync.Once
var migrateErr error

// Open migrates the database once per test binary and returns a pool on it.
func Open(t testing.TB) *store.DB {
	t.Helper()
	url := os.Getenv(EnvURL)
	if url == "" {
		t.Skip(EnvURL + " not set")
	}
	migrateOnce.Do(func() { migrateErr = store.Migrate(url, false) })
	if migrateErr != nil {
		t.Fatalf("migrate: %v", migrateErr)
	}
	db, err := store.Open(context.Background(), url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(db.Close)
	return db
}

var ownMu sync.Mutex
var ownMigrated = map[string]bool{}

// OpenOwn gives a package its own migrated database beside the shared one (<db>_<suffix>), so packages whose tests
// reset tables can run in parallel with the others under `go test ./...`.
func OpenOwn(t testing.TB, suffix string) *store.DB {
	t.Helper()
	base := os.Getenv(EnvURL)
	if base == "" {
		t.Skip(EnvURL + " not set")
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" {
		t.Fatalf("%s must be a postgres:// URL", EnvURL)
	}
	name := strings.TrimPrefix(u.Path, "/") + "_" + suffix
	u.Path = "/" + name
	own := u.String()
	ownMu.Lock()
	defer ownMu.Unlock()
	if !ownMigrated[name] {
		if err := createDatabase(base, name); err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		if err := store.Migrate(own, false); err != nil {
			t.Fatalf("migrate %s: %v", name, err)
		}
		ownMigrated[name] = true
	}
	db, err := store.Open(context.Background(), own)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(db.Close)
	return db
}

func createDatabase(base, name string) error {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, base)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	var exists bool
	if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, name).Scan(&exists); err != nil || exists {
		return err
	}
	_, err = conn.Exec(ctx, `CREATE DATABASE `+pgx.Identifier{name}.Sanitize())
	return err
}

var tables = []string{
	"party_outstanding", "product_sales_daily", "daily_payment_summary", "daily_sales_summary",
	"audit_entry", "backup_key", "backup", "snapshot", "conflict_log", "dead_letter", "journal_line", "journal_entry", "entity_state", "change_log", "sync_operation",
	"audit_log", "entitlement", "refresh_token", "device_integrity", "device", "terminal", "branch", "business_membership", "business",
	"organization_member", "app_user", "organization",
}

// Reset empties every table, so each test starts from an empty cloud.
func Reset(t testing.TB, db *store.DB) {
	t.Helper()
	sql := "TRUNCATE "
	for i, name := range tables {
		if i > 0 {
			sql += ", "
		}
		sql += name
	}
	if _, err := db.Pool.Exec(context.Background(), sql+" RESTART IDENTITY CASCADE"); err != nil {
		t.Fatalf("reset: %v", err)
	}
}
