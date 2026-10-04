package admin

import (
	"context"
	"errors"
	"strings"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

const (
	operatorScope = "op"
	operatorKeys  = "muneem-operator-v1"
	// SessionTTL is an operator token's life; there is no refresh, an operator signs in again.
	SessionTTL = auth.AccessTTL
)

var (
	ErrInvalidLogin = errors.New("invalid identifier or password")
	ErrNotOperator  = errors.New("not an operator session")
)

// Tokens mints and reads operator tokens under keys derived from the JWT ring, so no shop token verifies here and no
// operator token verifies on a shop route.
type Tokens struct{ signer *auth.Signer }

func NewTokens(keys *auth.Keyring) *Tokens {
	return &Tokens{signer: auth.NewKeyringSigner(keys.Derive(operatorKeys))}
}

// Session is a verified operator token: who, and the token id that CSRF tokens bind to.
type Session struct {
	OperatorID string
	TokenID    string
}

func (t *Tokens) Issue(operatorID string) (string, error) {
	c := auth.Claims{Scope: operatorScope}
	c.Subject = operatorID
	c.ID = ulid.Make().String()
	return t.signer.Issue(c)
}

func (t *Tokens) Parse(raw string) (Session, error) {
	c, err := t.signer.Parse(raw)
	if err != nil || c.Scope != operatorScope || c.Subject == "" || c.ID == "" {
		return Session{}, ErrNotOperator
	}
	return Session{OperatorID: c.Subject, TokenID: c.ID}, nil
}

// Operators signs operators in and re-checks their grant on every request, so revoking a grant ends a session at once.
type Operators struct {
	Dir    *Directory
	Tokens *Tokens
}

// burnHash keeps an unknown identifier as slow as a wrong password.
const burnHash = "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

func (o *Operators) Login(ctx context.Context, identifier, password, requestID string) (string, error) {
	ident := strings.ToLower(strings.TrimSpace(identifier))
	acc, err := o.Dir.account(ctx, ident)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return "", err
	}
	ok := false
	if acc == nil {
		_, _ = auth.VerifyPassword(burnHash, password)
	} else {
		ok, _ = auth.VerifyPassword(acc.PasswordHash, password)
		ok = ok && acc.Active && acc.Operator
	}
	if !ok {
		failed := Actor{RequestID: requestID}
		if err := o.Dir.Audit(ctx, failed, nil, "admin.login_failed", "operator", ident, nil); err != nil {
			return "", err
		}
		return "", ErrInvalidLogin
	}
	token, err := o.Tokens.Issue(acc.UserID)
	if err != nil {
		return "", err
	}
	return token, o.Dir.Audit(ctx, Actor{OperatorID: acc.UserID, RequestID: requestID}, nil, "admin.login", "operator", acc.UserID, nil)
}

func (o *Operators) Authenticate(ctx context.Context, raw string) (Session, error) {
	s, err := o.Tokens.Parse(raw)
	if err != nil {
		return s, err
	}
	ok, err := o.Dir.isOperator(ctx, s.OperatorID)
	if err != nil {
		return Session{}, err
	}
	if !ok {
		return Session{}, ErrNotOperator
	}
	return s, nil
}
