// Package gst is the Go port of packages/domain/src/gst — JSON tags match the TS types byte-for-byte.
package gst

type Discount struct {
	Kind  string `json:"kind"`  // amount | percent
	Value int64  `json:"value"` // paise when amount; basis points when percent
}

type LineInput struct {
	QtyMilli         int64    `json:"qtyMilli"`
	UnitPricePaise   int64    `json:"unitPricePaise"`
	PriceIsInclusive bool     `json:"priceIsInclusive"`
	LineDiscount     Discount `json:"lineDiscount"`
	GstRateBp        int64    `json:"gstRateBp"`
	CessRateBp       int64    `json:"cessRateBp"`
	CessPerUnitPaise int64    `json:"cessPerUnitPaise"`
	TaxTreatment     string   `json:"taxTreatment"` // taxable | nil_rated | exempt | non_gst | zero_rated
}

type InvoiceInput struct {
	DocType                            string      `json:"docType"`
	SupplierStateCode                  string      `json:"supplierStateCode"`
	PlaceOfSupplyStateCode             string      `json:"placeOfSupplyStateCode"`
	IsUnionTerritoryWithoutLegislature bool        `json:"isUnionTerritoryWithoutLegislature"`
	TaxScheme                          string      `json:"taxScheme"` // regular | composition | unregistered
	CustomerGstin                      *string     `json:"customerGstin,omitempty"`
	BillDiscount                       Discount    `json:"billDiscount"`
	RoundToRupee                       bool        `json:"roundToRupee"`
	B2clThresholdPaise                 int64       `json:"b2clThresholdPaise"`
	Lines                              []LineInput `json:"lines"`
}

type LineResult struct {
	GrossPaise                   int64 `json:"grossPaise"`
	GrossExPaise                 int64 `json:"grossExPaise"`
	LineDiscountPaise            int64 `json:"lineDiscountPaise"`
	ApportionedBillDiscountPaise int64 `json:"apportionedBillDiscountPaise"`
	TaxablePaise                 int64 `json:"taxablePaise"`
	CgstPaise                    int64 `json:"cgstPaise"`
	SgstPaise                    int64 `json:"sgstPaise"`
	IgstPaise                    int64 `json:"igstPaise"`
	CessPaise                    int64 `json:"cessPaise"`
	TotalPaise                   int64 `json:"totalPaise"`
}

type InvoiceResult struct {
	SupplyType        string       `json:"supplyType"`   // intra | inter
	StateTaxKind      string       `json:"stateTaxKind"` // sgst | utgst
	Lines             []LineResult `json:"lines"`
	GrossPaise        int64        `json:"grossPaise"`
	LineDiscountPaise int64        `json:"lineDiscountPaise"`
	BillDiscountPaise int64        `json:"billDiscountPaise"`
	TaxablePaise      int64        `json:"taxablePaise"`
	CgstPaise         int64        `json:"cgstPaise"`
	SgstPaise         int64        `json:"sgstPaise"`
	IgstPaise         int64        `json:"igstPaise"`
	CessPaise         int64        `json:"cessPaise"`
	RoundOffPaise     int64        `json:"roundOffPaise"`
	TotalPaise        int64        `json:"totalPaise"`
	Gstr1Bucket       string       `json:"gstr1Bucket"`
}

type FixtureCase struct {
	Name     string        `json:"name"`
	Input    InvoiceInput  `json:"input"`
	Expected InvoiceResult `json:"expected"`
}

type FixtureFile struct {
	Version int           `json:"version"`
	Cases   []FixtureCase `json:"cases"`
}
