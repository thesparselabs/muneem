package devicesync

import "encoding/json"

// ref is a stored entity an operation needs before the cloud can accept it.
type ref struct{ entityType, entityID string }

// Allocation targets and credits name documents by their party-ledger kind.
var documentOfKind = map[string]string{
	"sale": "sale", "purchase": "purchase", "opening": "party_opening", "expense": "expense", "payment": "payment",
	"debit_note": "debit_note", "credit_note": "credit_note", "write_off": "write_off",
}

type refPayload struct {
	CustomerID  *string `json:"customerId"`
	SupplierID  *string `json:"supplierId"`
	SessionID   *string `json:"sessionId"`
	PurchaseID  *string `json:"purchaseId"`
	SaleID      *string `json:"saleId"`
	CategoryID  *string `json:"categoryId"`
	PartyType   string  `json:"partyType"`
	PartyID     string  `json:"partyId"`
	CreditType  string  `json:"creditType"`
	CreditID    string  `json:"creditId"`
	Allocations []struct {
		TargetType string `json:"targetType"`
		TargetID   string `json:"targetId"`
	} `json:"allocations"`
	Opening *struct {
		PartyType string `json:"partyType"`
		PartyID   string `json:"partyId"`
	} `json:"opening"`
}

func (p *refPayload) party(partyType, id string) []ref {
	if id == "" || (partyType != "customer" && partyType != "supplier") {
		return nil
	}
	return []ref{{partyType, id}}
}

func optional(entityType string, id *string) []ref {
	if id == nil || *id == "" {
		return nil
	}
	return []ref{{entityType, *id}}
}

func (p *refPayload) documents(kind, id string) []ref {
	if t, ok := documentOfKind[kind]; ok && id != "" {
		return []ref{{t, id}}
	}
	return nil
}

func (p *refPayload) targets() []ref {
	var out []ref
	for _, a := range p.Allocations {
		out = append(out, p.documents(a.TargetType, a.TargetID)...)
	}
	return out
}

var createRefs = map[string]func(p *refPayload) []ref{
	"sale": func(p *refPayload) []ref {
		return append(optional("customer", p.CustomerID), optional("pos_session", p.SessionID)...)
	},
	"purchase": func(p *refPayload) []ref { return optional("supplier", p.SupplierID) },
	"debit_note": func(p *refPayload) []ref {
		return append(optional("purchase", p.PurchaseID), optional("supplier", p.SupplierID)...)
	},
	"credit_note": func(p *refPayload) []ref {
		return append(append(optional("sale", p.SaleID), optional("customer", p.CustomerID)...), optional("pos_session", p.SessionID)...)
	},
	"payment":       func(p *refPayload) []ref { return append(p.party(p.PartyType, p.PartyID), p.targets()...) },
	"write_off":     func(p *refPayload) []ref { return append(optional("customer", p.CustomerID), p.targets()...) },
	"allocation":    func(p *refPayload) []ref { return append(p.documents(p.CreditType, p.CreditID), p.targets()...) },
	"cash_movement": func(p *refPayload) []ref { return optional("pos_session", p.SessionID) },
	"expense": func(p *refPayload) []ref {
		return append(optional("expense_category", p.CategoryID), optional("supplier", p.SupplierID)...)
	},
	"party_opening": func(p *refPayload) []ref {
		if p.Opening == nil {
			return nil
		}
		return p.party(p.Opening.PartyType, p.Opening.PartyID)
	},
}

// references lists what must already be stored. Cancels and updates of documents need the document itself; a
// credit limit needs its customer.
func references(op Operation) ([]ref, error) {
	if (streamOf[op.EntityType] == StreamDocuments || op.EntityType == "fy_close") && op.OperationType != "create" {
		return []ref{{op.EntityType, op.EntityID}}, nil
	}
	if op.EntityType == "customer_credit_limit" {
		return []ref{{"customer", op.EntityID}}, nil
	}
	find, ok := createRefs[op.EntityType]
	if !ok {
		return nil, nil
	}
	var p refPayload
	if err := json.Unmarshal(op.Payload, &p); err != nil {
		return nil, err
	}
	return find(&p), nil
}
