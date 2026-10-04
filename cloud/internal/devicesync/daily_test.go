package devicesync_test

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"testing"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

const dailyFixture = "../../../packages/contracts/fixtures/reports/daily-roundtrip.json"

type dailyDump struct {
	BusinessID string                 `json:"businessId"`
	From       string                 `json:"from"`
	To         string                 `json:"to"`
	Operations []devicesync.Operation `json:"operations"`
	Expected   struct {
		Sales    []map[string]any `json:"sales"`
		Payments []map[string]any `json:"payments"`
		Products []map[string]any `json:"products"`
		Parties  []map[string]any `json:"parties"`
	} `json:"expected"`
}

func loadDaily(t *testing.T) dailyDump {
	raw, err := os.ReadFile(dailyFixture)
	if err != nil {
		t.Fatal(err)
	}
	var d dailyDump
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatal(err)
	}
	return d
}

// 8e: a device's recorded pushes give the cloud the same daily tables and party balances the device computed.
func TestDailyAggregatesMatchTheDevice(t *testing.T) {
	d := loadDaily(t)
	c := newCloud(t)
	var biz struct {
		OrganizationID string `json:"organizationId"`
	}
	_ = json.Unmarshal(d.Operations[0].Payload, &biz)
	c.seedOwner("01J00000000000000000000A01", biz.OrganizationID)
	a := c.registerDevice()
	pushAll := func() {
		for start := 0; start < len(d.Operations); start += devicesync.PushMaxOperations {
			batch := d.Operations[start:min(start+devicesync.PushMaxOperations, len(d.Operations))]
			code, res := c.push(a, map[string]any{"businessId": d.BusinessID, "protocol": 1, "schemaVersion": 14, "clientTime": "2026-10-04T10:00:00Z", "operations": batch})
			if code != http.StatusOK {
				t.Fatalf("batch at %d: HTTP %d", start, code)
			}
			for i, r := range res.Results {
				if r.Status != devicesync.StatusApplied && r.Status != devicesync.StatusDuplicate {
					t.Fatalf("%s %s: %s %+v", batch[i].EntityType, batch[i].EntityID, r.Status, r.Error)
				}
			}
		}
	}
	pushAll()
	pushAll() // a resend is a duplicate and moves nothing

	q := url.Values{"businessId": {d.BusinessID}, "from": {d.From}, "to": {d.To}}
	code, raw := c.do(a, http.MethodGet, "/v1/reports/daily", q, nil)
	if code != http.StatusOK {
		t.Fatalf("GET /reports/daily: %d %s", code, raw)
	}
	var got api.DailyReport
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Sales) == 0 || len(got.Payments) == 0 || len(got.Products) == 0 || len(got.Parties) == 0 {
		t.Fatalf("empty aggregates: %+v", got)
	}
	same(t, "sales", d.Expected.Sales, got.Sales)
	same(t, "payments", d.Expected.Payments, got.Payments)
	same(t, "products", d.Expected.Products, got.Products)
	same(t, "parties", d.Expected.Parties, got.Parties)

	other := c.stranger()
	if code, _ := c.do(other, http.MethodGet, "/v1/reports/daily", q, nil); code != http.StatusNotFound {
		t.Fatalf("a non-member read the report: %d", code)
	}
	bad := url.Values{"businessId": {d.BusinessID}, "from": {d.To}, "to": {d.From}}
	if code, _ := c.do(a, http.MethodGet, "/v1/reports/daily", bad, nil); code != http.StatusBadRequest && code != http.StatusUnprocessableEntity {
		t.Fatalf("an inverted range was accepted: %d", code)
	}
}

// The device's rows use snake_case columns; the cloud's wire uses camelCase. Both are compared as canonical JSON.
func same[T any](t *testing.T, name string, want []map[string]any, got []T) {
	t.Helper()
	w := make([]map[string]any, 0, len(want))
	for _, r := range want {
		m := map[string]any{}
		for k, v := range r {
			if k != "business_id" {
				m[camel(k)] = v
			}
		}
		w = append(w, m)
	}
	gb, _ := json.Marshal(got)
	var g []map[string]any
	_ = json.Unmarshal(gb, &g)
	wb, _ := json.Marshal(w)
	gb, _ = json.Marshal(g)
	if string(wb) != string(gb) {
		t.Fatalf("%s differ\ndevice: %s\ncloud:  %s", name, wb, gb)
	}
}

func camel(s string) string {
	out := []byte{}
	up := false
	for i := 0; i < len(s); i++ {
		if s[i] == '_' {
			up = true
			continue
		}
		b := s[i]
		if up && b >= 'a' && b <= 'z' {
			b -= 'a' - 'A'
		}
		up = false
		out = append(out, b)
	}
	return string(out)
}
