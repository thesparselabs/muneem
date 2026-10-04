package crashes

import (
	"bufio"
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"
)

type Options struct {
	Key             string        // the DSN's public key; every report must carry it
	Dir             string        // where minidumps are kept
	MaxEventBytes   int64         // a store or envelope body
	MaxDumpBytes    int64         // a minidump upload
	Retention       time.Duration // minidumps older than this are deleted
	MaxDumps        int           // and never more than this many are kept
	RatePerIPBurst  int
	RatePerIPRefill float64
}

var DefaultOptions = Options{Dir: "/var/lib/muneem-crash", MaxEventBytes: 256 << 10, MaxDumpBytes: 10 << 20,
	Retention: 30 * 24 * time.Hour, MaxDumps: 2000, RatePerIPBurst: 20, RatePerIPRefill: 0.2}

// Collector answers the Sentry ingest endpoints a desktop uses: /api/{project}/store/, /envelope/ and /minidump/.
type Collector struct {
	Opt Options
	Log *slog.Logger
	Now func() time.Time
}

func (c *Collector) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

var projectPattern = regexp.MustCompile(`^[0-9]{1,9}$`)

// Routes mounts the endpoints; rateLimit guards every ingest route.
func (c *Collector) Routes(e *echo.Echo, rateLimit echo.MiddlewareFunc) {
	e.GET("/health", func(ctx echo.Context) error { return ctx.NoContent(http.StatusNoContent) })
	g := e.Group("/api/:project", rateLimit, c.authorize)
	g.POST("/store/", c.store)
	g.POST("/envelope/", c.envelope)
	g.POST("/minidump/", c.minidump)
}

func (c *Collector) authorize(next echo.HandlerFunc) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		if !projectPattern.MatchString(ctx.Param("project")) {
			return ctx.NoContent(http.StatusNotFound)
		}
		key := ctx.QueryParam("sentry_key")
		if key == "" {
			key = authKey(ctx.Request().Header.Get("X-Sentry-Auth"))
		}
		if c.Opt.Key == "" || subtle.ConstantTimeCompare([]byte(key), []byte(c.Opt.Key)) != 1 {
			return ctx.NoContent(http.StatusUnauthorized)
		}
		return next(ctx)
	}
}

// authKey reads sentry_key from "Sentry sentry_version=7, sentry_key=…, sentry_client=…".
func authKey(header string) string {
	for _, part := range strings.Split(strings.TrimPrefix(header, "Sentry "), ",") {
		if k, v, ok := strings.Cut(strings.TrimSpace(part), "="); ok && k == "sentry_key" {
			return v
		}
	}
	return ""
}

