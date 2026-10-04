package httpx

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
)

// Pinger is a dependency the API cannot serve without.
type Pinger interface {
	Ping(ctx context.Context) error
}

type Check struct {
	Name   string
	Pinger Pinger
}

const DefaultReadyTimeout = 2 * time.Second

// Readiness answers GET /v1/ready: 200 when every check pings within Timeout, else 503; failures are logged, not returned.
type Readiness struct {
	Checks   []Check
	Timeout  time.Duration
	Log      *slog.Logger
	Observer ReadyObserver
}

// ReadyObserver records each check's outcome; the container healthcheck calls /v1/ready every 10 s, keeping it fresh.
type ReadyObserver interface {
	ReadyCheck(name string, ok bool)
}

func (r Readiness) GetReady(c echo.Context) error {
	timeout := r.Timeout
	if timeout <= 0 {
		timeout = DefaultReadyTimeout
	}
	ctx, cancel := context.WithTimeout(c.Request().Context(), timeout)
	defer cancel()
	out := api.Readiness{Ready: true, Checks: make([]api.ReadinessCheck, len(r.Checks))}
	var wg sync.WaitGroup
	for i, check := range r.Checks {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := check.Pinger.Ping(ctx)
			if err != nil && r.Log != nil {
				r.Log.Warn("readiness check failed", "check", check.Name, "error", err)
			}
			out.Checks[i] = api.ReadinessCheck{Name: check.Name, Ok: err == nil}
		}()
	}
	wg.Wait()
	for _, check := range out.Checks {
		out.Ready = out.Ready && check.Ok
		if r.Observer != nil {
			r.Observer.ReadyCheck(check.Name, check.Ok)
		}
	}
	status := http.StatusOK
	if !out.Ready {
		status = http.StatusServiceUnavailable
	}
	return c.JSON(status, out)
}
