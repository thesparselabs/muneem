// Package business implements business / branch / terminal setup. All POSTs are idempotent on the
// client-minted ULID id (devices create these offline and replay them).
package business

import (
	"context"
	"errors"
	"net/http"
	"regexp"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

var ulidRe = regexp.MustCompile(`^[0-7][0-9A-HJKMNP-TV-Z]{25}$`)
var stateRe = regexp.MustCompile(`^[0-9]{2}$`)

type Handler struct{ DB *store.DB }

func toAPI(b *store.Business) api.Business {
	fy := b.FyStartMonth
	return api.Business{Id: b.ID, OrganizationId: b.OrganizationID, Name: b.Name, LegalName: b.LegalName, BusinessType: api.BusinessBusinessType(b.BusinessType),
		AddressLine1: b.AddressLine1, AddressLine2: b.AddressLine2, City: b.City, StateCode: b.StateCode, PinCode: b.PinCode, Phone: b.Phone, Email: b.Email,
		Gstin: b.Gstin, Pan: b.Pan, TaxScheme: api.BusinessTaxScheme(b.TaxScheme), FyStartMonth: &fy, Version: b.Version, CreatedAt: b.CreatedAt, UpdatedAt: b.UpdatedAt}
}
func branchToAPI(b *store.Branch) api.Branch {
	d := b.IsDefault
	return api.Branch{Id: b.ID, BusinessId: b.BusinessID, Code: b.Code, Name: b.Name, AddressLine1: b.AddressLine1, City: b.City, StateCode: b.StateCode, Gstin: b.Gstin, IsDefault: &d, Version: b.Version, CreatedAt: b.CreatedAt}
}
func terminalToAPI(t *store.Terminal) api.Terminal {
	return api.Terminal{Id: t.ID, BusinessId: t.BusinessID, BranchId: t.BranchID, Code: t.Code, Name: t.Name, DeviceId: t.DeviceID, Version: t.Version, CreatedAt: t.CreatedAt}
}

// tenant runs fn inside a tenant transaction after verifying the caller is a member of businessID.
func (h *Handler) tenant(c echo.Context, businessID string, fn func(ctx context.Context, tx pgx.Tx) error) (member bool, err error) {
	cl := auth.ClaimsFrom(c)
	ctx := c.Request().Context()
	err = h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject, DeviceID: cl.Device}, func(tx pgx.Tx) error {
		if _, err := store.GetMembership(ctx, tx, cl.Subject, businessID); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return nil
			}
			return err
		}
		member = true
		if _, err := tx.Exec(ctx, "SELECT set_config('app.business_id', $1, true)", businessID); err != nil {
			return err
		}
		return fn(ctx, tx)
	})
	return
}

