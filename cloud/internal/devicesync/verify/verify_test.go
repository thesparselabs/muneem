package verify

import (
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
)

const fixtures = "../../../../packages/contracts/fixtures/sync/"

type op struct {
	EntityType    string          `json:"entityType"`
	OperationType string          `json:"operationType"`
	EntityID      string          `json:"entityId"`
	Payload       json.RawMessage `json:"payload"`
}

func loadOps(t *testing.T, path string) []op {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Operations []op `json:"operations"`
		Steps      []struct {
			Request struct {
				Operations []op `json:"operations"`
			} `json:"request"`
		} `json:"steps"`
	}
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	out := f.Operations
	for _, s := range f.Steps {
		out = append(out, s.Request.Operations...)
	}
	return out
}

type journals map[string]int64

func (j journals) JournalDebit(id string) (int64, bool) { v, ok := j[id]; return v, ok }

func (j journals) record(t *testing.T, o op) {
	js, err := Journals(o.EntityType, o.Payload)
	if err != nil {
		t.Fatal(err)
	}
	for _, x := range js {
		j[x.ID], _ = x.totals()
	}
}

func codeOf(err error) string {
	var f *Failure
	if errors.As(err, &f) {
		return f.Code
	}
	return ""
}

func findOp(t *testing.T, entityType string) op {
	for _, o := range loadOps(t, fixtures+"push-applied-then-duplicate.json") {
		if o.EntityType == entityType {
			return o
		}
	}
	t.Fatalf("no %s in fixture", entityType)
	return op{}
}

func mutate(t *testing.T, o op, edit func(map[string]any)) []byte {
	var m map[string]any
	if err := json.Unmarshal(o.Payload, &m); err != nil {
		t.Fatal(err)
	}
	edit(m)
	b, _ := json.Marshal(m)
	return b
}

func TestFixturePayloadsVerify(t *testing.T) {
	lk := journals{}
	for _, o := range loadOps(t, fixtures+"push-applied-then-duplicate.json") {
		if err := Operation(o.EntityType, o.OperationType, o.Payload, lk); err != nil {
			t.Errorf("%s %s: %v", o.EntityType, o.EntityID, err)
		}
		lk.record(t, o)
	}
}

func TestTamperedTotalIsTotalMismatch(t *testing.T) {
	for _, o := range loadOps(t, fixtures+"push-tampered-total.json") {
		if o.EntityType == "sale" {
			if got := codeOf(Operation(o.EntityType, o.OperationType, o.Payload, journals{})); got != TotalMismatch {
				t.Fatalf("got %q, want TOTAL_MISMATCH", got)
			}
			return
		}
	}
	t.Fatal("no sale in fixture")
}

func TestSaleTampering(t *testing.T) {
	sale := findOp(t, "sale")
	journal := func(m map[string]any) []any { return m["journal"].(map[string]any)["lines"].([]any) }
	cases := []struct {
		name string
		want string
		edit func(map[string]any)
	}{
		{"line tax", TotalMismatch, func(m map[string]any) { m["lines"].([]any)[0].(map[string]any)["cgstPaise"] = 1700.0 }},
		{"tenders", TotalMismatch, func(m map[string]any) { m["tenders"].([]any)[0].(map[string]any)["amountPaise"] = 23000.0 }},
		{"unbalanced journal", JournalImbalance, func(m map[string]any) { journal(m)[0].(map[string]any)["debitPaise"] = 23500.0 }},
		{"tax head moved to sales", JournalMismatch, func(m map[string]any) {
			journal(m)[1].(map[string]any)["creditPaise"] = 21800.0
			journal(m)[2].(map[string]any)["creditPaise"] = 0.0
		}},
		{"receivable on another customer", JournalMismatch, func(m map[string]any) {
			journal(m)[0].(map[string]any)["party"].(map[string]any)["partyId"] = "01M43FZ4TF0PSH5DR7518HF9ZZ"
		}},
		{"no journal", PayloadInvalid, func(m map[string]any) { delete(m, "journal") }},
	}
	for _, c := range cases {
		if got := codeOf(Operation("sale", "create", mutate(t, sale, c.edit), journals{})); got != c.want {
			t.Errorf("%s: got %q, want %s", c.name, got, c.want)
		}
	}
}

func TestPaymentAllocationsWithinAmount(t *testing.T) {
	payment := findOp(t, "payment")
	over := mutate(t, payment, func(m map[string]any) { m["allocations"].([]any)[0].(map[string]any)["amountPaise"] = 10001.0 })
	if got := codeOf(Operation("payment", "create", over, journals{})); got != TotalMismatch {
		t.Fatalf("got %q, want TOTAL_MISMATCH", got)
	}
}

func TestCancelMustReverseTheWholeJournal(t *testing.T) {
	cancel := []byte(`{"status":"cancelled","journal":{"id":"J2","reversalOf":"J1","entryDate":"2026-10-04","docDate":"2026-10-04","lines":[{"account":{"code":"1100"},"debitPaise":0,"creditPaise":900},{"account":{"code":"1300"},"debitPaise":900,"creditPaise":0}]}}`)
	if err := Operation("payment", "cancel", cancel, journals{"J1": 900}); err != nil {
		t.Fatal(err)
	}
	if got := codeOf(Operation("payment", "cancel", cancel, journals{"J1": 1000})); got != JournalMismatch {
		t.Fatalf("got %q, want JOURNAL_MISMATCH", got)
	}
}

// MUNEEM_SYNC_CENSUS points at a dump of a seeded soak's outbox ({operations: [...]}); every operation must verify.
func TestCensusVerifies(t *testing.T) {
	path := os.Getenv("MUNEEM_SYNC_CENSUS")
	if path == "" {
		t.Skip("MUNEEM_SYNC_CENSUS not set")
	}
	lk := journals{}
	seen := map[string]int{}
	for _, o := range loadOps(t, path) {
		seen[o.EntityType+":"+o.OperationType]++
		if err := Operation(o.EntityType, o.OperationType, o.Payload, lk); err != nil {
			t.Errorf("%s %s %s: %v", o.EntityType, o.OperationType, o.EntityID, err)
		}
		lk.record(t, o)
	}
	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	t.Logf("verified %s", strings.Join(keys, " "))
}
