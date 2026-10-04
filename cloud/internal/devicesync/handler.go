// Package devicesync is the device sync surface: push, pull and hydration (LLD §7, Stage 7).
package devicesync

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

type Handler struct {
	Ingest    *Ingest
	Feed      *Feed
	Snapshots Snapshots
}

func callerOf(c echo.Context) Caller {
	caller := Caller{}
	if cl := auth.ClaimsFrom(c); cl != nil {
		caller.UserID = cl.Subject
	}
	if id, ok := c.Get("muneem.device_id").(string); ok {
		caller.DeviceID = id
	}
	if skew, ok := c.Get("muneem.device_skew_ms").(int); ok {
		caller.SkewMs = &skew
	}
	return caller
}

func (h *Handler) SyncPush(c echo.Context) error {
	caller := callerOf(c)
	if caller.DeviceID == "" {
		return httpx.Unauthorized(c, "DEVICE_REQUIRED", "sync push must come from a registered, signed device")
	}
	req, err := decodePush(c.Request())
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	if req.Protocol != Protocol {
		return httpx.Fail(c, http.StatusUpgradeRequired, CodeVersionUnsupported, api.Transient, "this server speaks sync protocol 1")
	}
	if err := validatePush(req); err != nil {
		return httpx.Validation(c, err.Error())
	}
	ctx := c.Request().Context()
	allowed, err := Authorize(ctx, h.Ingest.DB, caller, req.BusinessID)
	if err != nil {
		return httpx.Internal(c, err)
	}
	if !allowed {
		return httpx.NotFound(c, "business")
	}
	res, err := h.Ingest.Push(ctx, caller, req)
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) SyncPull(c echo.Context, p api.SyncPullParams) error {
	limit := PullMaxLimit
	if p.Limit != nil {
		limit = *p.Limit
	}
	if !validStreams[string(p.Stream)] || p.Since < 0 || limit < 1 || limit > PullMaxLimit {
		return httpx.Validation(c, "stream must be control, config, masters or documents; since ≥ 0; 1 ≤ limit ≤ 500")
	}
	res, err := h.Feed.Pull(c.Request().Context(), callerOf(c), p.BusinessId, string(p.Stream), p.Since, limit)
	if errors.Is(err, ErrNotMember) {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) SyncBootstrap(c echo.Context) error {
	caller, ok, err := h.hydrator(c)
	if !ok {
		return err
	}
	var body api.SyncBootstrapJSONRequestBody
	raw, err := readBody(c.Request(), 4096)
	if err == nil {
		err = json.Unmarshal(raw, &body)
	}
	if err != nil || body.BusinessId == "" {
		return httpx.Validation(c, "businessId is required")
	}
	snap, err := h.Snapshots.Request(c.Request().Context(), caller, body.BusinessId)
	return snapshotReply(c, snap, err)
}

func (h *Handler) GetSnapshot(c echo.Context, snapshotID string) error {
	caller, ok, err := h.hydrator(c)
	if !ok {
		return err
	}
	snap, err := h.Snapshots.Get(c.Request().Context(), caller, snapshotID)
	return snapshotReply(c, snap, err)
}

// hydrator is the signed device asking for a bundle, or the reply refusing it.
func (h *Handler) hydrator(c echo.Context) (Caller, bool, error) {
	caller := callerOf(c)
	if h.Snapshots == nil {
		return caller, false, httpx.Fail(c, http.StatusServiceUnavailable, "HYDRATION_UNAVAILABLE", api.Transient, "object storage is not configured")
	}
	if caller.DeviceID == "" {
		return caller, false, httpx.Unauthorized(c, "DEVICE_REQUIRED", "hydration must come from a registered, signed device")
	}
	return caller, true, nil
}

func snapshotReply(c echo.Context, snap *Snapshot, err error) error {
	switch {
	case errors.Is(err, ErrNotMember):
		return httpx.NotFound(c, "business")
	case errors.Is(err, ErrSnapshotNotFound):
		return httpx.NotFound(c, "snapshot")
	case err != nil:
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, snap)
}

// readBody reads a gzipped or plain body, refusing more than limit bytes once inflated.
func readBody(r *http.Request, limit int) ([]byte, error) {
	var body io.Reader = r.Body
	if strings.EqualFold(r.Header.Get("Content-Encoding"), "gzip") {
		gz, err := gzip.NewReader(r.Body)
		if err != nil {
			return nil, errors.New("body is not valid gzip")
		}
		defer gz.Close()
		body = gz
	}
	raw, err := io.ReadAll(io.LimitReader(body, int64(limit)+1))
	if err != nil {
		return nil, errors.New("unreadable body")
	}
	if len(raw) > limit {
		return nil, fmt.Errorf("the body may be at most %d bytes", limit)
	}
	return raw, nil
}

func decodePush(r *http.Request) (*PushRequest, error) {
	raw, err := readBody(r, PushMaxBytes)
	if err != nil {
		return nil, err
	}
	var req PushRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return nil, errors.New("malformed body")
	}
	return &req, nil
}

func validatePush(req *PushRequest) error {
	if req.BusinessID == "" || len(req.Operations) == 0 || len(req.Operations) > PushMaxOperations {
		return errors.New("businessId and 1 to 200 operations are required")
	}
	for _, op := range req.Operations {
		if op.OperationID == "" || op.EntityID == "" || op.EntityType == "" || op.PayloadHash == "" || op.OperationType == "" {
			return errors.New("every operation needs operationId, entityType, entityId, operationType and payloadHash")
		}
	}
	return nil
}
