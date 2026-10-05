package admin

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
	"github.com/sparselabs/muneem/cloud/internal/device"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Reapplier re-runs one operation through sync ingest (devicesync.Ingest).
type Reapplier interface {
	Reapply(ctx context.Context, c devicesync.Caller, businessID string, op devicesync.Operation) (devicesync.Result, error)
}

// KeyCache forgets a device's cached signing key once it is revoked (device.Verifier).
type KeyCache interface{ Invalidate(deviceID string) }

// Actions are the operator's writes. Revoke and resend reuse the shop's own paths, as the RLS app role inside that
// one shop's scope; a dismissal is the admin role's only write. Each is audited in its own transaction.
type Actions struct {
	Dir         *Directory
	App         *store.DB
	Ingest      Reapplier
	Revocations device.RevocationRecorder
	Keys        KeyCache
}

func (a *Actions) RevokeDevice(ctx context.Context, who Actor, deviceID string) (adminapi.AdminDevice, error) {
	before, err := a.Dir.Device(ctx, deviceID)
	if err != nil {
		return before, err
	}
	if before.BusinessId == nil {
		return before, store.ErrNotFound
	}
	businessID := *before.BusinessId
	err = a.App.WithTx(ctx, store.Scope{UserID: who.OperatorID, BusinessID: businessID, DeviceID: deviceID}, func(tx pgx.Tx) error {
		d, err := store.GetDevice(ctx, tx, deviceID)
		if err != nil {
			return err
		}
		if d.Status != "revoked" {
			if err := device.Revoke(ctx, tx, a.Revocations, d); err != nil {
				return err
			}
		}
		return who.audit(ctx, tx, &businessID, &deviceID, "admin.device.revoke", "device", deviceID,
			map[string]string{"status": string(before.Status)}, map[string]string{"status": d.Status})
	})
	if err != nil {
		return before, err
	}
	if a.Keys != nil {
		a.Keys.Invalidate(deviceID)
	}
	return a.Dir.Device(ctx, deviceID)
}

// Resend re-runs a dead-lettered operation as the device that pushed it. Ingest is idempotent, so resending twice, or
// after the device itself re-pushed, applies once; the letter is resolved only when the operation has applied.
func (a *Actions) Resend(ctx context.Context, who Actor, id int64) (adminapi.ResendResult, error) {
	stored, err := a.Dir.DeadLetter(ctx, id)
	if err != nil {
		return adminapi.ResendResult{}, err
	}
	letter := stored.Letter
	if letter.Resolution != nil && *letter.Resolution == adminapi.Dismissed {
		return adminapi.ResendResult{}, errResolved
	}
	var op devicesync.Operation
	if err := json.Unmarshal(stored.Operation, &op); err != nil {
		return adminapi.ResendResult{}, err
	}
	res, err := a.Ingest.Reapply(ctx, devicesync.Caller{UserID: stored.Owner, DeviceID: letter.DeviceId}, letter.BusinessId, op)
	if err != nil {
		return adminapi.ResendResult{}, err
	}
	out := resendResult(res)
	letter.Operation = nil
	if res.Status == devicesync.StatusApplied || res.Status == devicesync.StatusDuplicate {
		out.DeadLetter, err = a.Dir.resolve(ctx, id, adminapi.Resent, who, out)
		return out, err
	}
	err = a.Dir.withTx(ctx, func(tx pgx.Tx) error {
		return who.audit(ctx, tx, &letter.BusinessId, &letter.DeviceId, "admin.dead_letter.resend_failed", "dead_letter", strconv.FormatInt(id, 10), nil, out)
	})
	out.DeadLetter = letter
	return out, err
}

func (a *Actions) Dismiss(ctx context.Context, who Actor, id int64) (adminapi.DeadLetter, error) {
	return a.Dir.resolve(ctx, id, adminapi.Dismissed, who, nil)
}

func resendResult(r devicesync.Result) adminapi.ResendResult {
	out := adminapi.ResendResult{Status: adminapi.ResendResultStatus(r.Status), ServerSeq: r.ServerSeq}
	if r.Error != nil {
		out.Code, out.Detail = &r.Error.Code, &r.Error.Detail
	}
	return out
}
