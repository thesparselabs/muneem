package gst

import (
	"regexp"

	"github.com/sparselabs/muneem/cloud/internal/domain/money"
)

var stateRe = regexp.MustCompile(`^\d{2}$`)

type pre struct {
	gross, grossEx, lineDisc, taxable0 int64
	lineTaxes                          bool
}

// ComputeInvoice mirrors computeInvoice in packages/domain/src/gst/computeInvoice.ts — exact step order.
func ComputeInvoice(in *InvoiceInput) (*InvoiceResult, error) {
	if err := validate(in); err != nil {
		return nil, err
	}
	// 1 supply type
	supplyType := "inter"
	if in.PlaceOfSupplyStateCode == in.SupplierStateCode {
		supplyType = "intra"
	}
	taxesApply := in.TaxScheme == "regular"

	// 2 per line
	pres := make([]pre, len(in.Lines))
	for i, l := range in.Lines {
		lineTaxes := taxesApply && l.TaxTreatment == "taxable"
		p, err := money.MulChecked(l.QtyMilli, l.UnitPricePaise)
		if err != nil {
			return nil, err
		}
		gross, err := money.DivRound(p, 1000)
		if err != nil {
			return nil, err
		}
		grossEx := gross
		if l.PriceIsInclusive && lineTaxes {
			unitCess, err := perUnitCess(l)
			if err != nil {
				return nil, err
			}
			g, err := money.MulChecked(max(0, gross-unitCess), 10_000)
			if err != nil {
				return nil, err
			}
			grossEx, err = money.DivRound(g, 10_000+l.GstRateBp+l.CessRateBp)
			if err != nil {
				return nil, err
			}
		}
		lineDisc, err := discountAmount(l.LineDiscount, grossEx)
		if err != nil {
			return nil, err
		}
		if lineDisc > grossEx {
			return nil, money.Errorf("DISCOUNT_EXCEEDS_VALUE", "line %d: discount %d exceeds value %d", i+1, lineDisc, grossEx)
		}
		pres[i] = pre{gross: gross, grossEx: grossEx, lineDisc: lineDisc, taxable0: grossEx - lineDisc, lineTaxes: lineTaxes}
	}

	// 3 bill discount
	t0 := make([]int64, len(pres))
	for i, p := range pres {
		t0[i] = p.taxable0
	}
	taxable0Sum, err := money.SumInts(t0)
	if err != nil {
		return nil, err
	}
	billDiscTotal, err := discountAmount(in.BillDiscount, taxable0Sum)
	if err != nil {
		return nil, err
	}
	if billDiscTotal > taxable0Sum {
		return nil, money.Errorf("DISCOUNT_EXCEEDS_VALUE", "bill discount %d exceeds taxable %d", billDiscTotal, taxable0Sum)
	}
	billDisc, err := money.Apportion(billDiscTotal, t0)
	if err != nil {
		return nil, err
	}

	// 4 per line tax
	lines := make([]LineResult, len(in.Lines))
	for i, l := range in.Lines {
		p := pres[i]
		taxable := p.taxable0 - billDisc[i]
		var cgst, sgst, igst, cess int64
		if p.lineTaxes {
			if supplyType == "intra" {
				taxTotal, err := money.PctOf(taxable, l.GstRateBp)
				if err != nil {
					return nil, err
				}
				m, err := money.MulChecked(taxable, l.GstRateBp)
				if err != nil {
					return nil, err
				}
				cgst, err = money.DivRound(m, 20_000)
				if err != nil {
					return nil, err
				}
				sgst = taxTotal - cgst
			} else {
				igst, err = money.PctOf(taxable, l.GstRateBp)
				if err != nil {
					return nil, err
				}
			}
			c1, err := money.PctOf(taxable, l.CessRateBp)
			if err != nil {
				return nil, err
			}
			c2, err := perUnitCess(l)
			if err != nil {
				return nil, err
			}
			cess = c1 + c2
		}
		lines[i] = LineResult{
			GrossPaise: p.gross, GrossExPaise: p.grossEx, LineDiscountPaise: p.lineDisc,
			ApportionedBillDiscountPaise: billDisc[i], TaxablePaise: taxable,
			CgstPaise: cgst, SgstPaise: sgst, IgstPaise: igst, CessPaise: cess,
			TotalPaise: taxable + cgst + sgst + igst + cess,
		}
	}

	// 5 sums
	sum := func(f func(LineResult) int64) (int64, error) {
		vs := make([]int64, len(lines))
		for i, l := range lines {
			vs[i] = f(l)
		}
		return money.SumInts(vs)
	}
	res := &InvoiceResult{SupplyType: supplyType, StateTaxKind: "sgst", Lines: lines, BillDiscountPaise: billDiscTotal}
	if supplyType == "intra" && in.IsUnionTerritoryWithoutLegislature {
		res.StateTaxKind = "utgst"
	}
	if res.GrossPaise, err = sum(func(l LineResult) int64 { return l.GrossPaise }); err != nil {
		return nil, err
	}
	if res.LineDiscountPaise, err = sum(func(l LineResult) int64 { return l.LineDiscountPaise }); err != nil {
		return nil, err
	}
	if res.TaxablePaise, err = sum(func(l LineResult) int64 { return l.TaxablePaise }); err != nil {
		return nil, err
	}
	if res.CgstPaise, err = sum(func(l LineResult) int64 { return l.CgstPaise }); err != nil {
		return nil, err
	}
	if res.SgstPaise, err = sum(func(l LineResult) int64 { return l.SgstPaise }); err != nil {
		return nil, err
	}
	if res.IgstPaise, err = sum(func(l LineResult) int64 { return l.IgstPaise }); err != nil {
		return nil, err
	}
	if res.CessPaise, err = sum(func(l LineResult) int64 { return l.CessPaise }); err != nil {
		return nil, err
	}

	// 6 round-off
	totalBefore := res.TaxablePaise + res.CgstPaise + res.SgstPaise + res.IgstPaise + res.CessPaise
	res.TotalPaise = totalBefore
	if in.RoundToRupee {
		r, err := money.DivRound(totalBefore, 100)
		if err != nil {
			return nil, err
		}
		res.TotalPaise = r * 100
		res.RoundOffPaise = res.TotalPaise - totalBefore
	}

	// 7 bucket
	res.Gstr1Bucket = bucketOf(in, supplyType, res.TotalPaise)
	return res, nil
}

