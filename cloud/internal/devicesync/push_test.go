package devicesync_test

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

const protocolFixtures = "../../../packages/contracts/fixtures/sync/"

// flow is the real recorded flow behind the protocol fixtures: a business created offline, its setup, a credit sale
// and a receipt.
type flow struct {
	businessID string
	ops        []devicesync.Operation
}

func loadFlow(t *testing.T) flow {
	raw, err := os.ReadFile(protocolFixtures + "push-applied-then-duplicate.json")
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

func (f flow) find(entityType string) devicesync.Operation {
	for _, o := range f.ops {
		if o.EntityType == entityType {
			return o
		}
	}
	panic("no " + entityType)
}

func (f flow) without(types ...string) []devicesync.Operation {
	skip := map[string]bool{}
	for _, t := range types {
		skip[t] = true
	}
	var out []devicesync.Operation
	for _, o := range f.ops {
		if !skip[o.EntityType] {
			out = append(out, o)
		}
	}
	return out
}

func (f flow) request(ops ...devicesync.Operation) map[string]any {
	return map[string]any{"businessId": f.businessID, "protocol": 1, "schemaVersion": 14, "clientTime": "2026-10-04T10:00:00Z", "operations": ops}
}

// newOp makes a fresh operation the way a device would: a new id and the payload's hash.
func newOp(entityType, entityID, operationType string, payload any) devicesync.Operation {
	raw, _ := json.Marshal(payload)
	sum := sha256.Sum256(raw)
	return devicesync.Operation{OperationID: ulid.Make().String(), Seq: 5000, EntityType: entityType, EntityID: entityID, OperationType: operationType,
		PayloadHash: "sha256:" + hex.EncodeToString(sum[:]), Payload: raw}
}

func payloadOf(t *testing.T, o devicesync.Operation) map[string]any {
	var m map[string]any
	if err := json.Unmarshal(o.Payload, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func setup(t *testing.T) (*cloud, flow, *testDevice) {
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	return c, loadFlow(t), c.registerDevice()
}

func (c *cloud) pushOne(d *testDevice, request any) devicesync.Result {
	c.t.Helper()
	code, res := c.push(d, request)
	if code != http.StatusOK || len(res.Results) != 1 {
		c.t.Fatalf("HTTP %d, results %+v", code, res.Results)
	}
	return res.Results[0]
}

func expectError(t *testing.T, r devicesync.Result, status, code, class string) {
	t.Helper()
	if r.Status != status || r.Error == nil || r.Error.Code != code || r.Error.Class != class {
		t.Fatalf("got %+v %+v, want %s %s/%s", r, r.Error, status, code, class)
	}
}

func TestOperationIDReusedWithAnotherPayloadIsRejected(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	uom := f.find("uom")
	uom.PayloadHash = "sha256:" + hex.EncodeToString(make([]byte, 32))
	expectError(t, c.pushOne(a, f.request(uom)), devicesync.StatusRejected, devicesync.CodePayloadInvalid, "permanent")
	if n := c.count(`SELECT COUNT(*)::int FROM dead_letter WHERE operation_id = $1`, uom.OperationID); n != 1 {
		t.Fatalf("dead letters %d", n)
	}
}

func TestOperationsForAnUnknownBusinessWait(t *testing.T) {
	c, f, a := setup(t)
	expectError(t, c.pushOne(a, f.request(f.find("uom"))), devicesync.StatusDeferred, devicesync.CodeBusinessUnknown, "transient")
}

func TestABusinessFromAnotherOrganizationIsRefused(t *testing.T) {
	c, f, a := setup(t)
	biz := f.find("business")
	p := payloadOf(t, biz)
	p["organizationId"] = "01J00000000000000000000Z99"
	op := newOp("business", f.businessID, "create", p)
	expectError(t, c.pushOne(a, f.request(op)), devicesync.StatusRejected, devicesync.CodePayloadInvalid, "permanent")
	if n := c.count(`SELECT COUNT(*)::int FROM business`); n != 0 {
		t.Fatalf("business created: %d", n)
	}
}

func TestATamperedSaleIsDeadLetteredWholeAndStaysRejected(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.without("sale", "payment")...))
	p := payloadOf(t, f.find("sale"))
	p["totals"].(map[string]any)["totalPaise"] = 23700.0
	sale := newOp("sale", f.find("sale").EntityID, "create", p)
	for range 2 {
		expectError(t, c.pushOne(a, f.request(sale)), devicesync.StatusRejected, devicesync.CodeTotalMismatch, "permanent")
	}
	var stored map[string]any
	if err := c.db.Pool.QueryRow(t.Context(), `SELECT operation->'payload' FROM dead_letter WHERE operation_id = $1 LIMIT 1`, sale.OperationID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored["totals"].(map[string]any)["totalPaise"] != 23700.0 {
		t.Fatalf("dead letter lost the payload: %v", stored["totals"])
	}
	if n := c.count(`SELECT COUNT(*)::int FROM entity_state WHERE entity_type = 'sale'`) + c.count(`SELECT COUNT(*)::int FROM journal_entry`); n != 0 {
		t.Fatalf("a rejected sale left %d rows", n)
	}
}

func TestUnknownEntityTypesWaitForAnUpgrade(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.find("business")))
	op := newOp("hologram", ulid.Make().String(), "create", map[string]any{"id": "x"})
	expectError(t, c.pushOne(a, f.request(op)), devicesync.StatusDeferred, devicesync.CodeUnknownEntity, "transient")
}

