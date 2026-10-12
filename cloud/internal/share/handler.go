package share

import (
	"bytes"
	"encoding/base64"
	"errors"
	"net/http"
	"regexp"
	"unicode/utf8"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/mail"
)

var (
	shareIDRe  = regexp.MustCompile(`^[0-9A-HJKMNP-TV-Z]{26}$`)
	fileNameRe = regexp.MustCompile(`^[A-Za-z0-9 ._()-]{1,96}\.pdf$`)
)

const (
	maxSubject  = 200
	maxText     = 4000
	maxFromName = 120
)

// Handler is POST /share/email; it needs a member's registered, signed device.
type Handler struct{ Service *Service }

func (h *Handler) SendShareEmail(c echo.Context) error {
	caller := Caller{}
	if cl := auth.ClaimsFrom(c); cl != nil {
		caller.UserID = cl.Subject
	}
	caller.DeviceID, _ = c.Get("muneem.device_id").(string)
	if caller.DeviceID == "" {
		return httpx.Unauthorized(c, "DEVICE_REQUIRED", "a share must come from a registered, signed device")
	}
	if h.Service == nil {
		return unavailable(c)
	}
	var body api.ShareEmailRequest
	if err := c.Bind(&body); err != nil {
		return httpx.Validation(c, "the body must be a share email request")
	}
	e, problem := h.email(body)
	if problem != "" {
		return httpx.Validation(c, problem)
	}
	sentAt, err := h.Service.Send(c.Request().Context(), caller, e)
	switch {
	case errors.Is(err, ErrNotMember):
		return httpx.NotFound(c, "business")
	case errors.Is(err, ErrRateLimited):
		return httpx.Fail(c, http.StatusTooManyRequests, "RATE_LIMITED", api.Transient, "this business has reached today's email limit; it is sent later")
	case errors.Is(err, ErrUnconfigured):
		return unavailable(c)
	case errors.Is(err, ErrSendFailed):
		return httpx.Fail(c, http.StatusBadGateway, "MAIL_SEND_FAILED", api.Transient, "the mail relay did not take the message; try again")
	case err != nil:
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, api.ShareEmailResult{ShareId: e.ShareID, Status: api.Sent, SentAt: sentAt.UTC()})
}

func unavailable(c echo.Context) error {
	return httpx.Fail(c, http.StatusServiceUnavailable, "MAIL_UNAVAILABLE", api.Transient, "email is not configured on this server")
}

// email checks every field a header or the relay sees; the problem is empty when the request is good.
func (h *Handler) email(b api.ShareEmailRequest) (Email, string) {
	to, err := mail.Address(b.To)
	if err != nil {
		return Email{}, "to must be one email address"
	}
	replyTo := ""
	if b.ReplyTo != nil && *b.ReplyTo != "" {
		if replyTo, err = mail.Address(*b.ReplyTo); err != nil {
			return Email{}, "replyTo must be one email address"
		}
	}
	switch {
	case !shareIDRe.MatchString(b.ShareId):
		return Email{}, "shareId must be a ULID"
	case b.BusinessId == "":
		return Email{}, "businessId is required"
	case !text(b.FromName, 1, maxFromName, false):
		return Email{}, "fromName must be 1–120 characters on one line"
	case !text(b.Subject, 1, maxSubject, false):
		return Email{}, "subject must be 1–200 characters on one line"
	case !text(b.Text, 1, maxText, true):
		return Email{}, "text must be 1–4000 characters"
	case !fileNameRe.MatchString(b.Attachment.FileName):
		return Email{}, "attachment.fileName must be a plain name ending in .pdf"
	}
	pdf, err := base64.StdEncoding.DecodeString(b.Attachment.ContentBase64)
	if err != nil || !bytes.HasPrefix(pdf, []byte("%PDF-")) {
		return Email{}, "attachment.contentBase64 must be base64 of a PDF"
	}
	if len(pdf) > h.Service.MaxBytes() {
		return Email{}, "the attachment is larger than the cloud emails"
	}
	return Email{ShareID: b.ShareId, BusinessID: b.BusinessId, To: to, ReplyTo: replyTo, FromName: b.FromName, Subject: b.Subject,
		Text: b.Text, FileName: b.Attachment.FileName, PDF: pdf}, ""
}

func text(s string, min, max int, multiline bool) bool {
	n := utf8.RuneCountInString(s)
	if !utf8.ValidString(s) || n < min || n > max {
		return false
	}
	return multiline || !bytes.ContainsAny([]byte(s), "\r\n")
}
