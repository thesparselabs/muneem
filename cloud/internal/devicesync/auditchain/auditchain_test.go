package auditchain_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/auditchain"
)

// Written by packages/db-sqlite/test/canonicalFixtures.test.ts from the device's own code.
const fixtures = "../../../../packages/contracts/fixtures/canonical/"

func readFixture(t *testing.T, name string, into any) {
	t.Helper()
	raw, err := os.ReadFile(fixtures + name)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		t.Fatal(err)
	}
}

func TestCanonicalJSONMatchesTheDevice(t *testing.T) {
	var f struct {
		Cases []struct{ Name, JSON, Canonical string }
	}
	readFixture(t, "canonical-json.json", &f)
	if len(f.Cases) < 8 {
		t.Fatalf("only %d cases", len(f.Cases))
	}
	for _, c := range f.Cases {
		got, err := auditchain.CanonicalJSON([]byte(c.JSON))
		if err != nil || string(got) != c.Canonical {
			t.Errorf("%s:\n got %s (%v)\nwant %s", c.Name, got, err, c.Canonical)
		}
	}
}

func chain(t *testing.T) []json.RawMessage {
	var f struct{ Rows []json.RawMessage }
	readFixture(t, "audit-chain.json", &f)
	return f.Rows
}

func decode(t *testing.T, raw json.RawMessage) *auditchain.Entry {
	t.Helper()
	e, err := auditchain.Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	return e
}

func TestTheDevicesHashesRecompute(t *testing.T) {
	rows := chain(t)
	tip := auditchain.Tip{}
	for _, raw := range rows {
		e := decode(t, raw)
		if v, detail, err := auditchain.Check(e, tip); err != nil || v != auditchain.Append {
			t.Fatalf("seq %d: %v %s %v", e.Seq, v, detail, err)
		}
		tip = auditchain.Tip{LastSeq: e.Seq, LastHash: e.Hash}
	}
}

func TestChainRules(t *testing.T) {
	rows := chain(t)
	first, second, third := decode(t, rows[0]), decode(t, rows[1]), decode(t, rows[2])
	afterFirst := auditchain.Tip{LastSeq: 1, LastHash: first.Hash}
	other := strings.Repeat("a", 64)
	cases := []struct {
		name   string
		entry  *auditchain.Entry
		tip    auditchain.Tip
		want   auditchain.Verdict
		detail string
	}{
		{"a gap waits", third, afterFirst, auditchain.Gap, "waiting for audit seq 2"},
		{"the same row again", first, auditchain.Tip{HeldHash: &first.Hash, LastSeq: 1, LastHash: first.Hash}, auditchain.Duplicate, ""},
		{"another row at a held seq", first, auditchain.Tip{HeldHash: &other, LastSeq: 1, LastHash: other}, auditchain.Broken, "seq 1 already holds another row"},
		{"a link to the wrong row", second, auditchain.Tip{LastSeq: 1, LastHash: other}, auditchain.Broken, "seq 2: prev_hash does not link to seq 1"},
		{"an edited row", edited(t, rows[1]), afterFirst, auditchain.Broken, "seq 2: the hash does not match the row"},
	}
	for _, c := range cases {
		v, detail, err := auditchain.Check(c.entry, c.tip)
		if err != nil || v != c.want || detail != c.detail {
			t.Errorf("%s: got %v %q %v", c.name, v, detail, err)
		}
	}
}

func edited(t *testing.T, raw json.RawMessage) *auditchain.Entry {
	e := decode(t, raw)
	tampered := `{"name":"Soap","sellingPricePaise":1}`
	e.AfterJSON = &tampered
	return e
}

func TestDecodeWantsExactlyTheRow(t *testing.T) {
	var row map[string]any
	if err := json.Unmarshal(chain(t)[0], &row); err != nil {
		t.Fatal(err)
	}
	for name, change := range map[string]func(m map[string]any){
		"missing":  func(m map[string]any) { delete(m, "entity_id") },
		"extra":    func(m map[string]any) { m["extra"] = 1 },
		"bad hash": func(m map[string]any) { m["hash"] = "xyz" },
		"zero seq": func(m map[string]any) { m["seq"] = 0 },
	} {
		m := map[string]any{}
		for k, v := range row {
			m[k] = v
		}
		change(m)
		raw, _ := json.Marshal(m)
		if _, err := auditchain.Decode(raw); err == nil {
			t.Errorf("%s: decoded", name)
		}
	}
	bad := decode(t, chain(t)[0])
	broken := "{not json"
	bad.BeforeJSON = &broken
	if _, _, err := auditchain.Check(bad, auditchain.Tip{}); err == nil {
		t.Fatal("unparseable before_json must be an error")
	}
}
