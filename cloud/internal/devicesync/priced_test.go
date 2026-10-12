package devicesync_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// The two documents priced like a sale that post nothing (ADR-0068/0069), and the update that bills each.
var pricedDocuments = []struct {
	entityType string
	number     string
	extra      map[string]any
	link       func(saleID string) map[string]any
}{
	{"estimate", "DE01Q/2627/00001", map[string]any{"validUntil": "2026-10-27", "billDiscount": map[string]any{"kind": "amount", "value": 0}},
		func(saleID string) map[string]any {
			return map[string]any{"status": "converted", "saleId": saleID, "saleDocNumber": "DE01/2627/000007", "convertedAt": "2026-10-13T05:00:00Z"}
		}},
	{"delivery_challan", "DE01H/2627/00001", map[string]any{"purpose": "supply", "transport": map[string]any{"mode": "road", "vehicleNo": "DL01AB1234"}},
		func(saleID string) map[string]any {
			return map[string]any{"status": "billed", "saleId": saleID, "saleDocNumber": "DE01/2627/000007", "billedAt": "2026-10-13T05:00:00Z"}
		}},
}

// Two of a soap at ₹50 before GST, 10% off the line, 18% within the state: ₹90 taxable, ₹8.10 CGST and SGST, ₹106.20.
func pricedPayload(businessID, id, number string, extra map[string]any) map[string]any {
	line := map[string]any{
		"lineNo": 1, "productId": "01J00000000000000000000P01", "uomId": "01J00000000000000000000U01", "name": "Soap", "uomCode": "PCS",
		"qtyMilli": 2000, "baseQtyMilli": 2000, "unitPricePaise": 5000, "priceIsInclusive": false, "gstRateBp": 1800, "cessRateBp": 0,
		"cessPerUnitPaise": 0, "taxTreatment": "taxable", "lineDiscount": map[string]any{"kind": "percent", "value": 1000},
		"grossPaise": 10000, "lineDiscountPaise": 1000, "apportionedBillDiscountPaise": 0, "taxablePaise": 9000,
		"cgstPaise": 810, "sgstPaise": 810, "igstPaise": 0, "cessPaise": 0, "totalPaise": 10620,
	}
	totals := map[string]any{
		"docType": "tax_invoice", "supplyType": "intra", "stateTaxKind": "sgst", "placeOfSupplyState": "07", "billDiscountPaise": 0,
		"taxablePaise": 9000, "cgstPaise": 810, "sgstPaise": 810, "igstPaise": 0, "cessPaise": 0, "roundOffPaise": 0, "totalPaise": 10620,
	}
	p := map[string]any{
		"id": id, "businessId": businessID, "terminalId": "01J00000000000000000000T01", "docNumber": number, "docDate": "2026-10-12",
		"status": "open", "lines": []any{line}, "totals": totals,
	}
	for k, v := range extra {
		p[k] = v
	}
	return p
}

func TestAPricedDocumentIsVerifiedStoredAndBilledOnTheDocumentsStream(t *testing.T) {
	for _, d := range pricedDocuments {
		t.Run(d.entityType, func(t *testing.T) {
			c, f, a := setup(t)
			c.push(a, f.request(f.ops...))
			id := ulid.Make().String()
			if r := c.pushOne(a, f.request(newOp(d.entityType, id, "create", pricedPayload(f.businessID, id, d.number, d.extra)))); r.Status != devicesync.StatusApplied {
				t.Fatalf("create: %+v %+v", r, r.Error)
			}
			link := d.link(ulid.Make().String())
			if r := c.pushOne(a, f.request(newOp(d.entityType, id, "update", link))); r.Status != devicesync.StatusApplied {
				t.Fatalf("update: %+v %+v", r, r.Error)
			}
			if n := c.count(`SELECT count(*)::int FROM journal_entry WHERE business_id = $1 AND ref_id = $2`, f.businessID, id); n != 0 {
				t.Fatalf("a %s posts nothing, found %d journals", d.entityType, n)
			}
			code, page := c.pull(a, f.businessID, devicesync.StreamDocuments, 0)
			if code != http.StatusOK {
				t.Fatalf("pull: HTTP %d", code)
			}
			var got *devicesync.Change
			for i := range page.Changes {
				if page.Changes[i].EntityType == d.entityType && page.Changes[i].EntityID == id {
					got = &page.Changes[i]
				}
			}
			if got == nil || got.Version != 2 {
				t.Fatalf("pulled %+v", got)
			}
			var doc struct {
				DocNumber string         `json:"docNumber"`
				Update    map[string]any `json:"update"`
			}
			if err := json.Unmarshal(got.Payload, &doc); err != nil || doc.DocNumber != d.number || doc.Update["saleId"] != link["saleId"] {
				t.Fatalf("pulled payload %s (%v)", got.Payload, err)
			}
		})
	}
}

func TestAPricedDocumentWhoseGSTDoesNotAddUpOrWhoseUpdateIsNotABillIsRefused(t *testing.T) {
	for _, d := range pricedDocuments {
		t.Run(d.entityType, func(t *testing.T) {
			c, f, a := setup(t)
			c.push(a, f.request(f.ops...))
			id := ulid.Make().String()
			p := pricedPayload(f.businessID, id, d.number, d.extra)
			p["totals"].(map[string]any)["cgstPaise"] = 700
			expectError(t, c.pushOne(a, f.request(newOp(d.entityType, id, "create", p))), devicesync.StatusRejected, devicesync.CodeTotalMismatch, "permanent")
			c.pushOne(a, f.request(newOp(d.entityType, id, "create", pricedPayload(f.businessID, id, d.number, d.extra))))
			expectError(t, c.pushOne(a, f.request(newOp(d.entityType, id, "update", map[string]any{"status": "open"}))),
				devicesync.StatusRejected, devicesync.CodePayloadInvalid, "permanent")
		})
	}
}
