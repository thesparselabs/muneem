package verify

import (
	"github.com/sparselabs/muneem/cloud/internal/domain/gst"
)

// invoiceContext is what a stored document says about how it was taxed. The supply type is taken as declared:
// the branch's state is not in the payload, so the cloud checks the lines are taxed consistently with it.
type invoiceContext struct {
	supplierState string
	supplyType    string
	utgst         bool
	taxScheme     string
	billDiscount  int64
	roundToRupee  bool
}

func otherState(state string) string {
	if state == "97" {
		return "96"
	}
	return "97"
}

func recompute(ctx invoiceContext, lines []DocLine) (*gst.InvoiceResult, error) {
	pos := ctx.supplierState
	if ctx.supplyType == "inter" {
		pos = otherState(ctx.supplierState)
	}
	in := &gst.InvoiceInput{
		DocType: "tax_invoice", SupplierStateCode: ctx.supplierState, PlaceOfSupplyStateCode: pos,
		IsUnionTerritoryWithoutLegislature: ctx.utgst, TaxScheme: ctx.taxScheme,
		BillDiscount: gst.Discount{Kind: "amount", Value: ctx.billDiscount}, RoundToRupee: ctx.roundToRupee,
		B2clThresholdPaise: 0, Lines: make([]gst.LineInput, len(lines)),
	}
	for i, l := range lines {
		in.Lines[i] = gst.LineInput{
			QtyMilli: l.QtyMilli, UnitPricePaise: l.UnitPricePaise, PriceIsInclusive: l.PriceIsInclusive,
			LineDiscount: gst.Discount{Kind: l.LineDiscount.Kind, Value: l.LineDiscount.Value}, GstRateBp: l.GstRateBp, CessRateBp: l.CessRateBp,
			CessPerUnitPaise: l.CessPerUnitPaise, TaxTreatment: l.TaxTreatment,
		}
	}
	r, err := gst.ComputeInvoice(in)
	if err != nil {
		return nil, fail(TotalMismatch, "line inputs do not price: %v", err)
	}
	return r, nil
}

func compareLines(got []gst.LineResult, sent []DocLine) error {
	for i, g := range got {
		s := sent[i]
		pairs := []struct {
			what      string
			got, sent int64
		}{
			{"gross", g.GrossPaise, s.GrossPaise}, {"line discount", g.LineDiscountPaise, s.LineDiscountPaise},
			{"bill discount share", g.ApportionedBillDiscountPaise, s.ApportionedBillDiscountPaise}, {"taxable", g.TaxablePaise, s.TaxablePaise},
			{"cgst", g.CgstPaise, s.CgstPaise}, {"sgst", g.SgstPaise, s.SgstPaise}, {"igst", g.IgstPaise, s.IgstPaise}, {"cess", g.CessPaise, s.CessPaise},
			{"total", g.TotalPaise, s.TotalPaise},
		}
		for _, p := range pairs {
			if p.got != p.sent {
				return fail(TotalMismatch, "line %d %s: sent %d, computed %d", i+1, p.what, p.sent, p.got)
			}
		}
	}
	return nil
}

func compareHeads(what string, got gst.InvoiceResult, sent TaxHeads, taxable int64) error {
	return firstErr(
		expectEq(TotalMismatch, what+" taxable", taxable, got.TaxablePaise),
		expectEq(TotalMismatch, what+" cgst", sent.CgstPaise, got.CgstPaise),
		expectEq(TotalMismatch, what+" sgst", sent.SgstPaise, got.SgstPaise),
		expectEq(TotalMismatch, what+" igst", sent.IgstPaise, got.IgstPaise),
		expectEq(TotalMismatch, what+" cess", sent.CessPaise, got.CessPaise),
	)
}
