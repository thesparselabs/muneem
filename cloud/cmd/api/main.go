// muneem-api: the Go/Echo cloud service. `muneem-api` serves; `migrate-up`, `migrate-down` and `rewrap` are one-shot
// subcommands run as the database owner role (ADR-0051); `healthcheck` probes a running server's /v1/ready;
// `crash-collector` serves the desktop crash ingest instead (ADR-0053).
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
	"github.com/sparselabs/muneem/cloud/internal/health"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/metrics"
	"github.com/sparselabs/muneem/cloud/internal/objectstore"
	"github.com/sparselabs/muneem/cloud/internal/reports"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Embedded aliases give each handler set a distinct field name so their methods promote into one api.ServerInterface.
type authHandler = auth.Handler
type deviceHandler = device.Handler
type businessHandler = business.Handler
type syncHandler = devicesync.Handler
type backupHandler = backups.Handler
type reportHandler = reports.Handler

type handlers struct {
	*authHandler
	*deviceHandler
	*businessHandler
	*syncHandler
	*backupHandler
	*reportHandler
	httpx.Health
	httpx.Readiness
}

// shutdownTimeout bounds draining HTTP and snapshot builds; the container's stop grace period must exceed it.
const shutdownTimeout = 25 * time.Second

func main() {
	level := slog.LevelInfo
	if os.Getenv("LOG_LEVEL") == "debug" {
		level = slog.LevelDebug
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	if len(os.Args) > 1 && os.Args[1] == "crash-collector" {
		crashCollector(log)
		return
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Error("DATABASE_URL is required")
		os.Exit(2)
	}
	if len(os.Args) > 1 {
		runCommand(log, os.Args[1], dbURL)
		return
	}
	serve(log, dbURL)
}

func runCommand(log *slog.Logger, cmd, dbURL string) {
	switch cmd {
	case "migrate-up":
		must(log, store.Migrate(dbURL, false))
		log.Info("migrations applied")
	case "migrate-down":
		must(log, store.Migrate(dbURL, true))
		log.Info("migrations reverted")
	case "rewrap":
		rewrap(log, dbURL)
	default:
		log.Error("unknown command; expected migrate-up, migrate-down or rewrap", "command", cmd)
		os.Exit(2)
	}
}

// rewrap re-wraps every escrowed backup key under the active master key; run it before removing an old version.
func rewrap(log *slog.Logger, dbURL string) {
	ctx := context.Background()
	wrapper, err := backups.MasterKeysFromEnv(os.Getenv("MUNEEM_BACKUP_MASTER_KEYS"), os.Getenv("MUNEEM_BACKUP_MASTER_KEY"))
	must(log, err)
	db, err := store.Open(ctx, dbURL)
	must(log, err)
	defer db.Close()
	res, err := backups.Rewrap(ctx, db, wrapper, log)
	log.Info("rewrap finished", "active", wrapper.Active(), "rewrapped", res.Rewrapped, "failed", res.Failed)
	must(log, err)
}

func serve(log *slog.Logger, dbURL string) {
	keys, err := auth.KeyringFromEnv(os.Getenv("JWT_SECRETS"), os.Getenv("JWT_SECRET"))
	if err != nil {
		log.Error("JWT keys", "error", err)
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := store.Open(ctx, dbURL)
	must(log, err)
	defer db.Close()

	protocols, err := httpx.ProtocolsFromEnv(os.Getenv)
	must(log, err)
	probeOptions, err := health.OptionsFromEnv(os.Getenv)
	must(log, err)
	m := metrics.New()
	m.WatchPool(db.Pool)
	log.Info("sync protocols", "min", protocols.Min, "current", protocols.Current)
	log.Info("jwt keys", "active_kid", keys.ActiveID())
	signer := auth.NewKeyringSigner(keys)
	verifier := device.NewVerifier(db)
	objects, err := newObjectStore(ctx, log)
	must(log, err)
	readiness := httpx.Readiness{Checks: []httpx.Check{{Name: "postgres", Pinger: db}}, Log: log, Observer: m}
	var snapshots devicesync.Snapshots
	var snapshotService *snapshot.Service
	if objects != nil {
		snapshotService = snapshot.NewService(db, objects, log, snapshot.DefaultOptions)
		snapshotService.Jobs = m
		snapshots = snapshotService
		readiness.Checks = append(readiness.Checks, httpx.Check{Name: "object_store", Pinger: objects})
	}
	backupService, err := newBackups(db, objects, log)
	must(log, err)
	if backupService != nil {
		backupService.Jobs = m
	}
	h := handlers{
		authHandler:     &auth.Handler{DB: db, Signer: signer},
		deviceHandler:   &device.Handler{DB: db, Verifier: verifier, Revocations: devicesync.Control{}},
		businessHandler: &business.Handler{DB: db},
		syncHandler:     &devicesync.Handler{Ingest: &devicesync.Ingest{DB: db, Log: log, Metrics: m}, Feed: &devicesync.Feed{DB: db}, Snapshots: snapshots, Protocols: protocols},
		backupHandler:   &backups.Handler{Service: backupService},
		reportHandler:   &reports.Handler{DB: db},
		Readiness:       readiness,
	}
	e := httpx.New(httpx.Deps{Handlers: h, RequireAuth: signer.Require, DeviceVerifier: verifier.Middleware, Logger: log, Protocols: protocols, Requests: m})
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
	metricsServer := serveMetrics(log, m)
	prober := &health.Prober{Source: health.SQLSource{Q: db.Pool}, Gauges: health.NewGauges(m.Registry), Jobs: m, Log: log, Opt: probeOptions}
	go prober.Run(ctx)
	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Warn("http shutdown", "error", err)
	}
	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		log.Warn("metrics shutdown", "error", err)
	}
	if snapshotService != nil {
		if err := snapshotService.Shutdown(shutdownCtx); err != nil {
			log.Warn("snapshot builds cancelled at shutdown", "error", err)
		}
	}
}

// serveMetrics listens on MUNEEM_METRICS_ADDR (default loopback), a port Caddy never proxies.
func serveMetrics(log *slog.Logger, m *metrics.Metrics) *http.Server {
	srv := m.Server(os.Getenv("MUNEEM_METRICS_ADDR"))
	go func() {
		log.Info("metrics listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("metrics server", "error", err)
		}
	}()
	return srv
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

// newBackups needs object storage and a master key (MUNEEM_BACKUP_MASTER_KEYS or the legacy MUNEEM_BACKUP_MASTER_KEY);
// without either the backup routes answer 503.
func newBackups(db *store.DB, objects *objectstore.S3, log *slog.Logger) (*backups.Service, error) {
	keys, legacy := os.Getenv("MUNEEM_BACKUP_MASTER_KEYS"), os.Getenv("MUNEEM_BACKUP_MASTER_KEY")
	if objects == nil || (keys == "" && legacy == "") {
		log.Warn("object storage or a backup master key not set: cloud backups are unavailable")
		return nil, nil
	}
	wrapper, err := backups.MasterKeysFromEnv(keys, legacy)
	if err != nil {
		return nil, err
	}
	log.Info("backup master keys", "active", wrapper.Active())
	return backups.NewService(db, objects, wrapper, log, backups.DefaultOptions), nil
}

// healthcheck probes this container's own /v1/ready, for the container runtime (the distroless image has no curl).
func healthcheck() int {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/v1/ready")
	if err != nil {
		return 1
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func must(log *slog.Logger, err error) {
	if err != nil {
		log.Error("fatal", "error", err)
		os.Exit(1)
	}
}
