package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/internal/admin"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/device"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

type adminDeps struct {
	keys     *auth.Keyring
	app      *store.DB
	ingest   admin.Reapplier
	verifier *device.Verifier
}

// serveAdmin starts the operator listener (MUNEEM_ADMIN_ADDR) when MUNEEM_ADMIN_DATABASE_URL names the admin role's
// login (ADR-0057). MUNEEM_ADMIN_PUBLIC=true also mounts it on the public server; it is off by default.
func serveAdmin(ctx context.Context, log *slog.Logger, public *echo.Echo, d adminDeps) *echo.Echo {
	url := os.Getenv("MUNEEM_ADMIN_DATABASE_URL")
	if url == "" {
		log.Info("MUNEEM_ADMIN_DATABASE_URL not set: operator tooling is off")
		return nil
	}
	adminDB, err := store.Open(ctx, url)
	must(log, err)
	dir := &admin.Directory{DB: adminDB}
	operators := &admin.Operators{Dir: dir, Tokens: admin.NewTokens(d.keys)}
	actions := &admin.Actions{Dir: dir, App: d.app, Ingest: d.ingest, Revocations: devicesync.Control{}, Keys: d.verifier}
	module := admin.NewModule(dir, operators, actions, admin.NewCSRF())
	if os.Getenv("MUNEEM_ADMIN_PUBLIC") == "true" {
		module.Mount(public)
		log.Warn("operator tooling is also served on the public address (MUNEEM_ADMIN_PUBLIC=true)")
	}
	addr := os.Getenv("MUNEEM_ADMIN_ADDR")
	if addr == "" {
		addr = admin.DefaultAddr
	}
	srv := admin.NewServer(module, log)
	go func() {
		log.Info("admin listening", "addr", addr)
		if err := srv.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("admin server", "error", err)
		}
	}()
	return srv
}

// operatorCommand grants or revokes an operator; run on the server as the owner role (deploy.sh grant-operator).
func operatorCommand(log *slog.Logger, cmd, dbURL string, args []string) {
	if len(args) != 1 {
		log.Error("usage: muneem-api " + cmd + " <email>")
		os.Exit(2)
	}
	ctx := context.Background()
	db, err := store.Open(ctx, dbURL)
	must(log, err)
	defer db.Close()
	if cmd == "revoke-operator" {
		must(log, admin.RevokeOperator(ctx, db, args[0]))
		log.Info("operator revoked", "email", args[0])
		return
	}
	created, err := admin.GrantOperator(ctx, db, args[0], readPassword)
	must(log, err)
	log.Info("operator granted", "email", args[0], "account_created", created)
}

// readPassword takes a new operator account's password from the first line of stdin.
func readPassword() (string, error) {
	fmt.Fprint(os.Stderr, "new operator password (at least 12 characters): ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		return "", errors.New("no password on stdin")
	}
	return strings.TrimRight(line, "\r\n"), nil
}