func bucketOf(in *InvoiceInput, supplyType string, totalPaise int64) string {
	if in.TaxScheme != "regular" {
		return "na"
	}
	hasGstin := in.CustomerGstin != nil && *in.CustomerGstin != ""
	if in.DocType == "credit_note" {
		if hasGstin {
			return "cdnr"
		}
		return "cdnur"
	}
	if hasGstin {
		return "b2b"
	}
	if supplyType == "inter" && totalPaise > in.B2clThresholdPaise {
		return "b2cl"
	}
	treatments := map[string]bool{}
	for _, l := range in.Lines {
		treatments[l.TaxTreatment] = true
	}
	if !treatments["taxable"] {
		if len(treatments) == 1 {
			for only := range treatments {
				switch only {
				case "zero_rated":
					return "exports"
				case "nil_rated":
					return "nil_rated"
				case "non_gst":
					return "non_gst"
				}
			}
			return "exempt"
		}
		return "exempt"
	}
	return "b2cs"
}

func discountAmount(d Discount, base int64) (int64, error) {
	if d.Kind == "percent" {
		return money.PctOf(base, d.Value)
	}
	return d.Value, nil
}

func validate(in *InvoiceInput) error {
	if !stateRe.MatchString(in.SupplierStateCode) || !stateRe.MatchString(in.PlaceOfSupplyStateCode) {
		return money.Errorf("INVALID_INPUT", "state codes must be 2 digits")
	}
	if len(in.Lines) == 0 {
		return money.Errorf("INVALID_INPUT", "invoice needs at least one line")
	}
	if _, err := money.AssertSafeInt(in.B2clThresholdPaise, "b2clThresholdPaise"); err != nil {
		return err
	}
	if err := validateDiscount(in.BillDiscount, "bill"); err != nil {
		return err
	}
	for i, l := range in.Lines {
		if err := validateLine(l, i); err != nil {
			return err
		}
	}
	return nil
}

func validateDiscount(d Discount, what string) error {
	if _, err := money.AssertSafeInt(d.Value, what+" discount"); err != nil {
		return err
	}
	if d.Value < 0 {
		return money.Errorf("INVALID_INPUT", "%s discount must be >= 0", what)
	}
	if d.Kind == "percent" && d.Value > 10_000 {
		return money.Errorf("INVALID_INPUT", "%s discount > 100%%", what)
	}
	if d.Kind != "percent" && d.Kind != "amount" {
		return money.Errorf("INVALID_INPUT", "%s discount kind invalid", what)
	}
	return nil
}

func validateLine(l LineInput, i int) error {
	at := "line " + itoa(i+1)
	for _, v := range []struct {
		n    int64
		what string
	}{{l.QtyMilli, "qtyMilli"}, {l.UnitPricePaise, "unitPricePaise"}, {l.GstRateBp, "gstRateBp"}, {l.CessRateBp, "cessRateBp"}, {l.CessPerUnitPaise, "cessPerUnitPaise"}} {
		if _, err := money.AssertSafeInt(v.n, at+" "+v.what); err != nil {
			return err
		}
	}
	if l.QtyMilli <= 0 {
		return money.Errorf("INVALID_INPUT", "%s: qty must be > 0", at)
	}
	if l.UnitPricePaise < 0 {
		return money.Errorf("INVALID_INPUT", "%s: price must be >= 0", at)
	}
	if l.GstRateBp < 0 || l.CessRateBp < 0 || l.CessPerUnitPaise < 0 {
		return money.Errorf("INVALID_INPUT", "%s: rates must be >= 0", at)
	}
	return validateDiscount(l.LineDiscount, at)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}

func perUnitCess(l LineInput) (int64, error) {
	m, err := money.MulChecked(l.QtyMilli, l.CessPerUnitPaise)
	if err != nil {
		return 0, err
	}
	return money.DivRound(m, 1000)
}
