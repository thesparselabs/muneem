package share_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/share"
)

func post(h *share.Handler, deviceID string) (int, string) {
	req := httptest.NewRequest(http.MethodPost, "/v1/share/email", strings.NewReader(`{}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	if deviceID != "" {
		c.Set("muneem.device_id", deviceID)
	}
	_ = h.SendShareEmail(c)
	var e api.ErrorResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	return rec.Code, e.Error.Code
}

func TestWithoutARelayEmailIsUnavailableAndStaysQueued(t *testing.T) {
	code, errCode := post(&share.Handler{}, "01J00000000000000000000C01")
	if code != http.StatusServiceUnavailable || errCode != "MAIL_UNAVAILABLE" {
		t.Fatalf("HTTP %d %s", code, errCode)
	}
}

func TestAShareNeedsASignedDevice(t *testing.T) {
	code, errCode := post(&share.Handler{}, "")
	if code != http.StatusUnauthorized || errCode != "DEVICE_REQUIRED" {
		t.Fatalf("HTTP %d %s", code, errCode)
	}
}
