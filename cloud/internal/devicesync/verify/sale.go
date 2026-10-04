package verify

import "regexp"

var stateCodeRe = regexp.MustCompile(`^\d{2}$`)

func validState(s string) string {
	if stateCodeRe.MatchString(s) {
		return s
	}
	return "07"
}

func saleScheme(docType string) string {
	if docType == "bill_of_supply" {
		return "composition"
	}
	return "regular"
}

func verifySale(s *Sale) error {
	if s.Totals == nil || s.Journal == nil || len(s.Lines) == 0 {
		return fail(PayloadInvalid, "sale needs lines, totals and a journal")
	}
	return firstErr(saleTotals(s), saleTenders(s), balanced(s.Journal), saleJournal(s))
}

func saleTotals(s *Sale) error {
	t := s.Totals
	got, err := recompute(invoiceContext{
		supplierState: validState(t.PlaceOfSupplyState), supplyType: t.SupplyType, utgst: t.StateTaxKind == "utgst", taxScheme: saleScheme(t.DocType),
		billDiscount: t.BillDiscountPaise, roundToRupee: t.RoundOffPaise != 0,
	}, s.Lines)
	if err != nil {
		return err
	}
	return firstErr(
		compareLines(got.Lines, s.Lines),
		compareHeads("sale", *got, t.TaxHeads, t.TaxablePaise),
		expectEq(TotalMismatch, "sale round-off", t.RoundOffPaise, got.RoundOffPaise),
		expectEq(TotalMismatch, "sale total", t.TotalPaise, got.TotalPaise),
	)
}

// Σ tenders = total + change; the credit tender is what the customer owes.
func saleTenders(s *Sale) error {
	var paid, change, credit int64
	for _, t := range s.Tenders {
		paid += t.AmountPaise
		change += t.ChangePaise
		if t.Method == "credit" {
			credit += t.AmountPaise
		}
	}
	return firstErr(
		expectEq(TotalMismatch, "tenders", paid, s.Totals.TotalPaise+s.ChangePaise),
		expectEq(TotalMismatch, "change", change, s.ChangePaise),
		expectEq(TotalMismatch, "credit tender", credit, s.CreditPaise),
	)
}

func saleJournal(s *Sale) error {
	j, t := s.Journal, s.Totals
	var stockValue int64
	for _, m := range s.Movements {
		stockValue += m.ValuePaise
	}
	errs := []error{
		expectEq(JournalMismatch, "output cgst", -j.net("output_cgst"), t.CgstPaise),
		expectEq(JournalMismatch, "output sgst", -j.net("output_sgst"), t.SgstPaise),
		expectEq(JournalMismatch, "output igst", -j.net("output_igst"), t.IgstPaise),
		expectEq(JournalMismatch, "output cess", -j.net("output_cess"), t.CessPaise),
		expectEq(JournalMismatch, "sales", -j.net("sales_goods"), t.TaxablePaise),
		expectEq(JournalMismatch, "round-off", -j.net("round_off"), t.RoundOffPaise),
		expectEq(JournalMismatch, "receivable", j.net("ar"), s.CreditPaise),
		expectEq(JournalMismatch, "takings", j.netOf("cash", "clearing", "ar"), t.TotalPaise),
		expectEq(JournalMismatch, "stock", j.net("inventory"), stockValue),
		expectEq(JournalMismatch, "cost of goods sold", j.net("cogs"), -stockValue),
	}
	if s.CreditPaise != 0 {
		errs = append(errs, partyControl(j, "ar", "customer", deref(s.CustomerID)), partyEntryAmount(s.PartyEntry, s.CreditPaise))
	}
	return firstErr(errs...)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func partyControl(j *Journal, role, partyType, partyID string) error {
	for _, p := range j.partyOn(role) {
		if p == nil || p.PartyType != partyType || p.PartyID != partyID {
			return fail(JournalMismatch, "%s line is not on %s %s", role, partyType, partyID)
		}
	}
	return nil
}

func partyEntryAmount(e *PartyEntry, want int64) error {
	if e == nil {
		return fail(JournalMismatch, "party entry missing for %d", want)
	}
	return expectEq(JournalMismatch, "party entry", e.AmountPaise, want)
}
