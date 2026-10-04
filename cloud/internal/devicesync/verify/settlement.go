package verify

// paymentAccount mirrors paymentAccount in packages/domain/src/accounting/journal.ts.
func paymentAccount(method string) string {
	if method == "cash" {
		return "cash"
	}
	return "bank"
}

func allocationsWithin(what string, as []AllocationLine, amount int64) error {
	var total int64
	for i, a := range as {
		if a.AmountPaise <= 0 || a.TargetID == "" {
			return fail(PayloadInvalid, "%s allocation %d is not a positive amount on a document", what, i+1)
		}
		total += a.AmountPaise
	}
	if total > amount {
		return fail(TotalMismatch, "%s allocations %d exceed its amount %d", what, total, amount)
	}
	return nil
}

func verifyPayment(p *Payment) error {
	if p.Journal == nil || p.Entry == nil {
		return fail(PayloadInvalid, "payment needs an entry and a journal")
	}
	if p.AmountPaise <= 0 {
		return fail(PayloadInvalid, "payment amount must be positive")
	}
	j := p.Journal
	control, sign := "ar", int64(-1)
	if p.PartyType == "supplier" {
		control, sign = "ap", 1
	}
	return firstErr(
		allocationsWithin("payment", p.Allocations, p.AmountPaise),
		balanced(j),
		expectEq(JournalMismatch, control, j.net(control), sign*p.AmountPaise),
		expectEq(JournalMismatch, paymentAccount(p.Method), j.net(paymentAccount(p.Method)), -sign*p.AmountPaise),
		partyControl(j, control, p.PartyType, p.PartyID),
		partyEntryAmount(p.Entry, sign*p.AmountPaise),
	)
}

func verifyWriteOff(w *WriteOff) error {
	if w.Journal == nil || w.Entry == nil {
		return fail(PayloadInvalid, "write-off needs an entry and a journal")
	}
	j := w.Journal
	return firstErr(
		allocationsWithin("write-off", w.Allocations, w.AmountPaise),
		balanced(j),
		expectEq(JournalMismatch, "bad debts", j.net("bad_debts"), w.AmountPaise),
		expectEq(JournalMismatch, "receivable", j.net("ar"), -w.AmountPaise),
		partyControl(j, "ar", "customer", w.CustomerID),
		partyEntryAmount(w.Entry, -w.AmountPaise),
	)
}

func verifyAllocation(a *Allocation) error {
	if a.CreditID == "" || len(a.Allocations) == 0 {
		return fail(PayloadInvalid, "allocation needs a credit and at least one target")
	}
	return allocationsWithin("allocation", a.Allocations, maxPaise)
}

const maxPaise = 1<<53 - 1

// The expense GST inputs are not in the payload, so only the totals and the journal are checked.
func verifyExpense(e *Expense) error {
	if e.Journal == nil {
		return fail(PayloadInvalid, "expense needs a journal")
	}
	j := e.Journal
	tax := e.TaxHeads.sum()
	credit := -j.net(paymentAccount(e.Method))
	if e.Method == "credit" {
		credit = -j.net("ap")
	}
	errs := []error{
		expectEq(TotalMismatch, "expense total", e.TotalPaise, e.TaxablePaise+tax),
		balanced(j),
		expectEq(JournalMismatch, "input tax", j.netOf(inputTaxRoles...), e.ItcPaise),
		expectEq(JournalMismatch, "paid", credit, e.TotalPaise),
	}
	if e.Method == "credit" {
		errs = append(errs, partyControl(j, "ap", "supplier", deref(e.SupplierID)), partyEntryAmount(e.Entry, -e.TotalPaise))
	}
	return firstErr(errs...)
}
