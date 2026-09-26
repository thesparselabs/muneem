// Package auth implements registration, login, refresh rotation, logout and /me.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/httpx"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

const RefreshTTL = 60 * 24 * time.Hour

var OfflinePolicy = api.OfflinePolicy{MaxOfflineDays: 30, PinMaxAttempts: 5, PinLockoutSeconds: 300}

type Handler struct {
	DB     *store.DB
	Signer *Signer
}

func newRefreshToken() (raw, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(sum[:])
}
func hashToken(raw string) string { s := sha256.Sum256([]byte(raw)); return hex.EncodeToString(s[:]) }

func (h *Handler) Register(c echo.Context) error {
	var req api.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	req.Identifier = strings.ToLower(strings.TrimSpace(req.Identifier))
	if len(req.Name) == 0 || len(req.Identifier) < 3 || len(req.Password) < 8 {
		return httpx.Validation(c, "name, identifier and a password of at least 8 characters are required")
	}
	hash, err := HashPassword(req.Password)
	if err != nil {
		return httpx.Internal(c, err)
	}
	u := store.User{ID: ulid.Make().String(), Name: req.Name, Identifier: req.Identifier, PasswordHash: hash}
	if strings.Contains(req.Identifier, "@") {
		u.Email = &req.Identifier
	} else {
		u.Mobile = &req.Identifier
	}
	orgID := ulid.Make().String()
	err = h.DB.WithTx(c.Request().Context(), store.Scope{UserID: u.ID}, func(tx pgx.Tx) error {
		if err := store.CreateUserWithOrg(c.Request().Context(), tx, u, orgID, req.Name+"'s organization"); err != nil {
			return err
		}
		return store.Audit(c.Request().Context(), tx, nil, &u.ID, nil, "auth.register", "user", &u.ID, nil, map[string]string{"identifier": u.Identifier}, rid(c))
	})
	if store.IsUniqueViolation(err) {
		return httpx.Conflict(c, "ALREADY_EXISTS", "an account with this identifier already exists")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusCreated, api.RegisterResponse{UserId: u.ID})
}

