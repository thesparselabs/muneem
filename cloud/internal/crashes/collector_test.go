package crashes_test

import (
	"bytes"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/crashes"
)

const key = "0123456789abcdef0123"

// pii is what a careless client could put in an event; none of it may reach the log.
var pii = []string{"Ramesh Kumar", "9876543210", "27AAPFU0939F1ZV", "ramesh@example.com", "INV-2026-00042", "C:\\Users\\ramesh", "Sharma Store", "secret-token"}

const leakyEvent = `{"event_id":"abc123","level":"error","platform":"node","release":"muneem@1.2.0","environment":"production",
 "user":{"id":"u1","username":"Ramesh Kumar","email":"ramesh@example.com"},
 "request":{"headers":{"Authorization":"Bearer secret-token"}},
 "breadcrumbs":[{"message":"sale INV-2026-00042 for Ramesh Kumar"}],
 "extra":{"customer":"Ramesh Kumar","phone":"9876543210"},
 "contexts":{"business":{"name":"Sharma Store"}},
 "tags":{"kind":"uncaught","process":"main","os":"win32 10.0.19045","schema_version":"20","installation":"5f2c9a0b","customerName":"Ramesh Kumar"},
 "exception":{"values":[{"type":"TypeError","value":"cannot read 'Ramesh Kumar' of customer 9876543210 (27AAPFU0939F1ZV, ramesh@example.com) at C:\\Users\\ramesh\\AppData\\x.js",
   "stacktrace":{"frames":[{"filename":"C:\\Users\\ramesh\\AppData\\Local\\muneem\\app.asar\\main.js","function":"completeSale","lineno":120,
     "vars":{"customer":"Ramesh Kumar"},"context_line":"const name = 'Ramesh Kumar'"}]}}]}}`

type harness struct {
	e   *echo.Echo
	log *bytes.Buffer
	dir string
}

func newHarness(t *testing.T) harness {
	var buf bytes.Buffer
	opt := crashes.DefaultOptions
	opt.Key, opt.Dir = key, t.TempDir()
	c := &crashes.Collector{Opt: opt, Log: slog.New(slog.NewJSONHandler(&buf, nil))}
	e := echo.New()
	c.Routes(e, func(next echo.HandlerFunc) echo.HandlerFunc { return next })
	return harness{e: e, log: &buf, dir: opt.Dir}
}

func (h harness) post(path, contentType string, body []byte) int {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	h.e.ServeHTTP(rec, req)
	return rec.Code
}

func noPII(t *testing.T, out string) {
	t.Helper()
	for _, s := range pii {
		if strings.Contains(out, s) {
			t.Errorf("%q leaked into %s", s, out)
		}
	}
}

func TestAStoredEventKeepsOnlyAllowListedFields(t *testing.T) {
	h := newHarness(t)
	if code := h.post("/api/1/store/?sentry_key="+key, "application/json", []byte(leakyEvent)); code != http.StatusOK {
		t.Fatalf("HTTP %d", code)
	}
	out := h.log.String()
	noPII(t, out)
	for _, want := range []string{`"release":"muneem@1.2.0"`, `"kind":"uncaught"`, `"schema_version":"20"`, `"installation":"5f2c9a0b"`,
		`"type":"TypeError"`, `completeSale (main.js:120)`, `[number]`, `[gstin]`, `[email]`} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %s in %s", want, out)
		}
	}
}

func TestAnEnvelopeRecordsItsEventItems(t *testing.T) {
	h := newHarness(t)
	body := `{"event_id":"abc123","dsn":"https://` + key + `@crash.test/1"}` + "\n" +
		`{"type":"session"}` + "\n" + `{"sid":"x","did":"Ramesh Kumar"}` + "\n" +
		`{"type":"event"}` + "\n" + strings.ReplaceAll(leakyEvent, "\n", "") + "\n"
	if code := h.post("/api/1/envelope/?sentry_key="+key, "application/x-sentry-envelope", []byte(body)); code != http.StatusOK {
		t.Fatalf("HTTP %d", code)
	}
	noPII(t, h.log.String())
	if n := strings.Count(h.log.String(), `"msg":"crash report"`); n != 1 {
		t.Fatalf("%d reports recorded", n)
	}
}

func TestAReportWithoutTheKeyIsRefused(t *testing.T) {
	h := newHarness(t)
	for _, path := range []string{"/api/1/store/", "/api/1/store/?sentry_key=wrong", "/api/x/store/?sentry_key=" + key} {
		if code := h.post(path, "application/json", []byte(`{}`)); code == http.StatusOK {
			t.Errorf("%s accepted", path)
		}
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/1/store/", strings.NewReader(`{}`))
	req.Header.Set("X-Sentry-Auth", "Sentry sentry_version=7, sentry_key="+key+", sentry_client=muneem/1")
	h.e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("X-Sentry-Auth refused: HTTP %d", rec.Code)
	}
}

func TestAnOversizedEventIsRefused(t *testing.T) {
	h := newHarness(t)
	big := `{"event_id":"x","extra":"` + strings.Repeat("a", 300<<10) + `"}`
	if code := h.post("/api/1/store/?sentry_key="+key, "application/json", []byte(big)); code != http.StatusRequestEntityTooLarge {
		t.Fatalf("HTTP %d", code)
	}
}

func TestAMinidumpIsStoredWithOnlyAllowListedFields(t *testing.T) {
	h := newHarness(t)
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for k, v := range map[string]string{"ver": "1.2.0", "process_type": "renderer", "platform": "win32", "prod": "Muneem",
		"customer": "Ramesh Kumar", "installation": "5f2c9a0b", "guid": "9876543210"} {
		_ = w.WriteField(k, v)
	}
	f, _ := w.CreateFormFile("upload_file_minidump", "crash.dmp")
	_, _ = f.Write([]byte("MDMP fake"))
	_ = w.Close()
	if code := h.post("/api/1/minidump/?sentry_key="+key, w.FormDataContentType(), body.Bytes()); code != http.StatusOK {
		t.Fatalf("HTTP %d", code)
	}
	files, _ := filepath.Glob(filepath.Join(h.dir, "*.json"))
	if len(files) != 1 {
		t.Fatalf("%d sidecars", len(files))
	}
	sidecar, _ := os.ReadFile(files[0])
	noPII(t, string(sidecar)+h.log.String())
	if !strings.Contains(string(sidecar), `"process":"renderer"`) {
		t.Fatalf("sidecar %s", sidecar)
	}
}

func TestPruneDropsOldAndExcessDumps(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	write := func(at time.Time) {
		id := strings.ToLower(ulid.MustNew(ulid.Timestamp(at), nil).String())
		_ = os.WriteFile(filepath.Join(dir, id+".dmp"), []byte("x"), 0o600)
		_ = os.WriteFile(filepath.Join(dir, id+".json"), []byte("{}"), 0o600)
	}
	write(now.Add(-40 * 24 * time.Hour))
	for i := range 3 {
		write(now.Add(-time.Duration(3-i) * time.Hour))
	}
	opt := crashes.DefaultOptions
	opt.Dir, opt.MaxDumps = dir, 2
	n, err := (&crashes.Collector{Opt: opt, Log: slog.Default()}).Prune()
	if err != nil || n != 2 {
		t.Fatalf("removed %d, %v", n, err)
	}
	if left, _ := filepath.Glob(filepath.Join(dir, "*")); len(left) != 4 {
		t.Fatalf("%d files left", len(left))
	}
}
