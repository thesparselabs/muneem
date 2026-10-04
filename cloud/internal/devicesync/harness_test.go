package devicesync_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/backups"
	"github.com/sparselabs/muneem/cloud/internal/business"
	"github.com/sparselabs/muneem/cloud/internal/device"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/snapshot"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/objectstore"
	"github.com/sparselabs/muneem/cloud/internal/store"
	"github.com/sparselabs/muneem/cloud/internal/testdb"
)

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

// cloud is the real Echo server with the real auth and signature middleware, over the test Postgres.
type cloud struct {
	t       *testing.T
	db      *store.DB
	e       *echo.Echo
	signer  *auth.Signer
	snaps   *snapshot.Service
	objects testObjects
	user    string
	org     string
}

func newCloud(t *testing.T) *cloud {
	db := testdb.Open(t)
	testdb.Reset(t, db)
	signer := auth.NewSigner("test-secret")
	verifier := device.NewVerifier(db)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	objects := testObjectStore(t)
	snaps := snapshot.NewService(db, objects, log, snapshot.DefaultOptions)
	wrapper, err := backups.NewWrapper(TestMasterKey)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(snaps.Wait)
	h := handlers{
		authHandler:     &auth.Handler{DB: db, Signer: signer},
		deviceHandler:   &device.Handler{DB: db, Verifier: verifier, Revocations: devicesync.Control{}},
		businessHandler: &business.Handler{DB: db},
		syncHandler:     &devicesync.Handler{Ingest: &devicesync.Ingest{DB: db, Log: log}, Feed: &devicesync.Feed{DB: db}, Snapshots: snaps},
		backupHandler:   &backups.Handler{Service: backups.NewService(db, objects, wrapper, log, backups.DefaultOptions)},
	}
	e := httpx.New(httpx.Deps{Handlers: h, RequireAuth: signer.Require, DeviceVerifier: verifier.Middleware, Logger: log})
	return &cloud{t: t, db: db, e: e, signer: signer, snaps: snaps, objects: objects}
}

// TestMasterKey wraps escrowed backup keys in tests (base64 of 32 bytes).
const TestMasterKey = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="

type testObjects interface {
	snapshot.ObjectStore
	backups.ObjectStore
}

