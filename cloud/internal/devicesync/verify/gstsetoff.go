package verify

import "github.com/sparselabs/muneem/cloud/internal/domain/gst"

type GstSetoff struct {
	Month       string          `json:"month"`
	Liability   gst.Heads       `json:"liability"`
	Credit      gst.Heads       `json:"credit"`
	Utilisation gst.Utilisation `json:"utilisation"`
	Cash        gst.Heads       `json:"cash"`
	Journal     *Journal        `json:"journal"`
}

type GstPayment struct {
	ChallanRef string   `json:"challanRef"`
	TotalPaise int64    `json:"totalPaise"`
	Journal    *Journal `json:"journal"`
	TaxHeads
}

var setoffRoles = map[string]bool{
	"output_igst": true, "output_cgst": true, "output_sgst": true, "output_cess": true,
	"input_igst": true, "input_cgst": true, "input_sgst": true, "input_cess": true, "gst_payable": true,
}

// ADR-0044: the utilisation is recomputed from the balances the device set off, in the statutory order, and the journal must
// clear each output head, take the credit used from each input head and move the rest to GST Payable — and touch nothing else.
func verifyGstSetoff(s *GstSetoff) error {
	if !dayRe.MatchString(s.Month) || s.Month[8:] != "01" {
		return fail(PayloadInvalid, "set-off month %q is not the first day of a month", s.Month)
	}
	want, err := gst.ComputeSetoff(s.Liability, s.Credit)
	if err != nil {
		return fail(TotalMismatch, "set-off: %v", err)
	}
	if want.Utilisation != s.Utilisation || want.Cash != s.Cash {
		return fail(TotalMismatch, "set-off utilisation %+v and cash %+v, expected %+v and %+v", s.Utilisation, s.Cash, want.Utilisation, want.Cash)
	}
	if s.Journal == nil {
		return expectEq(JournalMismatch, "set-off with no journal clears", s.Liability.Total(), 0)
	}
	return setoffJournal(s.Journal, s.Liability, want.CreditUsed, want.Cash.Total())
}

func setoffJournal(j *Journal, liability, used gst.Heads, cash int64) error {
	for i, l := range j.Lines {
		if !setoffRoles[l.Account.Role] || l.Party != nil {
			return fail(JournalMismatch, "set-off journal line %d posts to %q", i+1, l.Account.Role+l.Account.Code)
		}
	}
	return firstErr(
		expectEq(JournalMismatch, "output IGST cleared", j.net("output_igst"), liability.IgstPaise),
		expectEq(JournalMismatch, "output CGST cleared", j.net("output_cgst"), liability.CgstPaise),
		expectEq(JournalMismatch, "output SGST cleared", j.net("output_sgst"), liability.SgstPaise),
		expectEq(JournalMismatch, "output cess cleared", j.net("output_cess"), liability.CessPaise),
		expectEq(JournalMismatch, "input IGST used", -j.net("input_igst"), used.IgstPaise),
		expectEq(JournalMismatch, "input CGST used", -j.net("input_cgst"), used.CgstPaise),
		expectEq(JournalMismatch, "input SGST used", -j.net("input_sgst"), used.SgstPaise),
		expectEq(JournalMismatch, "input cess used", -j.net("input_cess"), used.CessPaise),
		expectEq(JournalMismatch, "GST payable", -j.net("gst_payable"), cash),
	)
}

// A challan: its heads add up to it, and its journal moves exactly that from the bank to GST Payable.
func verifyGstPayment(p *GstPayment) error {
	if p.ChallanRef == "" || p.TotalPaise <= 0 || p.Journal == nil {
		return fail(PayloadInvalid, "GST payment needs a challan, a positive total and a journal")
	}
	for i, l := range p.Journal.Lines {
		if (l.Account.Role != "gst_payable" && l.Account.Role != "bank") || l.Party != nil {
			return fail(JournalMismatch, "GST payment journal line %d posts to %q", i+1, l.Account.Role+l.Account.Code)
		}
	}
	return firstErr(
		expectEq(TotalMismatch, "GST payment heads", p.sum(), p.TotalPaise),
		expectEq(JournalMismatch, "GST payable paid", p.Journal.net("gst_payable"), p.TotalPaise),
		expectEq(JournalMismatch, "bank", -p.Journal.net("bank"), p.TotalPaise),
	)
}
