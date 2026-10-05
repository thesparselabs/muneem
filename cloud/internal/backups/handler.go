package backups

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

const maxBody = 4096

var (
	hexSHA256 = regexp.MustCompile(`^[0-9a-f]{64}$`)
	keyIDRe   = regexp.MustCompile(`^[0-9a-f]{16,64}$`)
)

// Handler is the /backups surface; every route needs a member's registered, signed device.
type Handler struct{ Service *Service }

// caller is the signed device asking, or the reply refusing it.
func (h *Handler) caller(c echo.Context) (Caller, bool, error) {
	caller := Caller{}
	if cl := auth.ClaimsFrom(c); cl != nil {
		caller.UserID = cl.Subject
	}
	caller.DeviceID, _ = c.Get("muneem.device_id").(string)
	if caller.DeviceID == "" {
		return caller, false, httpx.Unauthorized(c, "DEVICE_REQUIRED", "backups must come from a registered, signed device")
	}
	if h.Service == nil {
		return caller, false, unavailable(c)
	}
	return caller, true, nil
}

func unavailable(c echo.Context) error {
	return httpx.Fail(c, http.StatusServiceUnavailable, "BACKUP_UNAVAILABLE", api.Transient, "cloud backups are not configured")
}

func decode(c echo.Context, into any) error {
	raw, err := io.ReadAll(io.LimitReader(c.Request().Body, maxBody+1))
	if err != nil || len(raw) > maxBody {
		return errors.New("body too large")
	}
	return json.Unmarshal(raw, into)
}

func (h *Handler) PresignBackup(c echo.Context) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	var body api.BackupPresignRequest
	if err := decode(c, &body); err != nil || body.BusinessId == "" || body.Bytes < 1 || !hexSHA256.MatchString(body.Sha256) ||
		!keyIDRe.MatchString(body.KeyId) || body.SchemaVersion < 1 {
		return httpx.Validation(c, "businessId, bytes ≥ 1, a lowercase hex sha256, a hex keyId and schemaVersion ≥ 1 are required")
	}
	up, err := h.Service.Presign(c.Request().Context(), caller, PresignInput{BusinessID: body.BusinessId, Bytes: body.Bytes, SHA256: body.Sha256,
		KeyID: body.KeyId, SchemaVersion: body.SchemaVersion})
	if err != nil {
		return reply(c, err)
	}
	return c.JSON(http.StatusOK, api.BackupUpload{BackupId: up.BackupID, Url: up.URL, ExpiresAt: up.ExpiresAt})
}

func (h *Handler) ConfirmBackup(c echo.Context, backupID string) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	b, err := h.Service.Confirm(c.Request().Context(), caller, backupID)
	if err != nil {
		return reply(c, err)
	}
	return c.JSON(http.StatusOK, wire(*b))
}

func (h *Handler) ListBackups(c echo.Context, p api.ListBackupsParams) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	rows, err := h.Service.List(c.Request().Context(), caller, p.BusinessId)
	if err != nil {
		return reply(c, err)
	}
	out := make([]api.Backup, 0, len(rows))
	for _, r := range rows {
		out = append(out, wire(r))
	}
	return c.JSON(http.StatusOK, out)
}

func (h *Handler) GetBackup(c echo.Context, backupID string) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	d, err := h.Service.Get(c.Request().Context(), caller, backupID)
	if err != nil {
		return reply(c, err)
	}
	b := wire(d.row)
	return c.JSON(http.StatusOK, api.BackupDownload{BackupId: b.BackupId, BusinessId: b.BusinessId, DeviceId: b.DeviceId, Bytes: b.Bytes, Sha256: b.Sha256,
		KeyId: b.KeyId, SchemaVersion: b.SchemaVersion, CreatedAt: b.CreatedAt, ConfirmedAt: b.ConfirmedAt, Url: d.URL, ExpiresAt: d.ExpiresAt})
}

func (h *Handler) EscrowBackupKey(c echo.Context) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	var body api.BackupKey
	if err := decode(c, &body); err != nil || body.BusinessId == "" || !keyIDRe.MatchString(body.KeyId) {
		return httpx.Validation(c, "businessId, a hex keyId and key are required")
	}
	key, err := base64.StdEncoding.DecodeString(body.Key)
	if err != nil || len(key) != DataKeyBytes {
		return httpx.Validation(c, "key must be base64 of 32 bytes")
	}
	if err := h.Service.Escrow(c.Request().Context(), caller, body.BusinessId, body.KeyId, key); err != nil {
		return reply(c, err)
	}
	return c.JSON(http.StatusOK, api.BackupKeyRef{BusinessId: body.BusinessId, KeyId: body.KeyId})
}

func (h *Handler) GetBackupKey(c echo.Context, p api.GetBackupKeyParams) error {
	caller, ok, err := h.caller(c)
	if !ok {
		return err
	}
	if p.KeyId != nil && !keyIDRe.MatchString(*p.KeyId) {
		return httpx.Validation(c, "keyId must be hex")
	}
	keyID, key, err := h.Service.Key(c.Request().Context(), caller, p.BusinessId, p.KeyId)
	if err != nil {
		return reply(c, err)
	}
	return c.JSON(http.StatusOK, api.BackupKey{BusinessId: p.BusinessId, KeyId: keyID, Key: base64.StdEncoding.EncodeToString(key)})
}

func wire(r row) api.Backup {
	return api.Backup{BackupId: r.ID, BusinessId: r.BusinessID, DeviceId: r.DeviceID, Bytes: r.Bytes, Sha256: r.SHA256, KeyId: r.KeyID,
		SchemaVersion: r.SchemaVersion, CreatedAt: r.CreatedAt, ConfirmedAt: r.ConfirmedAt}
}

func reply(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrNotMember):
		return httpx.NotFound(c, "business")
	case errors.Is(err, ErrNotFound):
		return httpx.NotFound(c, "backup")
	case errors.Is(err, ErrKeyNotFound):
		return httpx.Fail(c, http.StatusNotFound, "BACKUP_KEY_NOT_FOUND", api.BusinessRule, "no backup key is escrowed for that business")
	case errors.Is(err, ErrKeyConflict):
		return httpx.Conflict(c, "BACKUP_KEY_CONFLICT", "a different key is already escrowed under that key id")
	case errors.Is(err, ErrNotUploaded):
		return httpx.Conflict(c, "BACKUP_NOT_UPLOADED", "the backup object has not been uploaded")
	case errors.Is(err, ErrChecksum):
		return httpx.Fail(c, http.StatusUnprocessableEntity, "BACKUP_CHECKSUM_MISMATCH", api.Validation, "the uploaded object does not match its size and checksum")
	case errors.Is(err, ErrTooLarge):
		return httpx.Validation(c, "the backup is larger than the cloud accepts")
	case errors.Is(err, ErrUnconfigured):
		return unavailable(c)
	}
	return httpx.Internal(c, err)
}
