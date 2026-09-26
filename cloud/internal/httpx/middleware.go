package httpx

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// ServerTime adds X-Server-Time (RFC 3339 UTC) to every response (NFR-018: devices measure clock skew from it).
func ServerTime(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		c.Response().Header().Set("X-Server-Time", time.Now().UTC().Format(time.RFC3339Nano))
		return next(c)
	}
}

// RequestID echoes an incoming X-Request-Id or generates one.
func RequestID() echo.MiddlewareFunc {
	return middleware.RequestIDWithConfig(middleware.RequestIDConfig{TargetHeader: echo.HeaderXRequestID})
}

// RateLimit is an in-memory token bucket per client IP (Redis-backed later).
func RateLimit(burst int, refillPerSec float64) echo.MiddlewareFunc {
	type bucket struct {
		tokens float64
		last   time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			mu.Lock()
			b, ok := buckets[ip]
			now := time.Now()
			if !ok {
				b = &bucket{tokens: float64(burst), last: now}
				buckets[ip] = b
			}
			b.tokens += now.Sub(b.last).Seconds() * refillPerSec
			if b.tokens > float64(burst) {
				b.tokens = float64(burst)
			}
			b.last = now
			allowed := b.tokens >= 1
			if allowed {
				b.tokens--
			}
			if len(buckets) > 50_000 { // crude memory bound
				buckets = map[string]*bucket{}
			}
			mu.Unlock()
			if !allowed {
				return Fail(c, http.StatusTooManyRequests, "RATE_LIMITED", "transient", "too many requests")
			}
			return next(c)
		}
	}
}
