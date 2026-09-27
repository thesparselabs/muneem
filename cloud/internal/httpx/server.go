package httpx

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/sparselabs/muneem/cloud/api"
)

const Version = "0.1.0"
const SyncProtocol = 1

// Handlers is the composed api.ServerInterface: each domain package contributes its methods by embedding.
type Handlers interface{ api.ServerInterface }

type Deps struct {
	Handlers       Handlers
	RequireAuth    echo.MiddlewareFunc
	DeviceVerifier echo.MiddlewareFunc
	Logger         *slog.Logger
}

// New builds the Echo instance with the middleware pipeline:
// request id → server time → logging → recover → (per route) rate limit / auth / device signature.
func New(d Deps) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Use(RequestID(), ServerTime, middleware.Recover(), middleware.BodyLimit("2M"))
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus: true, LogURI: true, LogMethod: true, LogLatency: true, LogRequestID: true, LogError: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			attrs := []any{"method", v.Method, "uri", v.URI, "status", v.Status, "latency_ms", v.Latency.Milliseconds(), "request_id", v.RequestID}
			if v.Error != nil {
				attrs = append(attrs, "error", v.Error.Error())
			}
			d.Logger.LogAttrs(c.Request().Context(), slog.LevelInfo, "request", toAttrs(attrs)...)
			return nil
		},
	}))

	authLimit := RateLimit(20, 5)
	// Route-level middleware: public auth routes get a rate limit; everything else needs a bearer token
	// and, when a device is involved, a valid request signature.
	protect := func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			p := c.Request().URL.Path
			switch {
			case strings.HasSuffix(p, "/health"):
				return next(c)
			case strings.Contains(p, "/auth/register"), strings.Contains(p, "/auth/login"), strings.Contains(p, "/auth/refresh"):
				return authLimit(next)(c)
			default:
				return d.RequireAuth(d.DeviceVerifier(next))(c)
			}
		}
	}
	g := e.Group("/v1", protect)
	api.RegisterHandlers(g, d.Handlers)
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		if he, ok := err.(*echo.HTTPError); ok {
			_ = Fail(c, he.Code, "HTTP_"+http.StatusText(he.Code), api.Validation, strings.TrimSpace(strings.ReplaceAll(http.StatusText(he.Code), " ", " ")))
			return
		}
		_ = Internal(c, err)
	}
	return e
}

func toAttrs(kv []any) []slog.Attr {
	out := make([]slog.Attr, 0, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		out = append(out, slog.Any(kv[i].(string), kv[i+1]))
	}
	return out
}

// Health is the unauthenticated liveness endpoint; devices probe it to decide "online" (LLD §8.3).
type Health struct{}

func (Health) GetHealth(c echo.Context) error {
	return c.JSON(http.StatusOK, api.Health{Status: api.Ok, ServerTime: time.Now().UTC(), Version: Version, Protocol: SyncProtocol})
}
