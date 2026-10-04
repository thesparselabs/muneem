package devicesync

import "github.com/sparselabs/muneem/cloud/internal/devicesync/auditchain"

// Mirrors STREAM_OF and SYNC_ERROR_CODES in packages/contracts/src/sync/protocol.ts.
const (
	StreamControl   = "control"
	StreamConfig    = "config"
	StreamMasters   = "masters"
	StreamDocuments = "documents"
	StreamAudit     = "audit" // pushed, never pulled (ADR-0048)
)

var streamOf = map[string]string{
	"accounting_period": StreamControl,
	"business":          StreamConfig, "branch": StreamConfig, "terminal": StreamConfig, "doc_series": StreamConfig, "setting": StreamConfig,
	"user_pin": StreamConfig, "account": StreamConfig, "expense_category": StreamConfig,
	"uom": StreamMasters, "category": StreamMasters, "brand": StreamMasters, "product": StreamMasters, "barcode": StreamMasters,
	"uom_conversion": StreamMasters, "price_list": StreamMasters, "price_list_item": StreamMasters, "customer": StreamMasters,
	"customer_credit_limit": StreamMasters, "supplier": StreamMasters, "warehouse": StreamMasters,
	"pos_session": StreamDocuments, "cash_movement": StreamDocuments, "sale": StreamDocuments, "stock_adjustment": StreamDocuments,
	"party_opening": StreamDocuments, "purchase": StreamDocuments, "debit_note": StreamDocuments, "credit_note": StreamDocuments, "payment": StreamDocuments,
	"write_off": StreamDocuments, "expense": StreamDocuments, "allocation": StreamDocuments, "journal_entry": StreamDocuments,
	"gst_setoff": StreamDocuments, "gst_payment": StreamDocuments,
	auditchain.EntityType: StreamAudit,
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
	CodeAuditChainBroken   = "AUDIT_CHAIN_BROKEN"
)

var classOf = map[string]string{
	CodeTotalMismatch: "permanent", CodeJournalImbalance: "permanent", CodeJournalMismatch: "permanent", CodePayloadInvalid: "permanent",
	CodeAuditChainBroken: "permanent", CodeDependencyMissing: "dependency", CodeBusinessUnknown: "transient", CodeVersionUnsupported: "transient", CodeUnknownEntity: "transient",
}

const (
	Protocol          = 1
	PushMaxOperations = 200
	PushMaxBytes      = 2 * 1024 * 1024
	PullMaxLimit      = 500
)

// Control-stream entity types the cloud emits itself; devices list them as review items or act on them (7e).
const (
	ControlDevice     = "device"
	ControlReviewItem = "review_item"
)

// StreamOrder is STREAM_ORDER: control first so a revocation or lock is never stuck behind thousands of products.
var StreamOrder = []string{StreamControl, StreamConfig, StreamMasters, StreamDocuments}

// LatestStateTypes lists each non-document stream's entity types, referenced types before the types that reference
// them (STREAM_OF's declaration order), so a bundle of latest states imports without a missing parent.
var LatestStateTypes = map[string][]string{
	StreamControl: {"accounting_period", ControlDevice, ControlReviewItem},
	StreamConfig:  {"business", "branch", "terminal", "doc_series", "setting", "user_pin", "account", "expense_category"},
	StreamMasters: {"uom", "category", "brand", "product", "barcode", "uom_conversion", "price_list", "price_list_item", "customer",
		"customer_credit_limit", "supplier", "warehouse"},
}
