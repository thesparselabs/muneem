package verify

// Estimate is a quotation (FR-086, ADR-0068): priced like a sale and posting nothing, so it carries no journal.
type Estimate struct {
	Lines  []DocLine  `json:"lines"`
	Totals *DocTotals `json:"totals"`
}

// EstimateConversion is an estimate's one update: the sale that billed it.
type EstimateConversion struct {
	Status string `json:"status"`
	SaleID string `json:"saleId"`
}

func verifyEstimate(e *Estimate) error {
	if e.Totals == nil || len(e.Lines) == 0 {
		return fail(PayloadInvalid, "estimate needs lines and totals")
	}
	return saleTotals(&Sale{Lines: e.Lines, Totals: e.Totals})
}

func verifyEstimateConversion(c *EstimateConversion) error {
	if c.Status != "converted" || c.SaleID == "" {
		return fail(PayloadInvalid, "an estimate changes only by being converted into a sale")
	}
	return nil
}