func (h *Handler) ListBusinesses(c echo.Context) error {
	cl := auth.ClaimsFrom(c)
	ctx := c.Request().Context()
	out := []api.Business{}
	err := h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject}, func(tx pgx.Tx) error {
		bs, err := store.ListBusinessesForUser(ctx, tx, cl.Subject)
		for i := range bs {
			out = append(out, toAPI(&bs[i]))
		}
		return err
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) CreateBusiness(c echo.Context) error {
	cl := auth.ClaimsFrom(c)
	var req api.BusinessCreate
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	if !ulidRe.MatchString(req.Id) || req.Name == "" || !stateRe.MatchString(req.StateCode) || req.BusinessType == "" || req.TaxScheme == "" {
		return httpx.Validation(c, "id (ULID), name, business_type, state_code and tax_scheme are required")
	}
	ctx := c.Request().Context()
	status := http.StatusCreated
	var out api.Business
	var fail func() error
	err := h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject}, func(tx pgx.Tx) error {
		orgs, err := store.ListOrganizations(ctx, tx, cl.Subject)
		if err != nil || len(orgs) == 0 {
			return errors.New("user has no organization")
		}
		org := orgs[0].ID
		if cl.Org != "" {
			org = cl.Org
		}
		if existing, err := store.GetBusiness(ctx, tx, req.Id); err == nil {
			if existing.OrganizationID != org {
				fail = func() error { return httpx.Conflict(c, "ALREADY_EXISTS", "id belongs to another organization") }
				return nil
			}
			out = toAPI(existing)
			status = http.StatusOK
			return nil
		} else if !errors.Is(err, store.ErrNotFound) {
			return err
		}
		fy := 4
		if req.FyStartMonth != nil {
			fy = *req.FyStartMonth
		}
		b := &store.Business{ID: req.Id, OrganizationID: org, Name: req.Name, LegalName: req.LegalName, BusinessType: string(req.BusinessType), AddressLine1: req.AddressLine1,
			AddressLine2: req.AddressLine2, City: req.City, StateCode: req.StateCode, PinCode: req.PinCode, Phone: req.Phone, Email: req.Email, Gstin: req.Gstin, Pan: req.Pan,
			TaxScheme: string(req.TaxScheme), FyStartMonth: fy, CreatedBy: cl.Subject}
		if err := store.InsertBusiness(ctx, tx, b); err != nil {
			if store.IsUniqueViolation(err) {
				fail = func() error { return httpx.Conflict(c, "ALREADY_EXISTS", "business id already exists") }
				return nil
			}
			return err
		}
		if _, err := tx.Exec(ctx, "SELECT set_config('app.business_id', $1, true)", b.ID); err != nil {
			return err
		}
		if err := store.UpsertMembership(ctx, tx, cl.Subject, b.ID, []string{"owner"}, auth.GrantsFor([]string{"owner"})); err != nil {
			return err
		}
		if err := store.InsertEntitlement(ctx, tx, b.ID); err != nil {
			return err
		}
		saved, err := store.GetBusiness(ctx, tx, b.ID)
		if err != nil {
			return err
		}
		out = toAPI(saved)
		return store.Audit(ctx, tx, &b.ID, &cl.Subject, deviceOf(cl), "business.create", "business", &b.ID, nil, out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if fail != nil {
		return fail()
	}
	return c.JSON(status, out)
}

func (h *Handler) GetBusiness(c echo.Context, businessID string) error {
	var out api.Business
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		b, err := store.GetBusiness(ctx, tx, businessID)
		if err != nil {
			return err
		}
		out = toAPI(b)
		return nil
	})
	if errors.Is(err, store.ErrNotFound) || !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) UpdateBusiness(c echo.Context, businessID string) error {
	var req api.BusinessUpdate
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	if req.Id != "" && req.Id != businessID {
		return httpx.Validation(c, "id mismatch")
	}
	var out api.Business
	conflict := false
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		cl := auth.ClaimsFrom(c)
		before, err := store.GetBusiness(ctx, tx, businessID)
		if err != nil {
			return err
		}
		b := *before
		if req.Name != "" {
			b.Name = req.Name
		}
		if req.BusinessType != "" {
			b.BusinessType = string(req.BusinessType)
		}
		if req.TaxScheme != "" {
			b.TaxScheme = string(req.TaxScheme)
		}
		if stateRe.MatchString(req.StateCode) {
			b.StateCode = req.StateCode
		}
		for dst, src := range map[**string]*string{&b.LegalName: req.LegalName, &b.AddressLine1: req.AddressLine1, &b.AddressLine2: req.AddressLine2, &b.City: req.City,
			&b.PinCode: req.PinCode, &b.Phone: req.Phone, &b.Email: req.Email, &b.Gstin: req.Gstin, &b.Pan: req.Pan} {
			if src != nil {
				*dst = src
			}
		}
		ok, err := store.UpdateBusiness(ctx, tx, &b, req.Version)
		if err != nil {
			return err
		}
		if !ok {
			conflict = true
			return nil
		}
		after, err := store.GetBusiness(ctx, tx, businessID)
		if err != nil {
			return err
		}
		out = toAPI(after)
		return store.Audit(ctx, tx, &businessID, &cl.Subject, deviceOf(cl), "business.update", "business", &businessID, toAPI(before), out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if errors.Is(err, store.ErrNotFound) || !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	if conflict {
		return httpx.Conflict(c, "VERSION_CONFLICT", "business was modified; reload and retry")
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) ListBranches(c echo.Context, businessID string) error {
	out := []api.Branch{}
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		bs, err := store.ListBranches(ctx, tx, businessID)
		for i := range bs {
			out = append(out, branchToAPI(&bs[i]))
		}
		return err
	})
	if !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) CreateBranch(c echo.Context, businessID string) error {
	var req api.BranchCreate
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	if !ulidRe.MatchString(req.Id) || req.Code == "" || req.Name == "" || !stateRe.MatchString(req.StateCode) {
		return httpx.Validation(c, "id (ULID), code, name and state_code are required")
	}
	status := http.StatusCreated
	var out api.Branch
	var fail func() error
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		cl := auth.ClaimsFrom(c)
		if existing, err := store.GetBranch(ctx, tx, req.Id); err == nil {
			out = branchToAPI(existing)
			status = http.StatusOK
			return nil
		} else if !errors.Is(err, store.ErrNotFound) {
			return err
		}
		existingBranches, err := store.ListBranches(ctx, tx, businessID)
		if err != nil {
			return err
		}
		b := &store.Branch{ID: req.Id, BusinessID: businessID, Code: req.Code, Name: req.Name, AddressLine1: req.AddressLine1, City: req.City, StateCode: req.StateCode, Gstin: req.Gstin,
			IsDefault: (req.IsDefault != nil && *req.IsDefault) || len(existingBranches) == 0}
		if err := store.InsertBranch(ctx, tx, b); err != nil {
			if store.IsUniqueViolation(err) {
				fail = func() error { return httpx.Conflict(c, "ALREADY_EXISTS", "branch id or code already exists") }
				return nil
			}
			return err
		}
		saved, err := store.GetBranch(ctx, tx, b.ID)
		if err != nil {
			return err
		}
		out = branchToAPI(saved)
		return store.Audit(ctx, tx, &businessID, &cl.Subject, deviceOf(cl), "branch.create", "branch", &b.ID, nil, out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	if fail != nil {
		return fail()
	}
	return c.JSON(status, out)
}

func (h *Handler) ListTerminals(c echo.Context, businessID string) error {
	out := []api.Terminal{}
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		ts, err := store.ListTerminals(ctx, tx, businessID)
		for i := range ts {
			out = append(out, terminalToAPI(&ts[i]))
		}
		return err
	})
	if !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) CreateTerminal(c echo.Context, businessID string) error {
	var req api.TerminalCreate
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	if !ulidRe.MatchString(req.Id) || !ulidRe.MatchString(req.BranchId) || req.Code == "" || req.Name == "" {
		return httpx.Validation(c, "id (ULID), branch_id (ULID), code and name are required")
	}
	status := http.StatusCreated
	var out api.Terminal
	var fail func() error
	member, err := h.tenant(c, businessID, func(ctx context.Context, tx pgx.Tx) error {
		cl := auth.ClaimsFrom(c)
		if existing, err := store.GetTerminal(ctx, tx, req.Id); err == nil {
			out = terminalToAPI(existing)
			status = http.StatusOK
			return nil
		} else if !errors.Is(err, store.ErrNotFound) {
			return err
		}
		if br, err := store.GetBranch(ctx, tx, req.BranchId); err != nil || br.BusinessID != businessID {
			fail = func() error { return httpx.NotFound(c, "branch") }
			return nil
		}
		t := &store.Terminal{ID: req.Id, BusinessID: businessID, BranchID: req.BranchId, Code: req.Code, Name: req.Name, DeviceID: req.DeviceId}
		if err := store.InsertTerminal(ctx, tx, t); err != nil {
			if store.IsUniqueViolation(err) {
				fail = func() error { return httpx.Conflict(c, "ALREADY_EXISTS", "terminal id or code already exists") }
				return nil
			}
			return err
		}
		saved, err := store.GetTerminal(ctx, tx, t.ID)
		if err != nil {
			return err
		}
		out = terminalToAPI(saved)
		return store.Audit(ctx, tx, &businessID, &cl.Subject, deviceOf(cl), "terminal.create", "terminal", &t.ID, nil, out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if !member {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	if fail != nil {
		return fail()
	}
	return c.JSON(status, out)
}

func deviceOf(cl *auth.Claims) *string {
	if cl.Device == "" {
		return nil
	}
	return &cl.Device
}
