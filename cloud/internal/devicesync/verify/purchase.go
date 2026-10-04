package verify

// billTolerancePaise mirrors BILL_TOLERANCE_PAISE: the supplier's own grand total wins within ±₹1.
const billTolerancePaise = 100

func verifyPurchase(p *Purchase) error {
	if p.Totals == nil || p.Journal == nil || p.Entry == nil || p.Supplier == nil || len(p.Lines) == 0 {
		return fail(PayloadInvalid, "purchase needs lines, totals, supplier, entry and a journal")
	}
	return firstErr(purchaseTotals(p), purchaseLanding(p), allBalanced(append([]*Journal{p.Journal}, refs(p.Corrections)...)...), purchaseJournal(p))
}

func docLines(ls []PurchaseLine) []DocLine {
	out := make([]DocLine, len(ls))
	for i, l := range ls {
		out[i] = l.DocLine
	}
	return out
}

func chargesOf(cs []Charge) int64 {
	var n int64
	for _, c := range cs {
		n += c.AmountPaise
	}
	return n
}

func purchaseTotals(p *Purchase) error {
	t := p.Totals
	got, err := recompute(invoiceContext{
		supplierState: validState(p.Supplier.StateCode), supplyType: t.SupplyType, utgst: t.StateTaxKind == "utgst", taxScheme: p.Supplier.TaxScheme,
		billDiscount: t.BillDiscountPaise,
	}, docLines(p.Lines))
	if err != nil {
		return err
	}
	if t.RoundOffPaise > billTolerancePaise || t.RoundOffPaise < -billTolerancePaise {
		return fail(TotalMismatch, "purchase round-off %d is beyond ±%d", t.RoundOffPaise, billTolerancePaise)
	}
	return firstErr(
		compareLines(got.Lines, docLines(p.Lines)),
		compareHeads("purchase", *got, t.TaxHeads, t.TaxablePaise),
		expectEq(TotalMismatch, "purchase total", t.TotalPaise, got.TotalPaise+chargesOf(p.Charges)+t.RoundOffPaise),
	)
}

// Each line lands at taxable + its share of charges + tax that cannot be claimed; the shares add up to the charges.
func purchaseLanding(p *Purchase) error {
	var shares int64
	for i, l := range p.Lines {
		unclaimed := l.TaxHeads.sum()
		if l.ItcEligible {
			unclaimed = 0
		}
		if l.LandedValuePaise != l.TaxablePaise+l.ChargesPaise+unclaimed {
			return fail(TotalMismatch, "line %d landed value %d is not taxable + charges + unclaimed tax", i+1, l.LandedValuePaise)
		}
		shares += l.ChargesPaise
	}
	return expectEq(TotalMismatch, "charge shares", shares, chargesOf(p.Charges))
}

func purchaseJournal(p *Purchase) error {
	j := p.Journal
	var itc TaxHeads
	var landed, stockValue int64
	for _, l := range p.Lines {
		landed += l.LandedValuePaise
		if l.ItcEligible {
			itc.CgstPaise += l.CgstPaise
			itc.SgstPaise += l.SgstPaise
			itc.IgstPaise += l.IgstPaise
			itc.CessPaise += l.CessPaise
		}
	}
	for _, m := range p.Movements {
		stockValue += m.ValuePaise
	}
	return firstErr(
		expectEq(JournalMismatch, "input cgst", j.net("input_cgst"), itc.CgstPaise),
		expectEq(JournalMismatch, "input sgst", j.net("input_sgst"), itc.SgstPaise),
		expectEq(JournalMismatch, "input igst", j.net("input_igst"), itc.IgstPaise),
		expectEq(JournalMismatch, "input cess", j.net("input_cess"), itc.CessPaise),
		expectEq(JournalMismatch, "stock", j.net("inventory"), landed),
		expectEq(JournalMismatch, "stock movements", stockValue, landed),
		expectEq(JournalMismatch, "round-off", j.net("round_off"), p.Totals.RoundOffPaise),
		expectEq(JournalMismatch, "payable", -j.net("ap"), p.Totals.TotalPaise),
		partyControl(j, "ap", "supplier", p.SupplierID),
		partyEntryAmount(p.Entry, -p.Totals.TotalPaise),
	)
}

func verifyDebitNote(n *DebitNote) error {
	if n.Journal == nil || n.Entry == nil || len(n.Lines) == 0 {
		return fail(PayloadInvalid, "debit note needs lines, entry and a journal")
	}
	var linesTotal, stockValue int64
	for i, l := range n.Lines {
		if l.TotalPaise != l.TaxablePaise+l.TaxHeads.sum() {
			return fail(TotalMismatch, "debit note line %d total is not taxable + tax", i+1)
		}
		linesTotal += l.TotalPaise
	}
	for _, m := range n.Movements {
		stockValue += m.ValuePaise
	}
	j := n.Journal
	return firstErr(
		expectEq(TotalMismatch, "debit note total", n.TotalPaise, linesTotal+n.ChargesPaise+n.RoundOffPaise),
		allBalanced(append([]*Journal{j}, refs(n.Corrections)...)...),
		expectEq(JournalMismatch, "payable", j.net("ap"), n.TotalPaise),
		expectEq(JournalMismatch, "stock", j.net("inventory"), stockValue),
		expectEq(JournalMismatch, "input tax reversed", -j.netOf(inputTaxRoles...), n.ItcReversedPaise),
		partyControl(j, "ap", "supplier", n.SupplierID),
		partyEntryAmount(n.Entry, n.TotalPaise),
	)
}
