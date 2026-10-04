package verify

import (
	"encoding/json"
	"errors"
	"testing"
)

// The year close the desktop recorded for the protocol fixture: FY 2025-26 closed with one journal to retained earnings.
const yearClose = "../../../../packages/contracts/fixtures/sync/year-close-once.json"

func recordedClose(t *testing.T) op {
	for _, o := range loadOps(t, yearClose) {
		if o.EntityType == "fy_close" {
			return o
		}
	}
	t.Fatal("no fy_close in the fixture")
	return op{}
}

func closingOf(m map[string]any) map[string]any { return m["closings"].([]any)[0].(map[string]any) }
func closingLine(m map[string]any, i int) map[string]any {
	return closingOf(m)["journal"].(map[string]any)["lines"].([]any)[i].(map[string]any)
}

func TestRecordedYearCloseVerifies(t *testing.T) {
	o := recordedClose(t)
	if err := Operation(o.EntityType, o.OperationType, o.Payload, journals{}); err != nil {
		t.Fatalf("recorded close: %v", err)
	}
	js, err := Journals(o.EntityType, o.Payload)
	if err != nil || len(js) != 1 || js[0].Source != "closing" || Balanced(js) != nil {
		t.Fatalf("journals %+v, %v", js, err)
	}
}

func TestYearCloseTampering(t *testing.T) {
	o := recordedClose(t)
	cases := []struct {
		name string
		want string
		edit func(map[string]any)
	}{
		{"an account closed short", JournalMismatch, func(m map[string]any) {
			l := closingLine(m, 0)
			l["debitPaise"], l["creditPaise"] = l["debitPaise"].(float64)/2, l["creditPaise"].(float64)/2
		}},
		{"a control account in the journal", JournalMismatch, func(m map[string]any) { closingLine(m, 0)["account"] = map[string]any{"role": "ar"} }},
		{"a balance sheet account named as income", JournalMismatch, func(m map[string]any) {
			closingOf(m)["balances"].([]any)[0].(map[string]any)["type"] = "asset"
		}},
		{"dated before the year end", JournalMismatch, func(m map[string]any) {
			j := closingOf(m)["journal"].(map[string]any)
			j["entryDate"], j["docDate"] = "2026-03-30", "2026-03-30"
		}},
		{"not a closing journal", JournalMismatch, func(m map[string]any) { closingOf(m)["journal"].(map[string]any)["source"] = "manual" }},
		{"a version with no closing", PayloadInvalid, func(m map[string]any) { m["version"] = 2.0 }},
		{"a year that ends elsewhere", PayloadInvalid, func(m map[string]any) { m["fyEnd"] = "2026-12-31" }},
	}
	for _, c := range cases {
		var m map[string]any
		if err := json.Unmarshal(o.Payload, &m); err != nil {
			t.Fatal(err)
		}
		c.edit(m)
		payload, _ := json.Marshal(m)
		err := Operation(o.EntityType, o.OperationType, payload, journals{})
		var f *Failure
		if !errors.As(err, &f) || f.Code != c.want {
			t.Errorf("%s: want %s, got %v", c.name, c.want, err)
		}
	}
}
