// Package devicesync is the device sync surface: push, pull and hydration (LLD §7, Stage 7).
package devicesync

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

type Handler struct{}

func notYet(c echo.Context) error {
	return httpx.Fail(c, http.StatusNotImplemented, "NOT_IMPLEMENTED", api.Transient, "sync is not available yet")
}

func (h *Handler) SyncPush(c echo.Context) error                       { return notYet(c) }
func (h *Handler) SyncPull(c echo.Context, _ api.SyncPullParams) error { return notYet(c) }
func (h *Handler) SyncBootstrap(c echo.Context) error                  { return notYet(c) }
func (h *Handler) GetSnapshot(c echo.Context, _ string) error          { return notYet(c) }
