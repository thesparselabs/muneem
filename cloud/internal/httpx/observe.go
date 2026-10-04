package httpx

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// RequestObserver records RED metrics; metrics.Metrics implements it.
type RequestObserver interface {
	ObserveRequest(method, route string, status int, took time.Duration)
}

// unmatchedRoute labels requests no route matched, so scanners cannot inflate label cardinality.
const unmatchedRoute = "unmatched"

// ObserveRequests labels by the route template (c.Path()), never the raw URI.
func ObserveRequests(o RequestObserver) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			route := c.Path()
			if route == "" || route == "/*" {
				route = unmatchedRoute
			}
			o.ObserveRequest(c.Request().Method, route, statusOf(c, err), time.Since(start))
			return err
		}
	}
}

func statusOf(c echo.Context, err error) int {
	if err == nil {
		return c.Response().Status
	}
	var he *echo.HTTPError
	if errors.As(err, &he) {
		return he.Code
	}
	return http.StatusInternalServerError
}
