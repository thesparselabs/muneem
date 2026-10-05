package admin

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// Handler is the JSON operator API (adminapi.ServerInterface); requireBearer has already authenticated the operator.
type Handler struct {
	Operators *Operators
	Dir       *Directory
	Actions   *Actions
}

var _ adminapi.ServerInterface = (*Handler)(nil)

const sessionKey = "muneem.operator"

func sessionFrom(c echo.Context) Session {
	s, _ := c.Get(sessionKey).(Session)
	return s
}

func requestID(c echo.Context) string { return c.Response().Header().Get(echo.HeaderXRequestID) }

func actorOf(c echo.Context, reason string) Actor {
	return Actor{OperatorID: sessionFrom(c).OperatorID, Reason: reason, RequestID: requestID(c)}
}

const (
	minReason = 5
	maxReason = 500
)

// reasonOf is the required why of an action.
func reasonOf(raw string) (string, error) {
	r := strings.TrimSpace(raw)
	if n := utf8.RuneCountInString(r); n < minReason || n > maxReason {
		return "", errors.New("a reason of 5 to 500 characters is required")
	}
	return r, nil
}

func (h *Handler) AdminLogin(c echo.Context) error {
	var req adminapi.OperatorLoginRequest
	if err := c.Bind(&req); err != nil || req.Identifier == "" || req.Password == "" {
		return httpx.Validation(c, "identifier and password are required")
	}
	token, err := h.Operators.Login(c.Request().Context(), req.Identifier, req.Password, requestID(c))
	if errors.Is(err, ErrInvalidLogin) {
		return httpx.Unauthorized(c, "INVALID_CREDENTIALS", "invalid identifier or password")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, adminapi.OperatorToken{AccessToken: token, ExpiresIn: int(SessionTTL.Seconds()), TokenType: adminapi.Bearer})
}

func (h *Handler) AdminListShops(c echo.Context, p adminapi.AdminListShopsParams) error {
	page, err := PageOf(p.Limit, p.Cursor)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Dir.Shops(c.Request().Context(), page)
	return reply(c, out, err, "shop")
}

func (h *Handler) AdminGetShop(c echo.Context, businessID string) error {
	out, err := h.Dir.Shop(c.Request().Context(), businessID)
	return reply(c, out, err, "shop")
}

func (h *Handler) AdminListDeadLetters(c echo.Context, businessID string, p adminapi.AdminListDeadLettersParams) error {
	page, err := PageOf(p.Limit, p.Cursor)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	openOnly := p.State == nil || *p.State == adminapi.Open
	out, err := h.Dir.DeadLetters(c.Request().Context(), businessID, openOnly, page)
	return reply(c, out, err, "dead letter")
}

func (h *Handler) AdminGetDeadLetter(c echo.Context, id int64) error {
	out, err := h.Dir.DeadLetter(c.Request().Context(), id)
	return reply(c, out.Letter, err, "dead letter")
}

func (h *Handler) AdminListReviewItems(c echo.Context, businessID string, p adminapi.AdminListReviewItemsParams) error {
	return h.reviewItems(c, businessID, false, p.Limit, p.Cursor)
}

func (h *Handler) AdminListChainBreaks(c echo.Context, businessID string, p adminapi.AdminListChainBreaksParams) error {
	return h.reviewItems(c, businessID, true, p.Limit, p.Cursor)
}

func (h *Handler) reviewItems(c echo.Context, businessID string, chainBreaks bool, limit *int, cursor *string) error {
	page, err := PageOf(limit, cursor)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Dir.ReviewItems(c.Request().Context(), businessID, chainBreaks, page)
	return reply(c, out, err, "review item")
}

func (h *Handler) AdminListBackups(c echo.Context, businessID string, p adminapi.AdminListBackupsParams) error {
	page, err := PageOf(p.Limit, p.Cursor)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Dir.Backups(c.Request().Context(), businessID, page)
	return reply(c, out, err, "backup")
}

func (h *Handler) AdminRevokeDevice(c echo.Context, deviceID string) error {
	who, err := h.actor(c)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Actions.RevokeDevice(c.Request().Context(), who, deviceID)
	return reply(c, out, err, "device")
}

func (h *Handler) AdminResendDeadLetter(c echo.Context, id int64) error {
	who, err := h.actor(c)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Actions.Resend(c.Request().Context(), who, id)
	return reply(c, out, err, "dead letter")
}

func (h *Handler) AdminDismissDeadLetter(c echo.Context, id int64) error {
	who, err := h.actor(c)
	if err != nil {
		return httpx.Validation(c, err.Error())
	}
	out, err := h.Actions.Dismiss(c.Request().Context(), who, id)
	return reply(c, out, err, "dead letter")
}

func (h *Handler) actor(c echo.Context) (Actor, error) {
	var body adminapi.ActionReason
	if err := c.Bind(&body); err != nil {
		return Actor{}, errors.New("malformed body")
	}
	reason, err := reasonOf(body.Reason)
	return actorOf(c, reason), err
}

func reply(c echo.Context, body any, err error, what string) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return httpx.NotFound(c, what)
	case errors.Is(err, errResolved):
		return httpx.Conflict(c, "ALREADY_RESOLVED", "the dead letter is already resolved")
	case errors.Is(err, errBadCursor):
		return httpx.Validation(c, err.Error())
	case err != nil:
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, body)
}
