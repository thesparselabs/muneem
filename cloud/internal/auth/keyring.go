package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// MinSecretBytes is the shortest HS256 secret a keyring entry accepts.
const MinSecretBytes = 32

type Key struct {
	ID     string
	Secret []byte
}

// Keyring holds the JWT signing keys: active signs, every key verifies its kid, legacy verifies tokens without one.
type Keyring struct {
	active Key
	byID   map[string][]byte
	legacy []byte
}

var kidPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

// LegacyKeyring is the single JWT_SECRET: it signs without a kid and verifies only kid-less tokens.
func LegacyKeyring(secret string) *Keyring {
	return &Keyring{active: Key{Secret: []byte(secret)}, legacy: []byte(secret)}
}

// KeyringFromEnv reads JWT_SECRETS ("kid:secret,...", first = active) and the legacy JWT_SECRET.
func KeyringFromEnv(secrets, legacy string) (*Keyring, error) {
	if strings.TrimSpace(secrets) == "" {
		if legacy == "" {
			return nil, errors.New("JWT_SECRETS or JWT_SECRET is required")
		}
		return LegacyKeyring(legacy), nil
	}
	k := &Keyring{byID: map[string][]byte{}}
	if legacy != "" {
		k.legacy = []byte(legacy)
	}
	for i, entry := range strings.Split(secrets, ",") {
		id, secret, ok := strings.Cut(strings.TrimSpace(entry), ":")
		if !ok || !kidPattern.MatchString(id) {
			return nil, fmt.Errorf("JWT_SECRETS entry %d must be kid:secret with a kid of [A-Za-z0-9._-]", i+1)
		}
		if len(secret) < MinSecretBytes {
			return nil, fmt.Errorf("JWT_SECRETS key %q must be at least %d bytes", id, MinSecretBytes)
		}
		if _, dup := k.byID[id]; dup {
			return nil, fmt.Errorf("JWT_SECRETS names kid %q twice", id)
		}
		k.byID[id] = []byte(secret)
		if i == 0 {
			k.active = Key{ID: id, Secret: []byte(secret)}
		}
	}
	return k, nil
}

// ActiveID is the kid new tokens carry; empty for the legacy key.
func (k *Keyring) ActiveID() string { return k.active.ID }

// Derive is a keyring with the same kids whose secrets are HMAC(secret, label): a token minted for one purpose never
// verifies as another's (operator tokens, ADR-0057).
func (k *Keyring) Derive(label string) *Keyring {
	derive := func(secret []byte) []byte {
		if secret == nil {
			return nil
		}
		m := hmac.New(sha256.New, secret)
		m.Write([]byte(label))
		return m.Sum(nil)
	}
	d := &Keyring{active: Key{ID: k.active.ID, Secret: derive(k.active.Secret)}, legacy: derive(k.legacy)}
	if k.byID != nil {
		d.byID = make(map[string][]byte, len(k.byID))
		for id, secret := range k.byID {
			d.byID[id] = derive(secret)
		}
	}
	return d
}

func (k *Keyring) verifying(kid any) ([]byte, error) {
	if kid == nil {
		if k.legacy == nil {
			return nil, errors.New("token has no kid")
		}
		return k.legacy, nil
	}
	id, _ := kid.(string)
	if secret, ok := k.byID[id]; ok {
		return secret, nil
	}
	return nil, errors.New("unknown kid")
}
