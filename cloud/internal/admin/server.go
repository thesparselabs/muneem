package admin

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

// Module is the operator surface: the JSON API under /v1/admin and the page under /admin.
type Module struct {
	Operators *Operators
	Dir       *Directory
	API       *Handler
	Web       *Web
}

func NewModule(dir *Directory, operators *Operators, actions *Actions, csrf *CSRF) *Module {
	return &Module{
		Operators: operators,
		Dir:       dir,
		API:       &Handler{Operators: operators, Dir: dir, Actions: actions},
		Web:       NewWeb(operators, dir, actions, csrf),
	}
}

const loginPath = "/v1/admin/auth/login"

// DefaultAddr keeps the operator listener on loopback; the container publishes it to the VM's loopback only.
const DefaultAddr = "127.0.0.1:8081"

// Mount adds the operator routes to e. The API serves them on its admin listener; on the public server only when
// MUNEEM_ADMIN_PUBLIC is set (ADR-0057).
func (m *Module) Mount(e *echo.Echo) {
	loginLimit := httpx.RateLimit(5, 0.2)
	g := e.Group("/v1/admin", func(next echo.HandlerFunc) echo.HandlerFunc {
		limited, guarded := loginLimit(next), m.requireBearer(m.auditView(next))
		return func(c echo.Context) error {
			if c.Request().URL.Path == loginPath {
				return limited(c)
			}
			return guarded(c)
		}
	})
	adminapi.RegisterHandlers(g, m.API)
	m.Web.mount(e.Group("/admin", pageHeaders), loginLimit, m.auditView)
}

func (m *Module) requireBearer(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		h := c.Request().Header.Get(echo.HeaderAuthorization)
		if !strings.HasPrefix(h, "Bearer ") {
			return httpx.Unauthorized(c, "NOT_AUTHENTICATED", "missing operator token")
		}
		s, err := m.Operators.Authenticate(c.Request().Context(), strings.TrimPrefix(h, "Bearer "))
		if errors.Is(err, ErrNotOperator) {
			return httpx.Unauthorized(c, "NOT_OPERATOR", "an operator token is required")
		}
		if err != nil {
			return httpx.Internal(c, err)
		}
		c.Set(sessionKey, s)
		return next(c)
	}
}

// auditView records every operator read before it is served, so no cross-shop data leaves without an audit row.
func (m *Module) auditView(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if c.Request().Method != http.MethodGet {
			return next(c)
		}
		var business *string
		if id := c.Param("businessId"); id != "" {
			business = &id
		}
		route := map[string]string{"path": c.Request().URL.Path, "query": c.Request().URL.RawQuery}
		if err := m.Dir.Audit(c.Request().Context(), actorOf(c, ""), business, "admin.view", "admin_route", c.Path(), route); err != nil {
			return err
		}
		return next(c)
	}
}

func pageHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		h := c.Response().Header()
		h.Set("Content-Security-Policy", "default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		return next(c)
	}
}

// NewServer is the admin listener's own Echo: only the operator routes, never the shop API.
func NewServer(m *Module, log *slog.Logger) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Use(httpx.RequestID(), httpx.ServerTime, middleware.Recover(), middleware.BodyLimit("64K"))
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus: true, LogURI: true, LogMethod: true, LogLatency: true, LogRequestID: true, LogError: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			log.Info("admin request", "method", v.Method, "uri", v.URI, "status", v.Status, "latency_ms", v.Latency.Milliseconds(),
				"request_id", v.RequestID, "operator", sessionFrom(c).OperatorID)
			return nil
		},
	}))
	m.Mount(e)
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		code := http.StatusInternalServerError
		var he *echo.HTTPError
		if errors.As(err, &he) {
			code = he.Code
		} else {
			log.Error("admin", "error", err, "request_id", requestID(c))
		}
		if strings.HasPrefix(c.Request().URL.Path, "/v1/") {
			_ = httpx.Fail(c, code, "HTTP_"+strings.ReplaceAll(strings.ToUpper(http.StatusText(code)), " ", "_"), "permanent", http.StatusText(code))
			return
		}
		_ = c.String(code, http.StatusText(code))
	}
	return e
}
