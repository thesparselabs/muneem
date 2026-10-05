package metrics_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/metrics"
)

func scrape(t *testing.T, h http.Handler, path string) (int, string) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	body, _ := io.ReadAll(rec.Body)
	return rec.Code, string(body)
}

func TestTheInternalHandlerExposesEveryFamily(t *testing.T) {
	m := metrics.New()
	m.ObserveRequest("POST", "/v1/sync/push", 200, 30*time.Millisecond)
	m.OperationResult("rejected", "TOTAL_MISMATCH")
	m.DeadLettered("TOTAL_MISMATCH")
	m.ObserveJob("snapshot_build", "ok", time.Second)
	m.ReadyCheck("postgres", false)
	code, body := scrape(t, m.Handler(), "/metrics")
	if code != http.StatusOK {
		t.Fatalf("HTTP %d", code)
	}
	for _, want := range []string{
		`muneem_http_requests_total{method="POST",route="/v1/sync/push",status="200"} 1`,
		`muneem_http_request_duration_seconds_bucket{method="POST",route="/v1/sync/push",le="0.05"} 1`,
		`muneem_ingest_operations_total{code="TOTAL_MISMATCH",status="rejected"} 1`,
		`muneem_dead_letters_total{code="TOTAL_MISMATCH"} 1`,
		`muneem_job_runs_total{job="snapshot_build",outcome="ok"} 1`,
		`muneem_ready_check_ok{check="postgres"} 0`,
		`go_goroutines`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s", want)
		}
	}
	if code, _ := scrape(t, m.Handler(), "/"); code != http.StatusNotFound {
		t.Fatalf("the metrics mux serves more than /metrics: HTTP %d", code)
	}
}

func TestDefaultAddressIsLoopback(t *testing.T) {
	if srv := metrics.New().Server(""); srv.Addr != "127.0.0.1:9090" {
		t.Fatalf("default metrics address %q is not loopback", srv.Addr)
	}
}

type healthOnly struct{ api.ServerInterface }

func (healthOnly) GetHealth(c echo.Context) error { return httpx.Health{}.GetHealth(c) }

// The public server labels by route template and never serves /metrics itself.
func TestThePublicServerRecordsRoutesButHidesMetrics(t *testing.T) {
	m := metrics.New()
	pass := func(next echo.HandlerFunc) echo.HandlerFunc { return next }
	e := httpx.New(httpx.Deps{Handlers: healthOnly{}, RequireAuth: pass, DeviceVerifier: pass,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Requests: m})
	if code, _ := scrape(t, e, "/v1/health"); code != http.StatusOK {
		t.Fatalf("health HTTP %d", code)
	}
	if code, _ := scrape(t, e, "/metrics"); code != http.StatusNotFound {
		t.Fatalf("the public server answered /metrics with HTTP %d", code)
	}
	scrape(t, e, "/v1/nope/01J00000000000000000000000")
	_, body := scrape(t, m.Handler(), "/metrics")
	for _, want := range []string{`route="/v1/health",status="200"`, `route="unmatched",status="404"`} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s in\n%s", want, grep(body, "muneem_http_requests_total"))
		}
	}
	if strings.Contains(body, "01J00000000000000000000000") {
		t.Fatal("a raw path leaked into a label")
	}
}

func grep(body, prefix string) string {
	var out []string
	for _, l := range strings.Split(body, "\n") {
		if strings.HasPrefix(l, prefix) {
			out = append(out, l)
		}
	}
	return strings.Join(out, "\n")
}