func (h *Handler) Login(c echo.Context) error {
	var req api.LoginRequest
	if err := c.Bind(&req); err != nil {
		return httpx.Validation(c, "malformed body")
	}
	ctx := c.Request().Context()
	ident := strings.ToLower(strings.TrimSpace(req.Identifier))
	var resp api.LoginResponse
	var authErr error
	err := h.DB.WithTx(ctx, store.Scope{}, func(tx pgx.Tx) error {
		u, err := store.GetUserByIdentifier(ctx, tx, ident)
		if errors.Is(err, store.ErrNotFound) {
			// burn comparable time so identifier enumeration by timing is harder
			_, _ = VerifyPassword("$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", req.Password)
			authErr = errors.New("invalid")
			return nil
		}
		if err != nil {
			return err
		}
		ok, err := VerifyPassword(u.PasswordHash, req.Password)
		if err != nil || !ok || !u.IsActive {
			authErr = errors.New("invalid")
			return nil
		}
		if _, err := tx.Exec(ctx, "SELECT set_config('app.user_id', $1, true)", u.ID); err != nil {
			return err
		}
		me, err := h.buildMe(ctx, tx, u)
		if err != nil {
			return err
		}
		pair, err := h.issueTokens(ctx, tx, u.ID, ulid.Make().String(), nil)
		if err != nil {
			return err
		}
		resp = api.LoginResponse{AccessToken: pair.AccessToken, RefreshToken: pair.RefreshToken, ExpiresIn: pair.ExpiresIn,
			TokenType: api.LoginResponseTokenType(pair.TokenType), User: me.User, Organizations: me.Organizations,
			Memberships: me.Memberships, OfflinePolicy: me.OfflinePolicy, ServerTime: me.ServerTime}
		return store.Audit(ctx, tx, nil, &u.ID, nil, "auth.login", "user", &u.ID, nil, map[string]any{"installation_id": req.InstallationId}, rid(c))
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if authErr != nil {
		return httpx.Unauthorized(c, "INVALID_CREDENTIALS", "invalid identifier or password")
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) issueTokens(ctx context.Context, tx pgx.Tx, userID, familyID string, deviceID *string) (*api.TokenPair, error) {
	orgs, err := store.ListOrganizations(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	claims := Claims{PermVer: 0}
	claims.Subject = userID
	if len(orgs) > 0 {
		claims.Org = orgs[0].ID
	}
	if deviceID != nil {
		claims.Device = *deviceID
	}
	access, err := h.Signer.Issue(claims)
	if err != nil {
		return nil, err
	}
	raw, hash := newRefreshToken()
	if err := store.InsertRefreshToken(ctx, tx, store.RefreshToken{ID: ulid.Make().String(), UserID: userID, FamilyID: familyID, TokenHash: hash, DeviceID: deviceID, ExpiresAt: time.Now().Add(RefreshTTL)}); err != nil {
		return nil, err
	}
	return &api.TokenPair{AccessToken: access, RefreshToken: raw, ExpiresIn: int(AccessTTL.Seconds()), TokenType: api.TokenPairTokenType("Bearer")}, nil
}

func (h *Handler) buildMe(ctx context.Context, tx pgx.Tx, u *store.User) (*api.Me, error) {
	orgs, err := store.ListOrganizations(ctx, tx, u.ID)
	if err != nil {
		return nil, err
	}
	ms, err := store.ListMemberships(ctx, tx, u.ID)
	if err != nil {
		return nil, err
	}
	me := &api.Me{User: api.User{Id: u.ID, Name: u.Name, Identifier: u.Identifier, Email: u.Email, Mobile: u.Mobile},
		Organizations: []api.Organization{}, Memberships: []api.Membership{}, OfflinePolicy: OfflinePolicy, ServerTime: time.Now().UTC()}
	for _, o := range orgs {
		me.Organizations = append(me.Organizations, api.Organization{Id: o.ID, Name: o.Name})
	}
	for _, m := range ms {
		var g []api.Grant
		if err := json.Unmarshal(m.GrantsJSON, &g); err != nil || g == nil {
			g = GrantsFor(m.Roles)
		}
		me.Memberships = append(me.Memberships, api.Membership{BusinessId: m.BusinessID, BusinessName: m.BusinessName, OrganizationId: m.OrganizationID, Roles: m.Roles,
			PermissionSnapshot: api.PermissionSnapshot{PermVer: m.PermVer, Roles: m.Roles, Grants: g, IssuedAt: m.IssuedAt}})
	}
	return me, nil
}

func (h *Handler) Refresh(c echo.Context) error {
	var req api.RefreshRequest
	if err := c.Bind(&req); err != nil || req.RefreshToken == "" {
		return httpx.Validation(c, "refresh_token required")
	}
	ctx := c.Request().Context()
	var pair *api.TokenPair
	var authErr string
	err := h.DB.WithTx(ctx, store.Scope{}, func(tx pgx.Tx) error {
		t, err := store.GetRefreshToken(ctx, tx, hashToken(req.RefreshToken))
		if errors.Is(err, store.ErrNotFound) {
			authErr = "unknown refresh token"
			return nil
		}
		if err != nil {
			return err
		}
		if t.RevokedAt != nil || t.UsedAt != nil {
			// Reuse detected: a rotated token was replayed → revoke the whole family (LLD §15.1).
			authErr = "refresh token reuse detected; session revoked"
			return store.RevokeRefreshFamily(ctx, tx, t.FamilyID)
		}
		if time.Now().After(t.ExpiresAt) {
			authErr = "refresh token expired"
			return nil
		}
		if err := store.MarkRefreshUsed(ctx, tx, t.ID); err != nil {
			return err
		}
		pair, err = h.issueTokens(ctx, tx, t.UserID, t.FamilyID, t.DeviceID)
		return err
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	if authErr != "" {
		return httpx.Unauthorized(c, "SESSION_EXPIRED", authErr)
	}
	return c.JSON(http.StatusOK, pair)
}

func (h *Handler) Logout(c echo.Context) error {
	var req api.RefreshRequest
	if err := c.Bind(&req); err != nil || req.RefreshToken == "" {
		return httpx.Validation(c, "refresh_token required")
	}
	ctx := c.Request().Context()
	err := h.DB.WithTx(ctx, store.Scope{}, func(tx pgx.Tx) error {
		t, err := store.GetRefreshToken(ctx, tx, hashToken(req.RefreshToken))
		if errors.Is(err, store.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return store.RevokeRefreshFamily(ctx, tx, t.FamilyID)
	})
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) GetMe(c echo.Context) error {
	cl := ClaimsFrom(c)
	ctx := c.Request().Context()
	var me *api.Me
	err := h.DB.WithTx(ctx, store.Scope{UserID: cl.Subject, DeviceID: cl.Device}, func(tx pgx.Tx) error {
		u, err := store.GetUser(ctx, tx, cl.Subject)
		if err != nil {
			return err
		}
		me, err = h.buildMe(ctx, tx, u)
		return err
	})
	if errors.Is(err, store.ErrNotFound) {
		return httpx.Unauthorized(c, "NOT_AUTHENTICATED", "user no longer exists")
	}
	if err != nil {
		return httpx.Internal(c, err)
	}
	return c.JSON(http.StatusOK, me)
}

func rid(c echo.Context) string { return c.Response().Header().Get(echo.HeaderXRequestID) }
