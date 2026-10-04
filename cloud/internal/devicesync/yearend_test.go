package devicesync_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// yearCloseFlow is the desktop's recorded flow behind year-close-once.json: a business, a March sale, its set-off, twelve
// locked months and the close of 2025-26.
func yearCloseFlow(t *testing.T) flow {
	raw, err := os.ReadFile(protocolFixtures + "year-close-once.json")
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Steps []struct {
			Request struct {
				BusinessID string                 `json:"businessId"`
				Operations []devicesync.Operation `json:"operations"`
			} `json:"request"`
		} `json:"steps"`
	}
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	return flow{businessID: fx.Steps[0].Request.BusinessID, ops: fx.Steps[0].Request.Operations}
}

// adjustment is version 2 of a close: the held closings and one more, closing `paise` of rent to retained earnings.
func adjustment(t *testing.T, close devicesync.Operation, paise int64) devicesync.Operation {
	p := payloadOf(t, close)
	id := ulid.Make().String()
	journal := map[string]any{
		"id": id, "entryNo": "CL/2526/2", "entryDate": "2026-03-31", "docDate": "2026-03-31", "periodId": id, "source": "closing", "refType": "fy_close",
		"refId": close.EntityID + ":2", "narration": nil, "branchId": nil, "terminalId": nil, "latePosting": false, "reversalOf": nil,
		"lines": []any{
			map[string]any{"account": map[string]any{"code": "5400"}, "debitPaise": 0, "creditPaise": paise},
			map[string]any{"account": map[string]any{"role": "retained_earnings"}, "debitPaise": paise, "creditPaise": 0},
		},
	}
	p["version"] = 2
	p["closings"] = append(p["closings"].([]any), map[string]any{"version": 2, "journal": journal,
		"balances": []any{map[string]any{"code": "5400", "type": "expense", "netPaise": paise}}})
	return newOp("fy_close", close.EntityID, "update", p)
}

func TestAYearClosesOnceAndAdjustsInOrder(t *testing.T) {
	c, _, a := setup(t)
	b := c.registerDevice()
	f := yearCloseFlow(t)
	close := f.find("fy_close")
	if code, res := c.push(a, f.request(f.ops...)); code != 200 || res.Results[len(res.Results)-1].Status != devicesync.StatusApplied {
		t.Fatalf("HTTP %d, close %+v", code, res.Results[len(res.Results)-1])
	}
	if n := c.count(`SELECT COUNT(*)::int FROM journal_entry WHERE source = 'closing'`); n != 1 {
		t.Fatalf("closing journals projected: %d", n)
	}

	second := payloadOf(t, close)
	second["id"] = ulid.Make().String()
	if r := c.pushOne(b, f.request(newOp("fy_close", second["id"].(string), "create", second))); r.Status != devicesync.StatusRejected || r.Error.Code != devicesync.CodeInvalidState {
		t.Fatalf("a second close of the year: %+v", r)
	}

	if r := c.pushOne(a, f.request(adjustment(t, close, 1_000))); r.Status != devicesync.StatusApplied {
		t.Fatalf("adjustment: %+v", r)
	}
	if r := c.pushOne(b, f.request(adjustment(t, close, 2_000))); r.Status != devicesync.StatusRejected || r.Error.Code != devicesync.CodeInvalidState {
		t.Fatalf("an adjustment made from version 1 after version 2: %+v", r)
	}
	ch := c.lastChange(b, f.businessID, "control", "fy_close", close.EntityID)
	if p := decodeMap(t, ch.Payload); p["version"] != 2.0 || ch.Version != 2 || ch.OriginDeviceID == nil || *ch.OriginDeviceID != a.id {
		t.Fatalf("B pulls A's adjusted close: %+v %v", ch, p)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM journal_entry WHERE source = 'closing'`); n != 2 {
		t.Fatalf("closing journals projected: %d", n)
	}
	if d := c.count(`SELECT (SUM(debit_paise) - SUM(credit_paise))::int FROM journal_line`); d != 0 {
		t.Fatalf("cloud trial balance off by %d", d)
	}

	early := payloadOf(t, close)
	early["id"], early["fy"], early["fyEnd"], early["closings"] = ulid.Make().String(), "2024-25", "2025-03-31", []any{map[string]any{"version": 1, "journal": nil, "balances": []any{}}}
	if r := c.pushOne(a, f.request(newOp("fy_close", early["id"].(string), "create", early))); r.Status != devicesync.StatusRejected || r.Error.Code != devicesync.CodeInvalidState {
		t.Fatalf("a close of a year with open months: %+v", r)
	}
}
