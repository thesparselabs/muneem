// Package returns is the Go port of packages/domain/src/sales/returns.ts (ADR-0043).
package returns

import "github.com/sparselabs/muneem/cloud/internal/domain/money"

type SoldLine struct {
	QtyMilli     int64 `json:"qtyMilli"`
	BaseQtyMilli int64 `json:"baseQtyMilli"`
	TaxablePaise int64 `json:"taxablePaise"`
	CgstPaise    int64 `json:"cgstPaise"`
	SgstPaise    int64 `json:"sgstPaise"`
	IgstPaise    int64 `json:"igstPaise"`
	CessPaise    int64 `json:"cessPaise"`
	CogsPaise    int64 `json:"cogsPaise"`
}

type LineInput struct {
	Line                SoldLine `json:"line"`
	ReturnedBeforeMilli int64    `json:"returnedBeforeMilli"`
	QtyMilli            int64    `json:"qtyMilli"`
}

type Input struct {
	Lines                 []LineInput `json:"lines"`
	SaleRoundOffPaise     int64       `json:"saleRoundOffPaise"`
	RoundOffReturnedPaise int64       `json:"roundOffReturnedPaise"`
}

type LineResult struct {
	QtyMilli     int64 `json:"qtyMilli"`
	BaseQtyMilli int64 `json:"baseQtyMilli"`
	TaxablePaise int64 `json:"taxablePaise"`
	CgstPaise    int64 `json:"cgstPaise"`
	SgstPaise    int64 `json:"sgstPaise"`
	IgstPaise    int64 `json:"igstPaise"`
	CessPaise    int64 `json:"cessPaise"`
	TotalPaise   int64 `json:"totalPaise"`
	CostPaise    int64 `json:"costPaise"`
}

type Result struct {
	Lines         []LineResult `json:"lines"`
	TaxablePaise  int64        `json:"taxablePaise"`
	CgstPaise     int64        `json:"cgstPaise"`
	SgstPaise     int64        `json:"sgstPaise"`
	IgstPaise     int64        `json:"igstPaise"`
	CessPaise     int64        `json:"cessPaise"`
	RoundOffPaise int64        `json:"roundOffPaise"`
	TotalPaise    int64        `json:"totalPaise"`
	CostPaise     int64        `json:"costPaise"`
	CompletesSale bool         `json:"completesSale"`
}

// CumulativeShare mirrors cumulativeShare: what qty more units carry after before, rounded cumulatively.
func CumulativeShare(amount, wholeQty, beforeQty, qty int64) (int64, error) {
	for _, v := range []int64{amount, wholeQty, beforeQty, qty} {
		if _, err := money.AssertSafeInt(v, "share input"); err != nil || v < 0 {
			return 0, money.Errorf("INVALID_INPUT", "share inputs must be whole numbers ≥ 0, got %d", v)
		}
	}
	if wholeQty == 0 || beforeQty+qty > wholeQty {
		return 0, money.Errorf("INVALID_INPUT", "cannot take %d more of %d after %d", qty, wholeQty, beforeQty)
	}
	upto, err := mulDiv(amount, beforeQty+qty, wholeQty)
	if err != nil {
		return 0, err
	}
	already, err := mulDiv(amount, beforeQty, wholeQty)
	if err != nil {
		return 0, err
	}
	return upto - already, nil
}

func mulDiv(a, b, d int64) (int64, error) {
	p, err := money.MulChecked(a, b)
	if err != nil {
		return 0, err
	}
	return money.DivRound(p, d)
}

func ComputeLine(r LineInput) (LineResult, error) {
	amounts := []int64{r.Line.BaseQtyMilli, r.Line.TaxablePaise, r.Line.CgstPaise, r.Line.SgstPaise, r.Line.IgstPaise, r.Line.CessPaise, r.Line.CogsPaise}
	s := make([]int64, len(amounts))
	for i, a := range amounts {
		v, err := CumulativeShare(a, r.Line.QtyMilli, r.ReturnedBeforeMilli, r.QtyMilli)
		if err != nil {
			return LineResult{}, err
		}
		s[i] = v
	}
	return LineResult{
		QtyMilli: r.QtyMilli, BaseQtyMilli: s[0], TaxablePaise: s[1], CgstPaise: s[2], SgstPaise: s[3], IgstPaise: s[4], CessPaise: s[5],
		TotalPaise: s[1] + s[2] + s[3] + s[4] + s[5], CostPaise: s[6],
	}, nil
}

func Compute(in Input) (*Result, error) {
	if _, err := money.AssertSafeInt(in.SaleRoundOffPaise, "sale round-off"); err != nil {
		return nil, money.Errorf("INVALID_INPUT", "sale round-off must be whole paise")
	}
	if _, err := money.AssertSafeInt(in.RoundOffReturnedPaise, "round-off returned"); err != nil {
		return nil, money.Errorf("INVALID_INPUT", "round-off returned must be whole paise")
	}
	if len(in.Lines) == 0 {
		return nil, money.Errorf("INVALID_INPUT", "a return needs at least one line")
	}
	r := &Result{Lines: make([]LineResult, len(in.Lines)), CompletesSale: true}
	for i, l := range in.Lines {
		got, err := ComputeLine(l)
		if err != nil {
			return nil, err
		}
		r.Lines[i] = got
		r.TaxablePaise += got.TaxablePaise
		r.CgstPaise += got.CgstPaise
		r.SgstPaise += got.SgstPaise
		r.IgstPaise += got.IgstPaise
		r.CessPaise += got.CessPaise
		r.TotalPaise += got.TotalPaise
		r.CostPaise += got.CostPaise
		if l.ReturnedBeforeMilli+l.QtyMilli != l.Line.QtyMilli {
			r.CompletesSale = false
		}
	}
	if r.CompletesSale {
		r.RoundOffPaise = in.SaleRoundOffPaise - in.RoundOffReturnedPaise
	}
	r.TotalPaise += r.RoundOffPaise
	return r, nil
}
