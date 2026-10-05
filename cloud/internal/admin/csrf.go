package admin

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
)

// CSRF binds a form token to the operator session's token id, under a key that lives as long as the process.
type CSRF struct{ key []byte }

func NewCSRF() *CSRF { return &CSRF{key: randomBytes(32)} }

func (x *CSRF) Token(tokenID string) string {
	m := hmac.New(sha256.New, x.key)
	m.Write([]byte("csrf:" + tokenID))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (x *CSRF) Valid(tokenID, token string) bool {
	return tokenID != "" && token != "" && hmac.Equal([]byte(x.Token(tokenID)), []byte(token))
}

// sameToken compares a double-submitted login token with its cookie.
func sameToken(a, b string) bool {
	return a != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b
}

func randomToken() string { return base64.RawURLEncoding.EncodeToString(randomBytes(32)) }
