package verify

import "github.com/sparselabs/muneem/cloud/internal/domain/returns"

type CreditNoteLine struct {
	QtyMilli            int64             `json:"qtyMilli"`
	BaseQtyMilli        int64             `json:"baseQtyMilli"`
	ReturnedBeforeMilli int64             `json:"returnedBeforeMilli"`
	TaxablePaise        int64             `json:"taxablePaise"`
	TotalPaise          int64             `json:"totalPaise"`
	CostPaise           int64             `json:"costPaise"`
	Sold                *returns.SoldLine `json:"sold"`
	TaxHeads
}

type CreditNote struct {
	CustomerID    *string          `json:"customerId"`
	TaxablePaise  int64            `json:"taxablePaise"`
	RoundOffPaise int64            `json:"roundOffPaise"`
	TotalPaise    int64            `json:"totalPaise"`
	CostPaise     int64            `json:"costPaise"`
	RefundMethod  string           `json:"refundMethod"`
	RefundPaise   int64            `json:"refundPaise"`
	CreditPaise   int64            `json:"creditPaise"`
	Lines         []CreditNoteLine `json:"lines"`
	Movements     []Movement       `json:"movements"`
	Corrections   []Journal        `json:"corrections"`
	Entry         *PartyEntry      `json:"entry"`
	Journal       *Journal         `json:"journal"`
	TaxHeads
}

// ADR-0043: each line is recomputed from the sale line it came from; the journal must carry the note's own amounts.
func verifyCreditNote(n *CreditNote) error {
	if n.Journal == nil || len(n.Lines) == 0 {
		return fail(PayloadInvalid, "credit note needs lines and a journal")
	}
	return firstErr(creditNoteLines(n), creditNoteTotals(n), allBalanced(append([]*Journal{n.Journal}, refs(n.Corrections)...)...), creditNoteJournal(n))
}

func creditNoteLines(n *CreditNote) error {
	for i, l := range n.Lines {
		if l.Sold == nil {
			return fail(PayloadInvalid, "credit note line %d does not carry its sale line", i+1)
		}
		got, err := returns.ComputeLine(returns.LineInput{Line: *l.Sold, ReturnedBeforeMilli: l.ReturnedBeforeMilli, QtyMilli: l.QtyMilli})
		if err != nil {
			return fail(TotalMismatch, "credit note line %d: %v", i+1, err)
		}
		sent := returns.LineResult{
			QtyMilli: l.QtyMilli, BaseQtyMilli: l.BaseQtyMilli, TaxablePaise: l.TaxablePaise, CgstPaise: l.CgstPaise, SgstPaise: l.SgstPaise,
			IgstPaise: l.IgstPaise, CessPaise: l.CessPaise, TotalPaise: l.TotalPaise, CostPaise: l.CostPaise,
		}
		if got != sent {
			return fail(TotalMismatch, "credit note line %d: sent %+v, computed %+v", i+1, sent, got)
		}
	}
	return nil
}

func creditNoteTotals(n *CreditNote) error {
	var sum returns.LineResult
	for _, l := range n.Lines {
		sum.TaxablePaise += l.TaxablePaise
		sum.CgstPaise += l.CgstPaise
		sum.SgstPaise += l.SgstPaise
		sum.IgstPaise += l.IgstPaise
		sum.CessPaise += l.CessPaise
		sum.TotalPaise += l.TotalPaise
		sum.CostPaise += l.CostPaise
	}
	if n.RoundOffPaise > 100 || n.RoundOffPaise < -100 {
		return fail(TotalMismatch, "credit note round-off %d is beyond ±100", n.RoundOffPaise)
	}
	if n.RefundMethod == "credit" && n.RefundPaise != 0 {
		return fail(TotalMismatch, "a credit to the account refunds nothing, got %d", n.RefundPaise)
	}
	return firstErr(
		expectEq(TotalMismatch, "credit note taxable", n.TaxablePaise, sum.TaxablePaise),
		expectEq(TotalMismatch, "credit note cgst", n.CgstPaise, sum.CgstPaise),
		expectEq(TotalMismatch, "credit note sgst", n.SgstPaise, sum.SgstPaise),
		expectEq(TotalMismatch, "credit note igst", n.IgstPaise, sum.IgstPaise),
		expectEq(TotalMismatch, "credit note cess", n.CessPaise, sum.CessPaise),
		expectEq(TotalMismatch, "credit note total", n.TotalPaise, sum.TotalPaise+n.RoundOffPaise),
		expectEq(TotalMismatch, "credit note cost", n.CostPaise, sum.CostPaise),
		expectEq(TotalMismatch, "refund and credit", n.RefundPaise+n.CreditPaise, n.TotalPaise),
	)
}

func creditNoteJournal(n *CreditNote) error {
	j := n.Journal
	var stockValue int64
	for _, m := range n.Movements {
		stockValue += m.ValuePaise
	}
	errs := []error{
		expectEq(JournalMismatch, "output cgst", j.net("output_cgst"), n.CgstPaise),
		expectEq(JournalMismatch, "output sgst", j.net("output_sgst"), n.SgstPaise),
		expectEq(JournalMismatch, "output igst", j.net("output_igst"), n.IgstPaise),
		expectEq(JournalMismatch, "output cess", j.net("output_cess"), n.CessPaise),
		expectEq(JournalMismatch, "sales", j.net("sales_goods"), n.TaxablePaise),
		expectEq(JournalMismatch, "round-off", j.net("round_off"), n.RoundOffPaise),
		expectEq(JournalMismatch, "receivable", -j.net("ar"), n.CreditPaise),
		expectEq(JournalMismatch, "refund", -j.netOf("cash", "clearing"), n.RefundPaise),
		expectEq(JournalMismatch, "stock", j.net("inventory"), n.CostPaise),
		expectEq(JournalMismatch, "stock movements", stockValue, n.CostPaise),
		expectEq(JournalMismatch, "cost of goods sold", j.net("cogs"), -n.CostPaise),
	}
	if n.CreditPaise != 0 {
		errs = append(errs, partyControl(j, "ar", "customer", deref(n.CustomerID)), partyEntryAmount(n.Entry, -n.CreditPaise))
	}
	return firstErr(errs...)
}
