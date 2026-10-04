package verify

// The fields verification reads from the 7a payload shapes (packages/contracts/src/sync/payloads.ts); anything else is ignored.

type Party struct {
	PartyType string `json:"partyType"`
	PartyID   string `json:"partyId"`
}

type Account struct {
	Role string `json:"role"`
	Code string `json:"code"`
}

type JournalLine struct {
	Account     Account `json:"account"`
	DebitPaise  int64   `json:"debitPaise"`
	CreditPaise int64   `json:"creditPaise"`
	Party       *Party  `json:"party"`
}

type Journal struct {
	ID          string        `json:"id"`
	EntryNo     string        `json:"entryNo"`
	EntryDate   string        `json:"entryDate"`
	DocDate     string        `json:"docDate"`
	PeriodID    string        `json:"periodId"`
	Source      string        `json:"source"`
	RefType     string        `json:"refType"`
	RefID       string        `json:"refId"`
	Narration   *string       `json:"narration"`
	BranchID    *string       `json:"branchId"`
	TerminalID  *string       `json:"terminalId"`
	LatePosting bool          `json:"latePosting"`
	ReversalOf  *string       `json:"reversalOf"`
	Lines       []JournalLine `json:"lines"`
}

type Movement struct {
	Type       string `json:"type"`
	ValuePaise int64  `json:"valuePaise"`
}

type PartyEntry struct {
	PartyType   string `json:"partyType"`
	PartyID     string `json:"partyId"`
	AmountPaise int64  `json:"amountPaise"`
}

type TaxHeads struct {
	CgstPaise int64 `json:"cgstPaise"`
	SgstPaise int64 `json:"sgstPaise"`
	IgstPaise int64 `json:"igstPaise"`
	CessPaise int64 `json:"cessPaise"`
}

func (h TaxHeads) sum() int64 { return h.CgstPaise + h.SgstPaise + h.IgstPaise + h.CessPaise }

type Discount struct {
	Kind  string `json:"kind"`
	Value int64  `json:"value"`
}

type DocLine struct {
	QtyMilli                     int64    `json:"qtyMilli"`
	UnitPricePaise               int64    `json:"unitPricePaise"`
	PriceIsInclusive             bool     `json:"priceIsInclusive"`
	LineDiscount                 Discount `json:"lineDiscount"`
	GstRateBp                    int64    `json:"gstRateBp"`
	CessRateBp                   int64    `json:"cessRateBp"`
	CessPerUnitPaise             int64    `json:"cessPerUnitPaise"`
	TaxTreatment                 string   `json:"taxTreatment"`
	GrossPaise                   int64    `json:"grossPaise"`
	LineDiscountPaise            int64    `json:"lineDiscountPaise"`
	ApportionedBillDiscountPaise int64    `json:"apportionedBillDiscountPaise"`
	TaxablePaise                 int64    `json:"taxablePaise"`
	TotalPaise                   int64    `json:"totalPaise"`
	TaxHeads
}

type DocTotals struct {
	DocType            string `json:"docType"`
	SupplyType         string `json:"supplyType"`
	StateTaxKind       string `json:"stateTaxKind"`
	PlaceOfSupplyState string `json:"placeOfSupplyState"`
	BillDiscountPaise  int64  `json:"billDiscountPaise"`
	TaxablePaise       int64  `json:"taxablePaise"`
	RoundOffPaise      int64  `json:"roundOffPaise"`
	TotalPaise         int64  `json:"totalPaise"`
	TaxHeads
}

type Tender struct {
	Method      string `json:"method"`
	AmountPaise int64  `json:"amountPaise"`
	ChangePaise int64  `json:"changePaise"`
}

type Sale struct {
	CustomerID  *string     `json:"customerId"`
	Lines       []DocLine   `json:"lines"`
	Tenders     []Tender    `json:"tenders"`
	Totals      *DocTotals  `json:"totals"`
	CreditPaise int64       `json:"creditPaise"`
	ChangePaise int64       `json:"changePaise"`
	Movements   []Movement  `json:"movements"`
	PartyEntry  *PartyEntry `json:"partyEntry"`
	Journal     *Journal    `json:"journal"`
}

