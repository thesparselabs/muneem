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

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/sparselabs/muneem/cloud/internal/crashes"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

// crashCollector serves the self-hosted crash ingest (ADR-0053) from the same image: no database, reports go to stdout.
func crashCollector(log *slog.Logger) {
	opt := crashes.DefaultOptions
	opt.Key = os.Getenv("MUNEEM_CRASH_KEY")
	if len(opt.Key) < 16 {
		log.Error("MUNEEM_CRASH_KEY must be at least 16 characters (the DSN's public key)")
		os.Exit(2)
	}
	if dir := os.Getenv("MUNEEM_CRASH_DIR"); dir != "" {
		opt.Dir = dir
	}
	c := &crashes.Collector{Opt: opt, Log: log}
	e := echo.New()
	e.HideBanner, e.HidePort = true, true
	e.IPExtractor = echo.ExtractIPFromXFFHeader()
	e.Use(middleware.Recover())
	c.Routes(e, httpx.RateLimit(opt.RatePerIPBurst, opt.RatePerIPRefill))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go pruneDumps(ctx, log, c)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	go func() {
		log.Info("crash collector listening", "port", port, "dir", opt.Dir)
		if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("crash collector", "error", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = e.Shutdown(shutdownCtx)
}

func pruneDumps(ctx context.Context, log *slog.Logger, c *crashes.Collector) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if n, err := c.Prune(); err != nil {
			log.Error("minidump prune", "error", err)
		} else if n > 0 {
			log.Info("minidumps pruned", "removed", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
