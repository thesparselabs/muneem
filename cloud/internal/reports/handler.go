package reports

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// MaxDays bounds one request; an owner report asks for a year at most.
const MaxDays = 366

// Handler is the /reports surface: any member of the business, with or without a device.
type Handler struct{ DB *store.DB }

func (h *Handler) GetDailyReport(c echo.Context, p api.GetDailyReportParams) error {
	cl := auth.ClaimsFrom(c)
	if cl == nil {
		return httpx.Unauthorized(c, "UNAUTHENTICATED", "sign in first")
	}
	from, to := p.From.Time, p.To.Time
	if p.BusinessId == "" || to.Before(from) || to.Sub(from).Hours()/24 >= MaxDays {
		return httpx.Validation(c, "businessId and a range of at most 366 days, from ≤ to, are required")
	}
	r, err := Daily(c.Request().Context(), h.DB, cl.Subject, p.BusinessId, from, to)
	if errors.Is(err, ErrNotMember) {
		return httpx.NotFound(c, "business")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	r.From, r.To = openapi_types.Date{Time: from}, openapi_types.Date{Time: to}
	return c.JSON(http.StatusOK, r)
}
