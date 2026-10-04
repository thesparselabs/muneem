package devicesync_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// MUNEEM_SYNC_CENSUS points at a dump of a seeded soak's outbox ({businessId, operations}). Pushed in order in batches
// of 200, every operation must apply: no false rejection, no stuck dependency, and the cloud's books must balance.
func TestCensusIngests(t *testing.T) {
	path := os.Getenv("MUNEEM_SYNC_CENSUS")
	if path == "" {
		t.Skip("MUNEEM_SYNC_CENSUS not set")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var dump struct {
		BusinessID string                 `json:"businessId"`
		Operations []devicesync.Operation `json:"operations"`
	}
	if err := json.Unmarshal(raw, &dump); err != nil {
		t.Fatal(err)
	}
	var biz struct {
		OrganizationID string `json:"organizationId"`
	}
	_ = json.Unmarshal(dump.Operations[0].Payload, &biz)
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", biz.OrganizationID)
	a := c.registerDevice()
	statuses := map[string]int{}
	for start := 0; start < len(dump.Operations); start += devicesync.PushMaxOperations {
		batch := dump.Operations[start:min(start+devicesync.PushMaxOperations, len(dump.Operations))]
		code, res := c.push(a, map[string]any{"businessId": dump.BusinessID, "protocol": 1, "schemaVersion": 14, "clientTime": "2026-10-04T10:00:00Z", "operations": batch})
		if code != 200 {
			t.Fatalf("batch at %d: HTTP %d", start, code)
		}
		for i, r := range res.Results {
			statuses[r.Status]++
			if r.Status != devicesync.StatusApplied {
				t.Errorf("%s %s %s: %s %+v", batch[i].EntityType, batch[i].OperationType, batch[i].EntityID, r.Status, r.Error)
			}
		}
	}
	debit := c.count(`SELECT COALESCE(SUM(debit_paise) - SUM(credit_paise), 0)::int FROM journal_line`)
	t.Logf("statuses %v; journals %d; review items %d; trial balance difference %d", statuses,
		c.count(`SELECT COUNT(*)::int FROM journal_entry`), c.count(`SELECT COUNT(*)::int FROM conflict_log`), debit)
	if debit != 0 {
		t.Fatalf("cloud trial balance is off by %d", debit)
	}
}
