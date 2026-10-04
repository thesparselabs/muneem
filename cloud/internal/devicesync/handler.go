// Package devicesync is the device sync surface: push, pull and hydration (LLD §7, Stage 7).
package devicesync

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

type Handler struct {
	Ingest *Ingest
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

func notYet(c echo.Context) error {
	return httpx.Fail(c, http.StatusNotImplemented, "NOT_IMPLEMENTED", api.Transient, "not available yet")
}

func (h *Handler) SyncPull(c echo.Context, _ api.SyncPullParams) error { return notYet(c) }
func (h *Handler) SyncBootstrap(c echo.Context) error                  { return notYet(c) }
func (h *Handler) GetSnapshot(c echo.Context, _ string) error          { return notYet(c) }

// decodePush reads a gzipped or plain body, refusing more than 2 MB once inflated.
func decodePush(r *http.Request) (*PushRequest, error) {
	var body io.Reader = r.Body
	if strings.EqualFold(r.Header.Get("Content-Encoding"), "gzip") {
		gz, err := gzip.NewReader(r.Body)
		if err != nil {
			return nil, errors.New("body is not valid gzip")
		}
		defer gz.Close()
		body = gz
	}
	raw, err := io.ReadAll(io.LimitReader(body, PushMaxBytes+1))
	if err != nil {
		return nil, errors.New("unreadable body")
	}
	if len(raw) > PushMaxBytes {
		return nil, errors.New("a push may carry at most 2 MB")
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
