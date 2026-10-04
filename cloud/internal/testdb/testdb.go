// Package testdb gives integration tests a migrated Postgres (MUNEEM_TEST_DATABASE_URL); they skip when it is unset.
package testdb

import (
	"context"
	"os"
	"sync"
	"testing"

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

var tables = []string{
	"snapshot", "conflict_log", "dead_letter", "journal_line", "journal_entry", "entity_state", "change_log", "sync_operation",
	"audit_log", "entitlement", "refresh_token", "device", "terminal", "branch", "business_membership", "business",
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
