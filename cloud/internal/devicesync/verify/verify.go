package verify

import "encoding/json"

// Lookup reads what an operation refers to that is already stored on the cloud.
type Lookup interface {
	// JournalDebit is the debit total of a stored journal, false when the cloud has not seen it.
	JournalDebit(journalID string) (int64, bool)
}

type check func(payload []byte, lk Lookup) error

func decoded[T any](run func(*T) error) check {
	return func(payload []byte, _ Lookup) error {
		var v T
		if err := json.Unmarshal(payload, &v); err != nil {
			return fail(PayloadInvalid, "%v", err)
		}
		return run(&v)
	}
}

var creates = map[string]check{
	"sale":             decoded(verifySale),
	"purchase":         decoded(verifyPurchase),
	"debit_note":       decoded(verifyDebitNote),
	"credit_note":      decoded(verifyCreditNote),
	"gst_setoff":       decoded(verifyGstSetoff),
	"gst_payment":      decoded(verifyGstPayment),
	"payment":          decoded(verifyPayment),
	"write_off":        decoded(verifyWriteOff),
	"expense":          decoded(verifyExpense),
	"allocation":       decoded(verifyAllocation),
	"stock_adjustment": decoded(verifyStockDocument),
	"party_opening":    decoded(verifyPartyOpening),
	"journal_entry":    decoded(func(j *Journal) error { return balanced(j) }),
}

// Operation verifies one pushed operation; a nil result means the cloud found nothing wrong with it.
func Operation(entityType, operationType string, payload []byte, lk Lookup) error {
	switch {
	case operationType == "cancel":
		return verifyCancel(payload, lk)
	case entityType == "pos_session" && operationType == "update":
		return decoded(verifySessionClose)(payload, lk)
	case operationType == "create":
		if c, ok := creates[entityType]; ok {
			return c(payload, lk)
		}
	}
	return nil
}

func verifyStockDocument(d *StockDocument) error {
	if err := allBalanced(append([]*Journal{d.Journal}, refs(d.Corrections)...)...); err != nil || d.Journal == nil {
		return err
	}
	var value int64
	for _, m := range d.Movements {
		if m.Type != "cost_correction" {
			value += m.ValuePaise
		}
	}
	return expectEq(JournalMismatch, "stock", d.Journal.net("inventory"), value)
}

func verifyPartyOpening(o *PartyOpening) error {
	if o.Opening == nil || o.Entry == nil {
		return fail(PayloadInvalid, "party opening needs the opening and its entry")
	}
	signed := o.Opening.AmountPaise
	if o.Opening.Side != "receivable" {
		signed = -signed
	}
	return partyEntryAmount(o.Entry, signed)
}

func verifySessionClose(s *SessionClose) error {
	return expectEq(TotalMismatch, "register variance", s.VariancePaise, s.CountedCashPaise-s.ExpectedCashPaise)
}

// A cancel reverses the original journal whole: same total, opposite sides.
func verifyCancel(payload []byte, lk Lookup) error {
	var c Cancel
	if err := json.Unmarshal(payload, &c); err != nil {
		return fail(PayloadInvalid, "%v", err)
	}
	if err := allBalanced(append([]*Journal{c.Journal}, refs(c.Corrections)...)...); err != nil || c.Journal == nil {
		return err
	}
	if c.Journal.ReversalOf == nil {
		return fail(JournalMismatch, "cancel journal %s reverses nothing", c.Journal.ID)
	}
	original, ok := lk.JournalDebit(*c.Journal.ReversalOf)
	if !ok {
		return nil
	}
	debit, _ := c.Journal.totals()
	return expectEq(JournalMismatch, "reversal", debit, original)
}
