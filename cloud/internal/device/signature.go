// Package device handles device registration, revocation and request-signature verification.
package device

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

const (
	HeaderDeviceID  = "X-Device-Id"
	HeaderTimestamp = "X-Device-Timestamp"
	HeaderSignature = "X-Device-Signature"
	MaxSkew         = 5 * time.Minute
)

// SigningString is what the device signs: METHOD\nPATH\nTIMESTAMP\nsha256hex(body).
func SigningString(method, path, timestamp string, body []byte) []byte {
	sum := sha256.Sum256(body)
	return []byte(method + "\n" + path + "\n" + timestamp + "\n" + hex.EncodeToString(sum[:]))
}

type keyEntry struct {
	key    ed25519.PublicKey
	status string
	at     time.Time
}

// Verifier is middleware: once a request identifies a device (header or token claim), the Ed25519
// signature over the request must verify against the registered public key and the device must be active.
type Verifier struct {
	DB    *store.DB
	mu    sync.Mutex
	cache map[string]keyEntry
}

func NewVerifier(db *store.DB) *Verifier { return &Verifier{DB: db, cache: map[string]keyEntry{}} }

func (v *Verifier) lookup(c echo.Context, id string) (keyEntry, bool) {
	v.mu.Lock()
	e, ok := v.cache[id]
	v.mu.Unlock()
	if ok && time.Since(e.at) < time.Minute {
		return e, true
	}
	var d *store.Device
	err := v.DB.WithTx(c.Request().Context(), store.Scope{DeviceID: id}, func(tx pgx.Tx) error {
		var err error
		d, err = store.GetDevice(c.Request().Context(), tx, id)
		return err
	})
	if err != nil {
		return keyEntry{}, false
	}
	raw, err := base64.StdEncoding.DecodeString(d.PublicKey)
	if err != nil || len(raw) != ed25519.PublicKeySize {
		return keyEntry{}, false
	}
	e = keyEntry{key: ed25519.PublicKey(raw), status: d.Status, at: time.Now()}
	v.mu.Lock()
	v.cache[id] = e
	v.mu.Unlock()
	return e, true
}

// Invalidate drops a cached key (after revoke / re-register).
func (v *Verifier) Invalidate(id string) { v.mu.Lock(); delete(v.cache, id); v.mu.Unlock() }

func (v *Verifier) Middleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := c.Request()
		id := req.Header.Get(HeaderDeviceID)
		if id == "" {
			if cl := auth.ClaimsFrom(c); cl != nil && cl.Device != "" {
				id = cl.Device
			}
		}
		if id == "" {
			return next(c) // no device context: a plain user session (web admin, first login)
		}
		ts := req.Header.Get(HeaderTimestamp)
		sig := req.Header.Get(HeaderSignature)
		if ts == "" || sig == "" {
			return httpx.Unauthorized(c, "DEVICE_SIGNATURE_MISSING", "device requests must be signed")
		}
		unix, err := strconv.ParseInt(ts, 10, 64)
		if err != nil {
			return httpx.Unauthorized(c, "DEVICE_SIGNATURE_INVALID", "bad timestamp")
		}
		skew := time.Since(time.Unix(unix, 0))
		if skew > MaxSkew || skew < -MaxSkew {
			return httpx.Unauthorized(c, "DEVICE_CLOCK_SKEW", "device clock differs from server by more than 5 minutes")
		}
		e, ok := v.lookup(c, id)
		if !ok {
			return httpx.Unauthorized(c, "DEVICE_UNKNOWN", "device not registered")
		}
		if e.status != "active" {
			return httpx.Unauthorized(c, "DEVICE_REVOKED", "device is "+e.status)
		}
		body, err := io.ReadAll(req.Body)
		if err != nil {
			return httpx.Internal(c, err)
		}
		req.Body = io.NopCloser(bytes.NewReader(body))
		sigBytes, err := base64.StdEncoding.DecodeString(sig)
		if err != nil || !ed25519.Verify(e.key, SigningString(req.Method, req.URL.Path, ts, body), sigBytes) {
			return httpx.Unauthorized(c, "DEVICE_SIGNATURE_INVALID", "signature does not verify")
		}
		c.Set("muneem.device_id", id)
		c.Set("muneem.device_skew_ms", int(skew.Milliseconds()))
		return next(c)
	}
}

var _ = http.StatusOK
