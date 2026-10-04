package devicesync_test

import (
	"net/http"
	"testing"
	"time"
)

func TestAPushHeartbeatLandsOnTheDevice(t *testing.T) {
	c, f, a := setup(t)
	req := f.request(f.ops...)
	req["heartbeat"] = map[string]any{"outboxDepth": 42, "oldestPendingAt": "2026-10-04T09:00:00Z", "negativeStockCount": 3}
	if code, _ := c.push(a, req); code != http.StatusOK {
		t.Fatalf("HTTP %d", code)
	}
	var depth, negative int
	var oldest, beat *time.Time
	err := c.db.Pool.QueryRow(t.Context(), `SELECT outbox_depth, oldest_pending_at, negative_stock_count, heartbeat_at FROM device WHERE id = $1`, a.id).
		Scan(&depth, &oldest, &negative, &beat)
	if err != nil {
		t.Fatal(err)
	}
	if depth != 42 || negative != 3 || oldest == nil || !oldest.Equal(time.Date(2026, 10, 4, 9, 0, 0, 0, time.UTC)) || beat == nil {
		t.Fatalf("depth %d, negative %d, oldest %v, heartbeat %v", depth, negative, oldest, beat)
	}
}

func TestAnAbsurdHeartbeatNeverFailsThePush(t *testing.T) {
	c, f, a := setup(t)
	req := f.request(f.ops...)
	req["heartbeat"] = map[string]any{"outboxDepth": 1 << 40, "oldestPendingAt": nil, "negativeStockCount": -5}
	if code, res := c.push(a, req); code != http.StatusOK || len(res.Results) != len(f.ops) {
		t.Fatalf("HTTP %d, %d results", code, len(res.Results))
	}
	if n := c.count(`SELECT outbox_depth FROM device WHERE id = $1`, a.id); n != 1<<31-1 {
		t.Fatalf("depth stored as %d", n)
	}
	if n := c.count(`SELECT negative_stock_count FROM device WHERE id = $1`, a.id); n != 0 {
		t.Fatalf("negative stock stored as %d", n)
	}
}

func TestAPushWithoutAHeartbeatLeavesTheLastOne(t *testing.T) {
	c, f, a := setup(t)
	req := f.request(f.without("sale", "payment")...)
	req["heartbeat"] = map[string]any{"outboxDepth": 2, "oldestPendingAt": nil, "negativeStockCount": 0}
	c.push(a, req)
	c.push(a, f.request(f.find("sale")))
	if n := c.count(`SELECT outbox_depth FROM device WHERE id = $1`, a.id); n != 2 {
		t.Fatalf("depth %d", n)
	}
}

func TestTheNewestIntegrityReportIsKept(t *testing.T) {
	c, f, a := setup(t)
	report := func(at string, failures int) map[string]any {
		return map[string]any{"outboxDepth": 0, "oldestPendingAt": nil, "negativeStockCount": 0, "integrity": map[string]any{
			"checkedAt": at, "tieOutFailures": failures, "replayMismatches": 0, "auditChainOk": true, "journalCount": 2,
			"journalDebitPaise": 1000, "journalCreditPaise": 1000, "documentsSeq": 7, "outboxDepth": 0}}
	}
	req := f.request(f.without("sale", "payment")...)
	req["heartbeat"] = report("2026-10-05T02:00:00Z", 1)
	c.push(a, req)
	late := f.request(f.find("sale"))
	late["heartbeat"] = report("2026-10-04T20:00:00Z", 5)
	c.push(a, late)
	if n := c.count(`SELECT tie_out_failures FROM device_integrity WHERE device_id = $1`, a.id); n != 1 {
		t.Fatalf("tie-out failures %d: an older report replaced a newer one", n)
	}
	if n := c.count(`SELECT documents_seq::int FROM device_integrity WHERE device_id = $1`, a.id); n != 7 {
		t.Fatalf("documents seq %d", n)
	}
}
