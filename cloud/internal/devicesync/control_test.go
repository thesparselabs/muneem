package devicesync_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

func TestRevokingADeviceTellsTheOthersAndLocksItOut(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	c.push(b, f.request(f.find("uom")))
	if code, body := c.do(a, http.MethodPost, "/v1/devices/"+b.id+"/revoke", nil, nil); code != http.StatusOK {
		t.Fatalf("revoke: HTTP %d %s", code, body)
	}
	ch := c.lastChange(a, f.businessID, "control", devicesync.ControlDevice, b.id)
	if p := decodeMap(t, ch.Payload); p["status"] != "revoked" || ch.OriginDeviceID != nil {
		t.Fatalf("control change %+v", p)
	}
	for _, call := range []func() int{
		func() int { code, _ := c.push(b, f.request(f.find("uom"))); return code },
		func() int { code, _ := c.pull(b, f.businessID, "control", 0); return code },
	} {
		if code := call(); code != http.StatusUnauthorized {
			t.Fatalf("revoked device: HTTP %d", code)
		}
	}
	if _, body := c.do(b, http.MethodGet, "/v1/sync/pull", nil, nil); !strings.Contains(string(body), "DEVICE_REVOKED") {
		t.Fatalf("revoked device should be told so: %s", body)
	}
}

func TestAPushedLockMakesLaterDocumentsLateArrivals(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.without("sale", "payment")...))
	period := ulid.Make().String()
	lock := newOp("accounting_period", period, "update", map[string]any{
		"id": period, "fy": "2026-27", "periodStart": "2026-10-01", "periodEnd": "2026-10-31", "status": "locked", "lockedAt": "2026-11-01T03:30:00.000Z",
	})
	if r := c.pushOne(b, f.request(lock)); r.Status != devicesync.StatusApplied {
		t.Fatalf("lock: %+v", r)
	}
	if r := c.pushOne(a, f.request(f.find("sale"))); r.Status != devicesync.StatusApplied {
		t.Fatalf("a late sale is still stored: %+v", r)
	}
	if kinds := c.reviewKinds(a, f.businessID); kinds["late_arrival"] != 1 {
		t.Fatalf("review items %v", kinds)
	}
	if ch := c.lastChange(a, f.businessID, "control", "accounting_period", period); ch.OriginDeviceID == nil || *ch.OriginDeviceID != b.id {
		t.Fatalf("the lock travels on the control stream from B: %+v", ch)
	}
}
