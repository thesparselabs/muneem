package devicesync_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// One test per row of the conflict matrix (LLD §9, ADR-0041).

func (c *cloud) lastChange(d *testDevice, businessID, stream, entityType, entityID string) *devicesync.Change {
	c.t.Helper()
	_, page := c.pull(d, businessID, stream, 0)
	for i := len(page.Changes) - 1; i >= 0; i-- {
		if ch := page.Changes[i]; ch.EntityType == entityType && ch.EntityID == entityID {
			return &ch
		}
	}
	c.t.Fatalf("no %s change for %s %s", stream, entityType, entityID)
	return nil
}

func decodeMap(t *testing.T, raw json.RawMessage) map[string]any {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func (c *cloud) reviewKinds(d *testDevice, businessID string) map[string]int {
	_, page := c.pull(d, businessID, "control", 0)
	kinds := map[string]int{}
	for _, ch := range page.Changes {
		if ch.EntityType == devicesync.ControlReviewItem {
			kinds[decodeMap(c.t, ch.Payload)["kind"].(string)]++
		}
	}
	return kinds
}

func edited(t *testing.T, o devicesync.Operation, edits map[string]any) devicesync.Operation {
	p := payloadOf(t, o)
	for k, v := range edits {
		p[k] = v
	}
	return newOp(o.EntityType, o.EntityID, "update", p)
}

func TestDocumentsAreAppendOnly(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	sale := f.find("sale")
	again := newOp("sale", sale.EntityID, "create", payloadOf(t, sale))
	expectError(t, c.pushOne(a, f.request(again)), devicesync.StatusRejected, devicesync.CodePayloadInvalid, "permanent")
}

func TestTwoCancelsAreIdempotentAndAnUnknownCancelWaits(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	payment := f.find("payment")
	cancel := map[string]any{"id": payment.EntityID, "status": "cancelled", "reason": "bounced", "journal": nil}
	first := c.pushOne(a, f.request(newOp("payment", payment.EntityID, "cancel", cancel)))
	second := c.pushOne(c.registerDevice(), f.request(newOp("payment", payment.EntityID, "cancel", cancel)))
	if first.Status != devicesync.StatusApplied || second.Status != devicesync.StatusApplied || *first.ServerSeq != *second.ServerSeq {
		t.Fatalf("first %+v second %+v", first, second)
	}
	unknown := newOp("payment", ulid.Make().String(), "cancel", cancel)
	expectError(t, c.pushOne(a, f.request(unknown)), devicesync.StatusDeferred, devicesync.CodeDependencyMissing, "dependency")
}

func TestSimpleMasterFieldsAreLastWriterWins(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	customer := f.find("customer")
	later := edited(t, customer, map[string]any{"name": "Ravi Kumar", "version": 2, "updatedAt": "2026-10-04T11:00:00.000Z"})
	earlier := edited(t, customer, map[string]any{"name": "Ravi K", "version": 2, "updatedAt": "2026-10-04T10:30:00.000Z"})
	c.push(a, f.request(later))
	c.push(b, f.request(earlier))
	ch := c.lastChange(a, f.businessID, "masters", "customer", customer.EntityID)
	if p := decodeMap(t, ch.Payload); p["name"] != "Ravi Kumar" || ch.OriginDeviceID != nil {
		t.Fatalf("the later edit should win and the merge go back to B: %v origin %v", p["name"], ch.OriginDeviceID)
	}
	if kinds := c.reviewKinds(a, f.businessID); kinds["field_conflict"] != 1 {
		t.Fatalf("review items %v", kinds)
	}
}

func TestConfigKeepsTheCloudsValue(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	var terminal devicesync.Operation
	for _, o := range f.ops {
		if o.EntityType == "terminal" && o.OperationType == "update" {
			terminal = o
		}
	}
	c.push(a, f.request(edited(t, terminal, map[string]any{"name": "Front till", "version": 3})))
	c.push(b, f.request(edited(t, terminal, map[string]any{"name": "Back till", "version": 3})))
	ch := c.lastChange(a, f.businessID, "config", "terminal", terminal.EntityID)
	if p := decodeMap(t, ch.Payload); p["name"] != "Front till" || ch.OriginDeviceID != nil || ch.Version != 4 {
		t.Fatalf("config should keep the cloud's name: %v origin %v version %d", p["name"], ch.OriginDeviceID, ch.Version)
	}
}

func TestCreditLimitKeepsTheCloudsValue(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	limit := f.find("customer_credit_limit")
	c.push(a, f.request(edited(t, limit, map[string]any{"creditLimitPaise": 500000, "version": 3})))
	c.push(b, f.request(edited(t, limit, map[string]any{"creditLimitPaise": 700000, "version": 3})))
	ch := c.lastChange(a, f.businessID, "masters", "customer_credit_limit", limit.EntityID)
	if p := decodeMap(t, ch.Payload); p["creditLimitPaise"] != 500000.0 {
		t.Fatalf("credit limit %v", p["creditLimitPaise"])
	}
}

func barcode(productID, code string) devicesync.Operation {
	id := ulid.Make().String()
	return newOp("barcode", id, "create", map[string]any{"id": id, "productId": productID, "code": code, "symbology": "ean13", "isPrimary": true})
}

func TestTombstoneWinsOverAConcurrentUpdate(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	bc := barcode(f.find("product").EntityID, "8901234567890")
	c.push(a, f.request(bc))
	c.push(a, f.request(newOp("barcode", bc.EntityID, "void", map[string]any{"id": bc.EntityID, "productId": f.find("product").EntityID})))
	if r := c.pushOne(b, f.request(edited(t, bc, map[string]any{"isPrimary": false}))); r.Status != devicesync.StatusApplied {
		t.Fatalf("%+v", r)
	}
	ch := c.lastChange(a, f.businessID, "masters", "barcode", bc.EntityID)
	if ch.Op != "delete" || ch.OriginDeviceID != nil {
		t.Fatalf("the delete should stand and go back to B: %+v", ch)
	}
	if kinds := c.reviewKinds(a, f.businessID); kinds["tombstone_wins"] != 1 {
		t.Fatalf("review items %v", kinds)
	}
}

func TestADuplicateBarcodeKeepsBothRowsForReview(t *testing.T) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	product := f.find("product")
	other := payloadOf(t, product)
	otherID := ulid.Make().String()
	other["id"], other["name"] = otherID, "Soap Large"
	c.push(a, f.request(newOp("product", otherID, "create", other)))
	c.push(a, f.request(barcode(product.EntityID, "8901234567890")))
	if r := c.pushOne(b, f.request(barcode(otherID, "8901234567890"))); r.Status != devicesync.StatusApplied {
		t.Fatalf("%+v", r)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM entity_state WHERE entity_type = 'barcode' AND deleted_at IS NULL`); n != 2 {
		t.Fatalf("live barcodes %d", n)
	}
	if kinds := c.reviewKinds(a, f.businessID); kinds["duplicate_barcode"] != 1 {
		t.Fatalf("review items %v", kinds)
	}
}

func TestReviewItemsTravelOnTheControlStream(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	if code, page := c.pull(a, f.businessID, "control", 0); code != http.StatusOK || len(page.Changes) != 0 {
		t.Fatalf("a clean push makes no review items: %+v", page.Changes)
	}
}
