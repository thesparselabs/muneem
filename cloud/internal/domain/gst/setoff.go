package gst

import "github.com/sparselabs/muneem/cloud/internal/domain/money"

// Heads is tax by head; JSON tags match GstHeads in packages/domain/src/gst/returns/types.ts.
type Heads struct {
	IgstPaise int64 `json:"igstPaise"`
	CgstPaise int64 `json:"cgstPaise"`
	SgstPaise int64 `json:"sgstPaise"`
	CessPaise int64 `json:"cessPaise"`
}

// Utilisation is every move CGST Act s.49 and rule 88A allow; CGST and SGST credit never pay each other.
type Utilisation struct {
	IgstToIgstPaise int64 `json:"igstToIgstPaise"`
	IgstToCgstPaise int64 `json:"igstToCgstPaise"`
	IgstToSgstPaise int64 `json:"igstToSgstPaise"`
	CgstToCgstPaise int64 `json:"cgstToCgstPaise"`
	CgstToIgstPaise int64 `json:"cgstToIgstPaise"`
	SgstToSgstPaise int64 `json:"sgstToSgstPaise"`
	SgstToIgstPaise int64 `json:"sgstToIgstPaise"`
	CessToCessPaise int64 `json:"cessToCessPaise"`
}

type SetoffResult struct {
	Liability   Heads       `json:"liability"`
	Credit      Heads       `json:"credit"`
	Utilisation Utilisation `json:"utilisation"`
	CreditUsed  Heads       `json:"creditUsed"`
	CreditLeft  Heads       `json:"creditLeft"`
	Cash        Heads       `json:"cash"`
}

func (h Heads) Total() int64 { return h.IgstPaise + h.CgstPaise + h.SgstPaise + h.CessPaise }

func validHeads(h Heads, what string) error {
	for _, v := range []int64{h.IgstPaise, h.CgstPaise, h.SgstPaise, h.CessPaise} {
		if v < 0 || v > money.MaxSafeInt {
			return money.Errorf("INVALID_INPUT", "%s must be whole paise >= 0", what)
		}
	}
	return nil
}

// ComputeSetoff is the port of computeSetoff (ADR-0044): IGST credit first — to IGST, then to whatever CGST and SGST
// their own credit cannot cover, then CGST, then SGST; CGST credit to CGST then IGST; SGST to SGST then IGST; cess to cess.
func ComputeSetoff(liability, credit Heads) (SetoffResult, error) {
	if err := validHeads(liability, "liability"); err != nil {
		return SetoffResult{}, err
	}
	if err := validHeads(credit, "credit"); err != nil {
		return SetoffResult{}, err
	}
	owe, have := liability, credit
	use := func(from, to *int64, limit int64) int64 {
		a := min(*from, *to, limit)
		*from -= a
		*to -= a
		return a
	}
	all := money.MaxSafeInt
	var u Utilisation
	u.IgstToIgstPaise = use(&have.IgstPaise, &owe.IgstPaise, all)
	cgstShort := max(0, owe.CgstPaise-have.CgstPaise)
	sgstShort := max(0, owe.SgstPaise-have.SgstPaise)
	u.IgstToCgstPaise = use(&have.IgstPaise, &owe.CgstPaise, cgstShort)
	u.IgstToSgstPaise = use(&have.IgstPaise, &owe.SgstPaise, sgstShort)
	u.IgstToCgstPaise += use(&have.IgstPaise, &owe.CgstPaise, all)
	u.IgstToSgstPaise += use(&have.IgstPaise, &owe.SgstPaise, all)
	u.CgstToCgstPaise = use(&have.CgstPaise, &owe.CgstPaise, all)
	u.CgstToIgstPaise = use(&have.CgstPaise, &owe.IgstPaise, all)
	u.SgstToSgstPaise = use(&have.SgstPaise, &owe.SgstPaise, all)
	u.SgstToIgstPaise = use(&have.SgstPaise, &owe.IgstPaise, all)
	u.CessToCessPaise = use(&have.CessPaise, &owe.CessPaise, all)
	return SetoffResult{Liability: liability, Credit: credit, Utilisation: u, CreditUsed: CreditUsedBy(u), CreditLeft: have, Cash: owe}, nil
}

func CreditUsedBy(u Utilisation) Heads {
	return Heads{
		IgstPaise: u.IgstToIgstPaise + u.IgstToCgstPaise + u.IgstToSgstPaise, CgstPaise: u.CgstToCgstPaise + u.CgstToIgstPaise,
		SgstPaise: u.SgstToSgstPaise + u.SgstToIgstPaise, CessPaise: u.CessToCessPaise,
	}
}
