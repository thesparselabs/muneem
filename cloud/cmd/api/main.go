// muneem-api: the Go/Echo cloud service (Stage 1 surface: identity, devices, business setup, health).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/backups"
	"github.com/sparselabs/muneem/cloud/internal/business"
	"github.com/sparselabs/muneem/cloud/internal/device"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/snapshot"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/objectstore"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Embedded aliases give each handler set a distinct field name so their methods promote into one api.ServerInterface.
type authHandler = auth.Handler
type deviceHandler = device.Handler
type businessHandler = business.Handler
type syncHandler = devicesync.Handler
type backupHandler = backups.Handler

type handlers struct {
	*authHandler
	*deviceHandler
	*businessHandler
	*syncHandler
	*backupHandler
	httpx.Health
}

func main() {
	level := slog.LevelInfo
	if os.Getenv("LOG_LEVEL") == "debug" {
		level = slog.LevelDebug
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	dbURL := os.Getenv("DATABASE_URL")
	secret := os.Getenv("JWT_SECRET")
	if dbURL == "" || secret == "" {
		log.Error("DATABASE_URL and JWT_SECRET are required")
		os.Exit(2)
	}
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate-up":
			must(log, store.Migrate(dbURL, false))
			log.Info("migrations applied")
			return
		case "migrate-down":
			must(log, store.Migrate(dbURL, true))
			log.Info("migrations reverted")
			return
		}
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := store.Open(ctx, dbURL)
	must(log, err)
	defer db.Close()

	signer := auth.NewSigner(secret)
	verifier := device.NewVerifier(db)
	objects, err := newObjectStore(ctx, log)
	must(log, err)
	var snapshots devicesync.Snapshots
	if objects != nil {
		snapshots = snapshot.NewService(db, objects, log, snapshot.DefaultOptions)
	}
	backupService, err := newBackups(db, objects, log)
	must(log, err)
	h := handlers{
		authHandler:     &auth.Handler{DB: db, Signer: signer},
		deviceHandler:   &device.Handler{DB: db, Verifier: verifier, Revocations: devicesync.Control{}},
		businessHandler: &business.Handler{DB: db},
		syncHandler:     &devicesync.Handler{Ingest: &devicesync.Ingest{DB: db, Log: log}, Feed: &devicesync.Feed{DB: db}, Snapshots: snapshots},
		backupHandler:   &backups.Handler{Service: backupService},
	}
	e := httpx.New(httpx.Deps{Handlers: h, RequireAuth: signer.Require, DeviceVerifier: verifier.Middleware, Logger: log})
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	go func() {
		log.Info("listening", "port", port)
		if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server", "error", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = e.Shutdown(shutdownCtx)
}

// newObjectStore connects MUNEEM_S3_*; without an endpoint hydration and cloud backups answer 503.
func newObjectStore(ctx context.Context, log *slog.Logger) (*objectstore.S3, error) {
	cfg := objectstore.S3Config{Endpoint: os.Getenv("MUNEEM_S3_ENDPOINT"), Bucket: os.Getenv("MUNEEM_S3_BUCKET"),
		AccessKey: os.Getenv("MUNEEM_S3_ACCESS_KEY"), SecretKey: os.Getenv("MUNEEM_S3_SECRET_KEY"), Region: os.Getenv("MUNEEM_S3_REGION")}
	if cfg.Endpoint == "" {
		log.Warn("MUNEEM_S3_ENDPOINT not set: hydration and cloud backups are unavailable")
		return nil, nil
	}
	return objectstore.NewS3(ctx, cfg)
}

// newBackups needs object storage and MUNEEM_BACKUP_MASTER_KEY; with neither the backup routes answer 503.
func newBackups(db *store.DB, objects *objectstore.S3, log *slog.Logger) (*backups.Service, error) {
	master := os.Getenv("MUNEEM_BACKUP_MASTER_KEY")
	if objects == nil || master == "" {
		log.Warn("object storage or MUNEEM_BACKUP_MASTER_KEY not set: cloud backups are unavailable")
		return nil, nil
	}
	wrapper, err := backups.NewWrapper(master)
	if err != nil {
		return nil, err
	}
	return backups.NewService(db, objects, wrapper, log, backups.DefaultOptions), nil
}

func must(log *slog.Logger, err error) {
	if err != nil {
		log.Error("fatal", "error", err)
		os.Exit(1)
	}
}
