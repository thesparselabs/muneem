package devicesync_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// auditFlow is the recorded audit chain fixture: the business, five audit rows in order, and the two refused rows.
type auditFlow struct {
	businessID string
	business   devicesync.Operation
	rows       []devicesync.Operation
	tampered   devicesync.Operation
	forged     devicesync.Operation
}

func loadAuditFlow(t *testing.T) auditFlow {
	raw, err := os.ReadFile(protocolFixtures + "push-audit-chain.json")
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
	s := fx.Steps
	first := s[0].Request.Operations
	return auditFlow{
		businessID: s[0].Request.BusinessID, business: first[0],
		rows:     append(append(append([]devicesync.Operation{}, first[1:]...), s[2].Request.Operations...), s[5].Request.Operations...),
		tampered: s[4].Request.Operations[0], forged: s[4].Request.Operations[1],
	}
}

func (f auditFlow) request(ops ...devicesync.Operation) map[string]any {
	return map[string]any{"businessId": f.businessID, "protocol": 1, "schemaVersion": 14, "clientTime": "2026-10-04T10:00:00Z", "operations": ops}
}

func TestAuditRowsAreKeptPerChainAndNeverPulled(t *testing.T) {
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	a, b := c.registerDevice(), c.registerDevice()
	f := loadAuditFlow(t)
	if code, res := c.push(a, f.request(append([]devicesync.Operation{f.business}, f.rows...)...)); code != http.StatusOK || len(res.Results) != 6 {
		t.Fatalf("HTTP %d %+v", code, res.Results)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM audit_entry WHERE business_id = $1`, f.businessID); n != 5 {
		t.Fatalf("audit entries %d", n)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM change_log WHERE entity_type = 'audit_entry'`); n != 0 {
		t.Fatalf("audit rows reached the change log: %d", n)
	}
	for _, stream := range []string{"control", "config", "masters", "documents"} {
		_, page := c.pull(b, f.businessID, stream, 0)
		for _, ch := range page.Changes {
			if ch.EntityType == "audit_entry" {
				t.Fatalf("%s pulled an audit row", stream)
			}
		}
	}
	if code, _ := c.pull(b, f.businessID, "audit", 0); code != http.StatusUnprocessableEntity {
		t.Fatalf("the audit stream is not pullable: HTTP %d", code)
	}
	if r := c.pushOne(b, f.request(f.rows[1])); r.Status != devicesync.StatusDuplicate {
		t.Fatalf("another device resending a held row: %+v", r)
	}
}

func TestABrokenChainIsRefusedDeadLetteredAndListedOnce(t *testing.T) {
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	a, b := c.registerDevice(), c.registerDevice()
	f := loadAuditFlow(t)
	c.push(a, f.request(append([]devicesync.Operation{f.business}, f.rows[:4]...)...))
	for i := 0; i < 2; i++ {
		expectError(t, c.pushOne(a, f.request(f.tampered)), devicesync.StatusRejected, devicesync.CodeAuditChainBroken, "permanent")
	}
	expectError(t, c.pushOne(a, f.request(f.forged)), devicesync.StatusRejected, devicesync.CodeAuditChainBroken, "permanent")
	if n := c.count(`SELECT COUNT(*)::int FROM dead_letter WHERE error_code = 'AUDIT_CHAIN_BROKEN'`); n != 3 {
		t.Fatalf("dead letters %d", n)
	}
	if kinds := c.reviewKinds(b, f.businessID); kinds["audit_chain_broken"] != 2 {
		t.Fatalf("one review item per refused operation: %v", kinds)
	}
	if r := c.pushOne(a, f.request(f.rows[4])); r.Status != devicesync.StatusApplied {
		t.Fatalf("the genuine row still links: %+v", r)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM audit_entry WHERE business_id = $1`, f.businessID); n != 5 {
		t.Fatalf("audit entries %d", n)
	}
}

func TestAuditRowsWaitForTheirBusinessAndTheirPredecessor(t *testing.T) {
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	a := c.registerDevice()
	f := loadAuditFlow(t)
	expectError(t, c.pushOne(a, f.request(f.rows[0])), devicesync.StatusDeferred, devicesync.CodeBusinessUnknown, "transient")
	c.push(a, f.request(f.business, f.rows[0]))
	expectError(t, c.pushOne(a, f.request(f.rows[2])), devicesync.StatusDeferred, devicesync.CodeDependencyMissing, "dependency")
	_, res := c.push(a, f.request(f.rows[1], f.rows[2]))
	for _, r := range res.Results {
		if r.Status != devicesync.StatusApplied {
			t.Fatalf("the gap filled: %+v", res.Results)
		}
	}
	bad := f.rows[3]
	bad.Payload = json.RawMessage(`{"id":"x"}`)
	expectError(t, c.pushOne(a, f.request(bad)), devicesync.StatusRejected, devicesync.CodePayloadInvalid, "permanent")
}