func (c *Collector) body(ctx echo.Context) ([]byte, error) {
	r := ctx.Request()
	raw, err := io.ReadAll(io.LimitReader(r.Body, c.Opt.MaxEventBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) > c.Opt.MaxEventBytes {
		return nil, errTooLarge
	}
	return raw, nil
}

var errTooLarge = errors.New("report too large")

func (c *Collector) refuse(ctx echo.Context, err error) error {
	if errors.Is(err, errTooLarge) {
		return ctx.NoContent(http.StatusRequestEntityTooLarge)
	}
	return ctx.NoContent(http.StatusBadRequest)
}

func (c *Collector) store(ctx echo.Context) error {
	raw, err := c.body(ctx)
	if err != nil {
		return c.refuse(ctx, err)
	}
	var event map[string]any
	if err := json.Unmarshal(raw, &event); err != nil {
		return ctx.NoContent(http.StatusBadRequest)
	}
	r := c.record(ctx.Param("project"), event)
	return ctx.JSON(http.StatusOK, map[string]string{"id": r.EventID})
}

// envelope reads newline-delimited items and records the event ones; sessions, attachments and the rest are ignored.
func (c *Collector) envelope(ctx echo.Context) error {
	raw, err := c.body(ctx)
	if err != nil {
		return c.refuse(ctx, err)
	}
	lines := bufio.NewScanner(bytes.NewReader(raw))
	lines.Buffer(make([]byte, 0, 64<<10), int(c.Opt.MaxEventBytes))
	if !lines.Scan() {
		return ctx.NoContent(http.StatusBadRequest)
	}
	var id string
	for lines.Scan() {
		var item struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(lines.Bytes(), &item); err != nil || !lines.Scan() {
			break
		}
		if item.Type != "event" {
			continue
		}
		var event map[string]any
		if json.Unmarshal(lines.Bytes(), &event) == nil {
			id = c.record(ctx.Param("project"), event).EventID
		}
	}
	return ctx.JSON(http.StatusOK, map[string]string{"id": id})
}

func (c *Collector) record(project string, event map[string]any) Report {
	r := Scrub(event)
	if r.EventID == "" {
		r.EventID = strings.ToLower(ulid.Make().String())
	}
	c.Log.Info("crash report", "project", project, "report", r)
	return r
}

var minidumpFields = map[string]string{"ver": "release", "_version": "release", "process_type": "process", "platform": "os",
	"kind": "kind", "schema_version": "schema_version", "installation": "installation"}

// minidump stores an Electron crashReporter upload; only allow-listed form fields are kept beside it.
func (c *Collector) minidump(ctx echo.Context) error {
	r := ctx.Request()
	r.Body = http.MaxBytesReader(ctx.Response(), r.Body, c.Opt.MaxDumpBytes)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		return ctx.NoContent(http.StatusRequestEntityTooLarge)
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	file, _, err := r.FormFile("upload_file_minidump")
	if err != nil {
		return ctx.NoContent(http.StatusBadRequest)
	}
	defer file.Close()
	meta := map[string]string{}
	for field, name := range minidumpFields {
		if v := r.FormValue(field); v != "" {
			meta[name] = sanitize(name, v)
		}
	}
	id := strings.ToLower(ulid.Make().String())
	if err := c.save(id, file, meta); err != nil {
		c.Log.Error("minidump not stored", "error", err)
		return ctx.NoContent(http.StatusInternalServerError)
	}
	c.Log.Info("crash report", "project", ctx.Param("project"), "report", Report{EventID: id, Kind: "native", Release: meta["release"],
		Process: meta["process"], OS: meta["os"], SchemaVersion: meta["schema_version"], Installation: meta["installation"]}, "minidump", id+".dmp")
	return ctx.String(http.StatusOK, id)
}

func (c *Collector) save(id string, dump io.Reader, meta map[string]string) error {
	if err := os.MkdirAll(c.Opt.Dir, 0o750); err != nil {
		return err
	}
	f, err := os.OpenFile(filepath.Join(c.Opt.Dir, id+".dmp"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, dump); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	sidecar, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(c.Opt.Dir, id+".json"), sidecar, 0o640)
}

// Prune deletes minidumps past the retention, then the oldest beyond MaxDumps (ids are ULIDs, so names sort by age).
func (c *Collector) Prune() (int, error) {
	entries, err := os.ReadDir(c.Opt.Dir)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var dumps []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".dmp") {
			dumps = append(dumps, strings.TrimSuffix(e.Name(), ".dmp"))
		}
	}
	removed := 0
	cutoff := c.now().Add(-c.Opt.Retention)
	for i, id := range dumps {
		parsed, err := ulid.ParseStrict(strings.ToUpper(id))
		tooOld := err == nil && ulid.Time(parsed.Time()).Before(cutoff)
		if tooOld || len(dumps)-i > c.Opt.MaxDumps {
			for _, ext := range []string{".dmp", ".json"} {
				if err := os.Remove(filepath.Join(c.Opt.Dir, id+ext)); err != nil && !errors.Is(err, os.ErrNotExist) {
					return removed, fmt.Errorf("prune %s: %w", id, err)
				}
			}
			removed++
		}
	}
	return removed, nil
}
