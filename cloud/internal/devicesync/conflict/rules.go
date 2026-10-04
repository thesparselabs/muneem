package conflict

// Config entities and these masters keep the cloud's value on a conflicting field (ADR-0041).
var cloudKeepsEntity = map[string]bool{
	"business": true, "branch": true, "terminal": true, "doc_series": true, "setting": true, "user_pin": true, "account": true,
	"expense_category": true, "price_list_item": true, "customer_credit_limit": true,
}

// Price and tax fields, in both the camelCase and snake_case spellings the payloads use.
var cloudKeepsField = map[string]bool{
	"sellingPricePaise": true, "selling_price_paise": true, "mrpPaise": true, "mrp_paise": true,
	"gstRateBp": true, "gst_rate_bp": true, "cessRateBp": true, "cess_rate_bp": true, "cessPerUnitPaise": true, "cess_per_unit_paise": true,
	"taxTreatment": true, "tax_treatment": true, "creditLimitPaise": true, "credit_limit_paise": true,
}

func Protected(entityType, field string) bool {
	return cloudKeepsEntity[entityType] || cloudKeepsField[field]
}
