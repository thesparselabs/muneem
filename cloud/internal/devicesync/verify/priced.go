package verify

// PricedDocument is an estimate or a delivery challan (FR-086/087, ADR-0068/0069): priced like a sale and posting
// nothing, so it carries no journal.
type PricedDocument struct {
	Lines  []DocLine  `json:"lines"`
	Totals *DocTotals `json:"totals"`
}

// DocumentLink is such a document's one update: the sale that billed it.
type DocumentLink struct {
	Status string `json:"status"`
	SaleID string `json:"saleId"`
}

// linkStatus is the status each priced document's update must set.
var linkStatus = map[string]string{"estimate": "converted", "delivery_challan": "billed"}

func verifyPricedDocument(d *PricedDocument) error {
	if d.Totals == nil || len(d.Lines) == 0 {
		return fail(PayloadInvalid, "a priced document needs lines and totals")
	}
	return saleTotals(&Sale{Lines: d.Lines, Totals: d.Totals})
}

func verifyLink(status string) func(*DocumentLink) error {
	return func(l *DocumentLink) error {
		if l.Status != status || l.SaleID == "" {
			return fail(PayloadInvalid, "this document changes only by being billed (status %s and a sale)", status)
		}
		return nil
	}
}
