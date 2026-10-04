package verify

import "testing"

// testdata/credit-note.json holds real credit notes recorded by the desktop (dumpCensus): a part return of a cess line and a
// weighed line, a whole-bill cancel with round-off, and a return credited to a customer's account with stock back at cost.
const creditNotes = "testdata/credit-note.json"

func TestRecordedCreditNotesVerify(t *testing.T) {
	for _, o := range loadOps(t, creditNotes) {
		if err := Operation(o.EntityType, o.OperationType, o.Payload, journals{}); err != nil {
			t.Errorf("%s: %v", o.EntityID, err)
		}
	}
}

func journalLine(m map[string]any, role string) map[string]any {
	for _, l := range m["journal"].(map[string]any)["lines"].([]any) {
		line := l.(map[string]any)
		if line["account"].(map[string]any)["role"] == role {
			return line
		}
	}
	return nil
}

func TestCreditNoteTampering(t *testing.T) {
	ops := loadOps(t, creditNotes)
	returned, credited := ops[0], ops[2]
	line := func(m map[string]any) map[string]any { return m["lines"].([]any)[0].(map[string]any) }
	cases := []struct {
		name string
		base op
		want string
		edit func(map[string]any)
	}{
		{"line tax not the sale line's share", returned, TotalMismatch, func(m map[string]any) { line(m)["cgstPaise"] = line(m)["cgstPaise"].(float64) + 1 }},
		{"returned more than was sold", returned, TotalMismatch, func(m map[string]any) {
			line(m)["returnedBeforeMilli"] = line(m)["sold"].(map[string]any)["qtyMilli"].(float64)
		}},
		{"line without its sale line", returned, PayloadInvalid, func(m map[string]any) { delete(line(m), "sold") }},
		{"refund and credit do not make the total", returned, TotalMismatch, func(m map[string]any) { m["refundPaise"] = m["refundPaise"].(float64) - 1 }},
		{"round-off beyond a rupee", returned, TotalMismatch, func(m map[string]any) { m["roundOffPaise"] = 101.0 }},
		{"refund moved to sales", returned, JournalMismatch, func(m map[string]any) {
			journalLine(m, "sales_goods")["debitPaise"] = journalLine(m, "sales_goods")["debitPaise"].(float64) + 100
			journalLine(m, "output_cgst")["debitPaise"] = journalLine(m, "output_cgst")["debitPaise"].(float64) - 100
		}},
		{"credit on another customer", credited, JournalMismatch, func(m map[string]any) {
			journalLine(m, "ar")["party"].(map[string]any)["partyId"] = "01M43FZ4TF0PSH5DR7518HF9ZZ"
		}},
		{"credit without a ledger entry", credited, JournalMismatch, func(m map[string]any) { m["entry"] = nil }},
		{"stock back at another value", credited, JournalMismatch, func(m map[string]any) {
			journalLine(m, "inventory")["debitPaise"] = journalLine(m, "inventory")["debitPaise"].(float64) + 1
			journalLine(m, "cogs")["creditPaise"] = journalLine(m, "cogs")["creditPaise"].(float64) + 1
		}},
		{"no journal", returned, PayloadInvalid, func(m map[string]any) { delete(m, "journal") }},
	}
	for _, c := range cases {
		if got := codeOf(Operation("credit_note", "create", mutate(t, c.base, c.edit), journals{})); got != c.want {
			t.Errorf("%s: got %q, want %s", c.name, got, c.want)
		}
	}
}