type PurchaseLine struct {
	DocLine
	ItcEligible      bool  `json:"itcEligible"`
	LandedValuePaise int64 `json:"landedValuePaise"`
	ChargesPaise     int64 `json:"chargesPaise"`
}

type Charge struct {
	AmountPaise int64 `json:"amountPaise"`
}

type Supplier struct {
	StateCode string `json:"stateCode"`
	TaxScheme string `json:"taxScheme"`
}

type Purchase struct {
	SupplierID  string         `json:"supplierId"`
	Supplier    *Supplier      `json:"supplier"`
	Lines       []PurchaseLine `json:"lines"`
	Charges     []Charge       `json:"charges"`
	Totals      *DocTotals     `json:"totals"`
	Movements   []Movement     `json:"movements"`
	Corrections []Journal      `json:"corrections"`
	Entry       *PartyEntry    `json:"entry"`
	Journal     *Journal       `json:"journal"`
}

type DebitNoteLine struct {
	TaxablePaise int64 `json:"taxablePaise"`
	TotalPaise   int64 `json:"totalPaise"`
	TaxHeads
}

type DebitNote struct {
	SupplierID       string          `json:"supplierId"`
	TotalPaise       int64           `json:"totalPaise"`
	ChargesPaise     int64           `json:"chargesPaise"`
	RoundOffPaise    int64           `json:"roundOffPaise"`
	ItcReversedPaise int64           `json:"itcReversedPaise"`
	Lines            []DebitNoteLine `json:"lines"`
	Movements        []Movement      `json:"movements"`
	Corrections      []Journal       `json:"corrections"`
	Entry            *PartyEntry     `json:"entry"`
	Journal          *Journal        `json:"journal"`
}

type AllocationLine struct {
	TargetType  string `json:"targetType"`
	TargetID    string `json:"targetId"`
	AmountPaise int64  `json:"amountPaise"`
}

type Payment struct {
	PartyType   string           `json:"partyType"`
	PartyID     string           `json:"partyId"`
	Method      string           `json:"method"`
	AmountPaise int64            `json:"amountPaise"`
	Allocations []AllocationLine `json:"allocations"`
	Entry       *PartyEntry      `json:"entry"`
	Journal     *Journal         `json:"journal"`
}

type WriteOff struct {
	CustomerID  string           `json:"customerId"`
	AmountPaise int64            `json:"amountPaise"`
	Allocations []AllocationLine `json:"allocations"`
	Entry       *PartyEntry      `json:"entry"`
	Journal     *Journal         `json:"journal"`
}

type Expense struct {
	Method       string      `json:"method"`
	SupplierID   *string     `json:"supplierId"`
	TaxablePaise int64       `json:"taxablePaise"`
	ItcPaise     int64       `json:"itcPaise"`
	TotalPaise   int64       `json:"totalPaise"`
	Entry        *PartyEntry `json:"entry"`
	Journal      *Journal    `json:"journal"`
	TaxHeads
}

type StockDocument struct {
	Kind        string     `json:"kind"`
	Movements   []Movement `json:"movements"`
	Corrections []Journal  `json:"corrections"`
	Journal     *Journal   `json:"journal"`
}

type PartyOpening struct {
	Opening *struct {
		PartyType   string `json:"partyType"`
		PartyID     string `json:"partyId"`
		Side        string `json:"side"`
		AmountPaise int64  `json:"amountPaise"`
	} `json:"opening"`
	Entry *PartyEntry `json:"entry"`
}

type SessionClose struct {
	CountedCashPaise  int64 `json:"countedCashPaise"`
	ExpectedCashPaise int64 `json:"expectedCashPaise"`
	VariancePaise     int64 `json:"variancePaise"`
}

type Allocation struct {
	CreditType  string           `json:"creditType"`
	CreditID    string           `json:"creditId"`
	Allocations []AllocationLine `json:"allocations"`
}

// Cancel covers every cancel payload: the reversal journal, any cost corrections, and the party entry.
type Cancel struct {
	Status      string    `json:"status"`
	Journal     *Journal  `json:"journal"`
	Corrections []Journal `json:"corrections"`
}
