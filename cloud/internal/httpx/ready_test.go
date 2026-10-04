package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
)

type pingFunc func(ctx context.Context) error

func (f pingFunc) Ping(ctx context.Context) error { return f(ctx) }

var up = pingFunc(func(context.Context) error { return nil })
var down = pingFunc(func(context.Context) error { return errors.New("connection refused") })
var hung = pingFunc(func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() })

// readyOnly serves GetReady and leaves every other route unimplemented.
type readyOnly struct {
	api.ServerInterface
	r Readiness
}

func (h readyOnly) GetReady(c echo.Context) error { return h.r.GetReady(c) }

func ready(t *testing.T, r Readiness, bearer bool) (int, api.Readiness) {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	r.Log = log
	deny := func(echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error { return Unauthorized(c, "NOT_AUTHENTICATED", "no") }
	}
	e := New(Deps{Handlers: readyOnly{r: r}, RequireAuth: deny, DeviceVerifier: deny, Logger: log})
	req := httptest.NewRequest(http.MethodGet, "/v1/ready", nil)
	if bearer {
		req.Header.Set("Authorization", "Bearer x")
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var body api.Readiness
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q: %v", rec.Body.String(), err)
	}
	return rec.Code, body
}

func TestReadyWhenEveryDependencyAnswersWithoutAToken(t *testing.T) {
	code, body := ready(t, Readiness{Checks: []Check{{"postgres", up}, {"object_store", up}}}, false)
	if code != http.StatusOK || !body.Ready || len(body.Checks) != 2 || !body.Checks[0].Ok || !body.Checks[1].Ok {
		t.Fatalf("got %d %+v", code, body)
	}
}

func TestNotReadyWhenADependencyFails(t *testing.T) {
	code, body := ready(t, Readiness{Checks: []Check{{"postgres", up}, {"object_store", down}}}, false)
	if code != http.StatusServiceUnavailable || body.Ready {
		t.Fatalf("got %d %+v", code, body)
	}
	if !body.Checks[0].Ok || body.Checks[1].Ok || body.Checks[1].Name != "object_store" {
		t.Fatalf("checks %+v", body.Checks)
	}
}

func TestADependencyThatHangsFailsWithinTheTimeout(t *testing.T) {
	start := time.Now()
	code, body := ready(t, Readiness{Checks: []Check{{"postgres", hung}}, Timeout: 50 * time.Millisecond}, false)
	if code != http.StatusServiceUnavailable || body.Checks[0].Ok {
		t.Fatalf("got %d %+v", code, body)
	}
	if time.Since(start) > time.Second {
		t.Fatalf("readiness took %s", time.Since(start))
	}
}

func TestReadyWithNoChecksIsReady(t *testing.T) {
	if code, body := ready(t, Readiness{}, true); code != http.StatusOK || !body.Ready {
		t.Fatalf("got %d %+v", code, body)
	}
}
