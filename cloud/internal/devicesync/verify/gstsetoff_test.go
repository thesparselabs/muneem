package verify

import (
	"encoding/json"
	"errors"
	"testing"
)

// testdata/gst.json holds a set-off and its challan recorded by the desktop (dumpCensus): IGST credit spent on CGST, cess
// credit on cess, and the rest of CGST, SGST and cess paid in cash.
const gstDocs = "testdata/gst.json"

func TestRecordedGstDocumentsVerify(t *testing.T) {
	ops := loadOps(t, gstDocs)
	if len(ops) != 2 {
		t.Fatalf("want a set-off and a payment, got %d operations", len(ops))
	}
	for _, o := range ops {
		if err := Operation(o.EntityType, o.OperationType, o.Payload, journals{}); err != nil {
			t.Errorf("%s %s: %v", o.EntityType, o.EntityID, err)
		}
	}
}

func setoffHeads(m map[string]any, key string) map[string]any { return m[key].(map[string]any) }

func TestGstDocumentTampering(t *testing.T) {
	ops := loadOps(t, gstDocs)
	setoff, payment := ops[0], ops[1]
	cases := []struct {
		name string
		base op
		want string
		edit func(map[string]any)
	}{
		{"IGST credit not used first", setoff, TotalMismatch, func(m map[string]any) {
			u := setoffHeads(m, "utilisation")
			u["igstToCgstPaise"], u["igstToSgstPaise"] = u["igstToCgstPaise"].(float64)-100, 100.0
			c := setoffHeads(m, "cash")
			c["cgstPaise"], c["sgstPaise"] = c["cgstPaise"].(float64)+100, c["sgstPaise"].(float64)-100
		}},
		{"cash that credit could have paid", setoff, TotalMismatch, func(m map[string]any) {
			setoffHeads(m, "utilisation")["cessToCessPaise"] = 0.0
			c := setoffHeads(m, "cash")
			c["cessPaise"] = c["cessPaise"].(float64) + 1800
		}},
		{"more credit than there was", setoff, TotalMismatch, func(m map[string]any) { setoffHeads(m, "credit")["igstPaise"] = 100.0 }},
		{"journal clears less output tax", setoff, JournalMismatch, func(m map[string]any) {
			l := journalLine(m, "output_sgst")
			l["debitPaise"] = l["debitPaise"].(float64) - 1
			p := journalLine(m, "gst_payable")
			p["creditPaise"] = p["creditPaise"].(float64) - 1
		}},
		{"journal touches receivables", setoff, JournalMismatch, func(m map[string]any) {
			journalLine(m, "gst_payable")["account"] = map[string]any{"role": "ar"}
		}},
		{"month not a month", setoff, PayloadInvalid, func(m map[string]any) { m["month"] = "2026-05-31" }},
		{"challan heads do not add up", payment, TotalMismatch, func(m map[string]any) { m["cgstPaise"] = m["cgstPaise"].(float64) + 1 }},
		{"challan paid from the drawer", payment, JournalMismatch, func(m map[string]any) { journalLine(m, "bank")["account"] = map[string]any{"role": "cash"} }},
	}
	for _, c := range cases {
		var m map[string]any
		if err := json.Unmarshal(c.base.Payload, &m); err != nil {
			t.Fatal(err)
		}
		c.edit(m)
		payload, _ := json.Marshal(m)
		err := Operation(c.base.EntityType, c.base.OperationType, payload, journals{})
		var f *Failure
		if !errors.As(err, &f) || f.Code != c.want {
			t.Errorf("%s: want %s, got %v", c.name, c.want, err)
		}
	}
}