func TestPushBookkeepingAndProjection(t *testing.T) {
	c, f, a := setup(t)
	code, res := c.push(a, f.request(f.ops...))
	if code != http.StatusOK || res.NextPullSeq == 0 {
		t.Fatalf("HTTP %d next %d", code, res.NextPullSeq)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM device WHERE id = $1 AND business_id = $2 AND last_push_seq = 71 AND clock_skew_ms IS NOT NULL`, a.id, f.businessID); n != 1 {
		t.Fatal("device bookkeeping not updated")
	}
	if n := c.count(`SELECT COUNT(*)::int FROM business_membership WHERE business_id = $1 AND roles_json ? 'owner'`, f.businessID); n != 1 {
		t.Fatal("owner membership missing")
	}
	if n := c.count(`SELECT COUNT(*)::int FROM journal_entry WHERE business_id = $1`, f.businessID); n != 2 {
		t.Fatalf("journals projected: %d", n)
	}
	if n := c.count(`SELECT (SUM(debit_paise) - SUM(credit_paise))::int FROM journal_line`); n != 0 {
		t.Fatalf("trial balance off by %d", n)
	}
}

// A double submit racing itself applies each operation once; the other copy is a duplicate.
func TestConcurrentDoubleSubmitAppliesOnce(t *testing.T) {
	c, f, a := setup(t)
	done := make(chan devicesync.PushResponse, 2)
	for range 2 {
		go func() { _, res := c.push(a, f.request(f.ops...)); done <- res }()
	}
	statuses := map[string]int{}
	for range 2 {
		for _, r := range (<-done).Results {
			statuses[r.Status]++
		}
	}
	if statuses[devicesync.StatusApplied] != len(f.ops) || statuses[devicesync.StatusDuplicate] != len(f.ops) {
		t.Fatalf("statuses %v", statuses)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM change_log`); n != len(f.ops) {
		t.Fatalf("change_log rows %d, want %d", n, len(f.ops))
	}
}

func TestGzippedPushAndBatchLimit(t *testing.T) {
	c, f, a := setup(t)
	body, _ := json.Marshal(f.request(f.find("business")))
	var zipped bytes.Buffer
	w := gzip.NewWriter(&zipped)
	_, _ = w.Write(body)
	_ = w.Close()
	if code, _ := c.doGzip(a, zipped.Bytes()); code != http.StatusOK {
		t.Fatalf("gzip push: HTTP %d", code)
	}
	ops := make([]devicesync.Operation, devicesync.PushMaxOperations+1)
	for i := range ops {
		ops[i] = f.find("uom")
	}
	if code, _ := c.push(a, f.request(ops...)); code != http.StatusUnprocessableEntity {
		t.Fatalf("201 operations: HTTP %d", code)
	}
}

func TestADeviceBoundToAnotherBusinessCannotPushHere(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.find("business")))
	other := map[string]any{"businessId": ulid.Make().String(), "protocol": 1, "schemaVersion": 14, "clientTime": "2026-10-04T10:00:00Z",
		"operations": []devicesync.Operation{f.find("uom")}}
	if code, _ := c.push(a, other); code != http.StatusNotFound {
		t.Fatalf("HTTP %d", code)
	}
}

func TestProtocolMismatchIsRefused(t *testing.T) {
	c, f, a := setup(t)
	req := f.request(f.find("business"))
	req["protocol"] = 2
	if code, _ := c.push(a, req); code != http.StatusUpgradeRequired {
		t.Fatalf("HTTP %d", code)
	}
}
