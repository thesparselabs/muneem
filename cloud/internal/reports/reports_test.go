package reports

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
)

func TestLineCostIsTheLinesMovement(t *testing.T) {
	ref := "S1-002"
	other := "S1-001"
	s := salePayload{}
	s.Movements = append(s.Movements, struct {
		RefLineID  *string `json:"refLineId"`
		ValuePaise int64   `json:"valuePaise"`
	}{&other, -100}, struct {
		RefLineID  *string `json:"refLineId"`
		ValuePaise int64   `json:"valuePaise"`
	}{&ref, -4_333})
	if got := s.lineCost("S1", 2); got != 4_333 {
		t.Fatalf("line 2 cost = %d", got)
	}
	if got := s.lineCost("S1", 3); got != 0 {
		t.Fatalf("a line without a movement costs %d", got)
	}
}

func TestDailyReportRefusesBadRequestsBeforeTheDatabase(t *testing.T) {
	signer := auth.NewSigner("unit-secret")
	tok, err := signer.Issue(auth.Claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "U1"}})
	if err != nil {
		t.Fatal(err)
	}
	h := &Handler{}
	day := func(s string) openapi_types.Date {
		d, _ := time.Parse(dayFormat, s)
		return openapi_types.Date{Time: d}
	}
	call := func(withToken bool, p api.GetDailyReportParams) int {
		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/v1/reports/daily", nil)
		if withToken {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		handler := func(c echo.Context) error { return h.GetDailyReport(c, p) }
		if withToken {
			_ = signer.Require(handler)(c)
		} else {
			_ = handler(c)
		}
		return rec.Code
	}
	if code := call(false, api.GetDailyReportParams{BusinessId: "B", From: day("2026-04-01"), To: day("2026-04-30")}); code != http.StatusUnauthorized {
		t.Fatalf("no session: %d", code)
	}
	for name, p := range map[string]api.GetDailyReportParams{
		"inverted":    {BusinessId: "B", From: day("2026-05-01"), To: day("2026-04-01")},
		"too long":    {BusinessId: "B", From: day("2025-01-01"), To: day("2026-04-01")},
		"no business": {From: day("2026-04-01"), To: day("2026-04-02")},
	} {
		if code := call(true, p); code < 400 || code >= 500 {
			t.Fatalf("%s: %d", name, code)
		}
	}
}
