package device

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

type Handler struct {
	DB       *store.DB
	Verifier *Verifier
}

func toAPI(d *store.Device) api.Device {
	sv := d.SchemaVersion
	return api.Device{Id: d.ID, BusinessId: d.BusinessID, InstallationId: d.InstallationID, Name: d.Name, Platform: &d.Platform,
		AppVersion: &d.AppVersion, SchemaVersion: &sv, Status: api.DeviceStatus(d.Status), LastSeenAt: d.LastSeenAt, CreatedAt: d.CreatedAt}
}

// RegisterDevice is idempotent on installation_id; the caller must be logged in (bearer) — the device
// key is bound to the account that installed it. Requires an active entitlement slot when a business is given.
func (h *Handler) RegisterDevice(c echo.Context) error {
	cl := auth.ClaimsFrom(c)
	var req api.DeviceRegisterRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	pk, err := base64.StdEncoding.DecodeString(req.PublicKey)
	if err != nil || len(pk) != ed25519.PublicKeySize {
		return httpx.Validation(c, "public_key must be a base64 Ed25519 public key")
	}
	if req.InstallationId == "" || req.Platform == "" || req.AppVersion == "" {
		return httpx.Validation(c, "installation_id, platform and app_version are required")
	}
	ctx := c.Request().Context()
	var out api.Device
	status := http.StatusCreated
	var fail func() error
	err = h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject}, func(tx pgx.Tx) error {
		existing, err := store.GetDeviceByInstallation(ctx, tx, req.InstallationId)
		if err == nil {
			if existing.RegisteredBy != cl.Subject {
				fail = func() error {
					return httpx.Conflict(c, "ALREADY_EXISTS", "installation is registered to another account")
				}
				return nil
			}
			if existing.PublicKey != req.PublicKey {
				fail = func() error {
					return httpx.Conflict(c, "DEVICE_KEY_MISMATCH", "installation already registered with a different key; reinstall to get a new installation id")
				}
				return nil
			}
			if err := store.TouchDevice(ctx, tx, existing.ID, req.AppVersion, req.SchemaVersion, req.BusinessId, nil); err != nil {
				return err
			}
			d, err := store.GetDevice(ctx, tx, existing.ID)
			if err != nil {
				return err
			}
			out = toAPI(d)
			status = http.StatusOK
			return nil
		}
		if !errors.Is(err, store.ErrNotFound) {
			return err
		}
		orgs, err := store.ListOrganizations(ctx, tx, cl.Subject)
		if err != nil || len(orgs) == 0 {
			return errors.New("user has no organization")
		}
		if req.BusinessId != nil {
			if _, err := store.GetMembership(ctx, tx, cl.Subject, *req.BusinessId); err != nil {
				fail = func() error { return httpx.NotFound(c, "business") }
				return nil
			}
			if _, err := tx.Exec(ctx, "SELECT set_config('app.business_id', $1, true)", *req.BusinessId); err != nil {
				return err
			}
			limit, used, err := store.DeviceLimit(ctx, tx, *req.BusinessId)
			if err == nil && used >= limit {
				fail = func() error {
					return httpx.Fail(c, http.StatusPaymentRequired, "DEVICE_LIMIT_REACHED", api.BusinessRule, "device limit for this plan reached; revoke a device or upgrade")
				}
				return nil
			}
		}
		d := &store.Device{ID: ulid.Make().String(), OrganizationID: orgs[0].ID, BusinessID: req.BusinessId, RegisteredBy: cl.Subject, InstallationID: req.InstallationId,
			Name: req.Name, MachineFingerprint: req.MachineFingerprint, PublicKey: req.PublicKey, Platform: req.Platform, AppVersion: req.AppVersion, SchemaVersion: req.SchemaVersion, Status: "active"}
		if err := store.InsertDevice(ctx, tx, d); err != nil {
			return err
		}
		saved, err := store.GetDevice(ctx, tx, d.ID)
		if err != nil {
			return err
		}
		out = toAPI(saved)
		return store.Audit(ctx, tx, req.BusinessId, &cl.Subject, &d.ID, "device.register", "device", &d.ID, nil, out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if fail != nil {
		return fail()
	}
	return c.JSON(status, out)
}

func (h *Handler) ListDevices(c echo.Context, params api.ListDevicesParams) error {
	cl := auth.ClaimsFrom(c)
	ctx := c.Request().Context()
	var out []api.Device
	notMember := false
	err := h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject}, func(tx pgx.Tx) error {
		if _, err := store.GetMembership(ctx, tx, cl.Subject, params.BusinessId); err != nil {
			notMember = true
			return nil
		}
		if _, err := tx.Exec(ctx, "SELECT set_config('app.business_id', $1, true)", params.BusinessId); err != nil {
			return err
		}
		ds, err := store.ListDevices(ctx, tx, params.BusinessId)
		if err != nil {
			return err
		}
		out = make([]api.Device, 0, len(ds))
		for i := range ds {
			out = append(out, toAPI(&ds[i]))
		}
		return nil
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if notMember {
		return httpx.NotFound(c, "business")
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) RevokeDevice(c echo.Context, deviceID string) error {
	cl := auth.ClaimsFrom(c)
	ctx := c.Request().Context()
	var out api.Device
	found := false
	err := h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject, DeviceID: deviceID}, func(tx pgx.Tx) error {
		d, err := store.GetDevice(ctx, tx, deviceID)
		if errors.Is(err, store.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		allowed := d.RegisteredBy == cl.Subject
		if !allowed && d.BusinessID != nil {
			if _, err := store.GetMembership(ctx, tx, cl.Subject, *d.BusinessID); err == nil {
				allowed = true
			}
		}
		if !allowed {
			return nil
		}
		found = true
		if _, err := store.SetDeviceStatus(ctx, tx, d.ID, "revoked"); err != nil {
			return err
		}
		d.Status = "revoked"
		out = toAPI(d)
		return store.Audit(ctx, tx, d.BusinessID, &cl.Subject, &d.ID, "device.revoke", "device", &d.ID, nil, out, c.Response().Header().Get(echo.HeaderXRequestID))
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if !found {
		return httpx.NotFound(c, "device")
	}
	h.Verifier.Invalidate(deviceID)
	return c.JSON(http.StatusOK, out)
}
