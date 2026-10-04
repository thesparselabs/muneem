package devicesync

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

type businessPayload struct {
	ID             string  `json:"id"`
	OrganizationID string  `json:"organizationId"`
	Name           string  `json:"name"`
	BusinessType   string  `json:"businessType"`
	StateCode      string  `json:"stateCode"`
	TaxScheme      string  `json:"taxScheme"`
	FyStartMonth   int     `json:"fyStartMonth"`
	LegalName      *string `json:"legalName"`
	AddressLine1   *string `json:"addressLine1"`
	AddressLine2   *string `json:"addressLine2"`
	City           *string `json:"city"`
	PinCode        *string `json:"pinCode"`
	Phone          *string `json:"phone"`
	Email          *string `json:"email"`
	Gstin          *string `json:"gstin"`
	Pan            *string `json:"pan"`
}

var businessTypes = map[string]bool{"retail": true, "wholesale": true, "distribution": true, "service": true, "restaurant": true, "trading": true, "other": true}
var taxSchemes = map[string]bool{"regular": true, "composition": true, "unregistered": true}

func businessExists(ctx context.Context, tx pgx.Tx, id string) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM business WHERE id = $1)`, id).Scan(&ok)
	return ok, err
}

// createOfflineBusiness turns a pushed business create into the cloud business, with the pusher as owner (ADR-0039).
func createOfflineBusiness(ctx context.Context, tx pgx.Tx, userID string, op Operation) error {
	var b businessPayload
	if err := json.Unmarshal(op.Payload, &b); err != nil {
		return &verify.Failure{Code: CodePayloadInvalid, Detail: err.Error()}
	}
	if b.ID != op.EntityID || b.Name == "" || !businessTypes[b.BusinessType] || !taxSchemes[b.TaxScheme] || !stateCodeRe.MatchString(b.StateCode) {
		return &verify.Failure{Code: CodePayloadInvalid, Detail: "business needs its id, a name, a known type and tax scheme, and a state code"}
	}
	member, err := store.IsOrgMember(ctx, tx, b.OrganizationID, userID)
	if err != nil {
		return err
	}
	if !member {
		return &verify.Failure{Code: CodePayloadInvalid, Detail: "the pushing user does not belong to the business's organization"}
	}
	if b.FyStartMonth < 1 || b.FyStartMonth > 12 {
		b.FyStartMonth = 4
	}
	row := &store.Business{ID: b.ID, OrganizationID: b.OrganizationID, Name: b.Name, LegalName: b.LegalName, BusinessType: b.BusinessType,
		AddressLine1: b.AddressLine1, AddressLine2: b.AddressLine2, City: b.City, StateCode: b.StateCode, PinCode: b.PinCode, Phone: b.Phone,
		Email: b.Email, Gstin: b.Gstin, Pan: b.Pan, TaxScheme: b.TaxScheme, FyStartMonth: b.FyStartMonth, CreatedBy: userID}
	if err := store.InsertBusiness(ctx, tx, row); err != nil {
		return err
	}
	if err := store.UpsertMembership(ctx, tx, userID, b.ID, []string{"owner"}, auth.GrantsFor([]string{"owner"})); err != nil {
		return err
	}
	return store.InsertEntitlement(ctx, tx, b.ID)
}

func asFailure(err error) (*verify.Failure, bool) {
	var f *verify.Failure
	ok := errors.As(err, &f)
	return f, ok
}
