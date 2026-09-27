package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

const AccessTTL = 15 * time.Minute

// Claims are the access-token claims (LLD §15.1).
type Claims struct {
	Org      string   `json:"org,omitempty"`
	Business string   `json:"business,omitempty"`
	Branch   string   `json:"branch,omitempty"`
	Device   string   `json:"device,omitempty"`
	Roles    []string `json:"roles,omitempty"`
	PermVer  int      `json:"perm_ver"`
	jwt.RegisteredClaims
}

type Signer struct{ secret []byte }

func NewSigner(secret string) *Signer { return &Signer{secret: []byte(secret)} }

func (s *Signer) Issue(c Claims) (string, error) {
	now := time.Now()
	c.IssuedAt = jwt.NewNumericDate(now)
	c.ExpiresAt = jwt.NewNumericDate(now.Add(AccessTTL))
	c.Issuer = "muneem"
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}

func (s *Signer) Parse(token string) (*Claims, error) {
	c := &Claims{}
	t, err := jwt.ParseWithClaims(token, c, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	}, jwt.WithIssuer("muneem"), jwt.WithLeeway(30*time.Second))
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	return c, nil
}

const claimsKey = "muneem.claims"

// Require is the bearer-auth middleware; it stores *Claims on the echo context.
func (s *Signer) Require(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		h := c.Request().Header.Get(echo.HeaderAuthorization)
		if !strings.HasPrefix(h, "Bearer ") {
			return httpx.Unauthorized(c, "NOT_AUTHENTICATED", "missing bearer token")
		}
		claims, err := s.Parse(strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			return httpx.Unauthorized(c, "SESSION_EXPIRED", "invalid or expired token")
		}
		c.Set(claimsKey, claims)
		return next(c)
	}
}

// ClaimsFrom returns the authenticated claims or nil.
func ClaimsFrom(c echo.Context) *Claims {
	if v, ok := c.Get(claimsKey).(*Claims); ok {
		return v
	}
	return nil
}

// Public marks routes that skip auth (used by the router; handlers check ClaimsFrom when needed).
func Public(next echo.HandlerFunc) echo.HandlerFunc { return next }

var _ = http.StatusOK
