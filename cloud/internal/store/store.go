// Package store is the hand-written pgx data layer. Every business-scoped query runs inside
// WithTenantTx so Postgres RLS (migrations/0001) sees app.user_id / app.business_id.
package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/sparselabs/muneem/cloud/migrations"
)

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("conflict")

type DB struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string) (*DB, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() { d.Pool.Close() }

// Migrate applies embedded migrations (golang-migrate, forward-only; down is for dev).
func Migrate(url string, down bool) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}
	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		return err
	}
	sqlDB := stdlib.OpenDB(*cfg)
	defer sqlDB.Close()
	drv, err := pgxmigrate.WithInstance(sqlDB, &pgxmigrate.Config{})
	if err != nil {
		return err
	}
	m, err := migrate.NewWithInstance("iofs", src, "pgx5", drv)
	if err != nil {
		return err
	}
	if down {
		err = m.Down()
	} else {
		err = m.Up()
	}
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}

// Scope is the identity context propagated into Postgres as session settings.
type Scope struct {
	UserID     string
	BusinessID string
	DeviceID   string
}

// WithTx runs fn in a transaction with the scope applied via SET LOCAL (RLS defence-in-depth).
func (d *DB) WithTx(ctx context.Context, s Scope, fn func(tx pgx.Tx) error) error {
	return d.withTx(ctx, pgx.TxOptions{}, s, fn)
}

// WithSnapshotTx is WithTx in one read-only, repeatable-read snapshot: every query sees the same committed state.
func (d *DB) WithSnapshotTx(ctx context.Context, s Scope, fn func(tx pgx.Tx) error) error {
	return d.withTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly}, s, fn)
}

func (d *DB) withTx(ctx context.Context, opts pgx.TxOptions, s Scope, fn func(tx pgx.Tx) error) error {
	tx, err := d.Pool.BeginTx(ctx, opts)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	for k, v := range map[string]string{"app.user_id": s.UserID, "app.business_id": s.BusinessID, "app.device_id": s.DeviceID} {
		if _, err := tx.Exec(ctx, "SELECT set_config($1, $2, true)", k, v); err != nil {
			return fmt.Errorf("set_config %s: %w", k, err)
		}
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func IsUniqueViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}
