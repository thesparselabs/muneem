package devicesync

// Mirrors STREAM_OF and SYNC_ERROR_CODES in packages/contracts/src/sync/protocol.ts.
const (
	StreamControl   = "control"
	StreamConfig    = "config"
	StreamMasters   = "masters"
	StreamDocuments = "documents"
)

var streamOf = map[string]string{
	"accounting_period": StreamControl,
	"business":          StreamConfig, "branch": StreamConfig, "terminal": StreamConfig, "doc_series": StreamConfig, "setting": StreamConfig,
	"user_pin": StreamConfig, "account": StreamConfig, "expense_category": StreamConfig,
	"uom": StreamMasters, "category": StreamMasters, "brand": StreamMasters, "product": StreamMasters, "barcode": StreamMasters,
	"uom_conversion": StreamMasters, "price_list": StreamMasters, "price_list_item": StreamMasters, "customer": StreamMasters,
	"customer_credit_limit": StreamMasters, "supplier": StreamMasters, "warehouse": StreamMasters,
	"pos_session": StreamDocuments, "cash_movement": StreamDocuments, "sale": StreamDocuments, "stock_adjustment": StreamDocuments,
	"party_opening": StreamDocuments, "purchase": StreamDocuments, "debit_note": StreamDocuments, "payment": StreamDocuments,
	"write_off": StreamDocuments, "expense": StreamDocuments, "allocation": StreamDocuments, "journal_entry": StreamDocuments,
}

var validStreams = map[string]bool{StreamControl: true, StreamConfig: true, StreamMasters: true, StreamDocuments: true}

const (
	CodeTotalMismatch      = "TOTAL_MISMATCH"
	CodeJournalImbalance   = "JOURNAL_IMBALANCE"
	CodeJournalMismatch    = "JOURNAL_MISMATCH"
	CodePayloadInvalid     = "PAYLOAD_INVALID"
	CodeDependencyMissing  = "DEPENDENCY_MISSING"
	CodeBusinessUnknown    = "BUSINESS_UNKNOWN"
	CodeVersionUnsupported = "VERSION_UNSUPPORTED"
	CodeUnknownEntity      = "UNKNOWN_ENTITY"
)

var classOf = map[string]string{
	CodeTotalMismatch: "permanent", CodeJournalImbalance: "permanent", CodeJournalMismatch: "permanent", CodePayloadInvalid: "permanent",
	CodeDependencyMissing: "dependency", CodeBusinessUnknown: "transient", CodeVersionUnsupported: "transient", CodeUnknownEntity: "transient",
}

const (
	Protocol          = 1
	PushMaxOperations = 200
	PushMaxBytes      = 2 * 1024 * 1024
	PullMaxLimit      = 500
)