// testObjectStore is MinIO when MUNEEM_TEST_S3_ENDPOINT is set, else an in-memory store served over HTTP.
func testObjectStore(t *testing.T) testObjects {
	if endpoint := os.Getenv("MUNEEM_TEST_S3_ENDPOINT"); endpoint != "" {
		s3, err := objectstore.NewS3(context.Background(), objectstore.S3Config{Endpoint: endpoint, Bucket: envOr("MUNEEM_TEST_S3_BUCKET", "muneem-test"),
			AccessKey: os.Getenv("MUNEEM_TEST_S3_ACCESS_KEY"), SecretKey: os.Getenv("MUNEEM_TEST_S3_SECRET_KEY"), Region: os.Getenv("MUNEEM_TEST_S3_REGION")})
		if err != nil {
			t.Fatal(err)
		}
		return s3
	}
	m := objectstore.NewMemory()
	srv := httptest.NewServer(m)
	t.Cleanup(srv.Close)
	m.BaseURL = srv.URL
	return m
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (c *cloud) seedOwner(userID, orgID string) {
	c.user, c.org = userID, orgID
	err := c.db.WithTx(context.Background(), store.Scope{}, func(tx pgx.Tx) error {
		return store.CreateUserWithOrg(context.Background(), tx, store.User{ID: userID, Name: "Owner", Identifier: "owner-" + userID, PasswordHash: "x"}, orgID, "Org")
	})
	if err != nil {
		c.t.Fatal(err)
	}
}

type testDevice struct {
	id   string
	key  ed25519.PrivateKey
	user string
	org  string
}

func (c *cloud) registerDevice() *testDevice {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	d := &store.Device{ID: ulid.Make().String(), OrganizationID: c.org, RegisteredBy: c.user, InstallationID: ulid.Make().String(),
		PublicKey: base64.StdEncoding.EncodeToString(pub), Platform: "test", AppVersion: "0.0.0", SchemaVersion: 14}
	err := c.db.WithTx(context.Background(), store.Scope{UserID: c.user}, func(tx pgx.Tx) error {
		return store.InsertDevice(context.Background(), tx, d)
	})
	if err != nil {
		c.t.Fatal(err)
	}
	return &testDevice{id: d.ID, key: priv, user: c.user, org: c.org}
}

func (c *cloud) token(d *testDevice) string {
	tok, err := c.signer.Issue(auth.Claims{Org: d.org, Device: d.id, RegisteredClaims: jwt.RegisteredClaims{Subject: d.user}})
	if err != nil {
		c.t.Fatal(err)
	}
	return tok
}

func (c *cloud) do(d *testDevice, method, path string, query url.Values, body []byte) (int, []byte) {
	return c.send(d, method, path, query, body, "")
}

func (c *cloud) doGzip(d *testDevice, zipped []byte) (int, []byte) {
	return c.send(d, http.MethodPost, "/v1/sync/push", nil, zipped, "gzip")
}

func (c *cloud) send(d *testDevice, method, path string, query url.Values, body []byte, encoding string) (int, []byte) {
	c.t.Helper()
	target := path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	req := httptest.NewRequest(method, target, bytes.NewReader(body))
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	req.Header.Set("Content-Type", "application/json")
	if encoding != "" {
		req.Header.Set("Content-Encoding", encoding)
	}
	req.Header.Set("Authorization", "Bearer "+c.token(d))
	req.Header.Set(device.HeaderDeviceID, d.id)
	req.Header.Set(device.HeaderTimestamp, ts)
	req.Header.Set(device.HeaderSignature, base64.StdEncoding.EncodeToString(ed25519.Sign(d.key, device.SigningString(method, path, ts, body))))
	rec := httptest.NewRecorder()
	c.e.ServeHTTP(rec, req)
	return rec.Code, rec.Body.Bytes()
}

func (c *cloud) push(d *testDevice, request any) (int, devicesync.PushResponse) {
	c.t.Helper()
	body, err := json.Marshal(request)
	if err != nil {
		c.t.Fatal(err)
	}
	code, raw := c.do(d, http.MethodPost, "/v1/sync/push", nil, body)
	var res devicesync.PushResponse
	if code == http.StatusOK {
		if err := json.Unmarshal(raw, &res); err != nil {
			c.t.Fatal(err)
		}
	}
	return code, res
}

// stranger is a device of another organization's user.
func (c *cloud) stranger() *testDevice {
	user, org := c.user, c.org
	defer func() { c.user, c.org = user, org }()
	c.seedOwner(ulid.Make().String(), ulid.Make().String())
	return c.registerDevice()
}

func (c *cloud) pull(d *testDevice, businessID, stream string, since int64) (int, devicesync.PullResponse) {
	return c.pullLimit(d, businessID, stream, since, devicesync.PullMaxLimit)
}

func (c *cloud) pullLimit(d *testDevice, businessID, stream string, since int64, limit int) (int, devicesync.PullResponse) {
	c.t.Helper()
	q := url.Values{"businessId": {businessID}, "stream": {stream}, "since": {strconv.FormatInt(since, 10)}, "limit": {strconv.Itoa(limit)}}
	code, raw := c.do(d, http.MethodGet, "/v1/sync/pull", q, nil)
	var res devicesync.PullResponse
	if code == http.StatusOK {
		if err := json.Unmarshal(raw, &res); err != nil {
			c.t.Fatal(err)
		}
	}
	return code, res
}

func (c *cloud) count(sql string, args ...any) int {
	c.t.Helper()
	var n int
	if err := c.db.Pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		c.t.Fatal(err)
	}
	return n
}
