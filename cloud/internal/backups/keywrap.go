// Package backups stores devices' encrypted backups in object storage and escrows their data keys (Stage 8f, ADR-0047).
package backups

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const DataKeyBytes = 32

// LegacyVersion names the single MUNEEM_BACKUP_MASTER_KEY and every key wrapped before keyrings (ADR-0052).
const LegacyVersion = "v1"

// Wrapper seals data keys under a versioned ring of master keys: the active one wraps, each unwraps what it wrapped.
type Wrapper struct {
	active string
	keys   map[string]masterKey
}

type masterKey struct {
	raw  []byte
	aead cipher.AEAD
}

var versionPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,32}$`)

// NewWrapper takes one master key, base64 of 32 bytes, as version v1.
func NewWrapper(masterKeyB64 string) (*Wrapper, error) {
	return MasterKeysFromEnv("", masterKeyB64)
}

// MasterKeysFromEnv reads MUNEEM_BACKUP_MASTER_KEYS ("v2:base64,v1:base64", first = active) and the legacy
// MUNEEM_BACKUP_MASTER_KEY, which joins the ring as v1.
func MasterKeysFromEnv(keys, legacy string) (*Wrapper, error) {
	w := &Wrapper{keys: map[string]masterKey{}}
	if strings.TrimSpace(keys) != "" {
		for i, entry := range strings.Split(keys, ",") {
			if err := w.addEntry(i, entry); err != nil {
				return nil, err
			}
		}
	}
	if legacy != "" {
		if err := w.addLegacy(legacy); err != nil {
			return nil, err
		}
	}
	if w.active == "" {
		return nil, errors.New("MUNEEM_BACKUP_MASTER_KEYS or MUNEEM_BACKUP_MASTER_KEY is required")
	}
	return w, nil
}

func (w *Wrapper) addEntry(i int, entry string) error {
	version, key, ok := strings.Cut(strings.TrimSpace(entry), ":")
	if !ok || !versionPattern.MatchString(version) {
		return fmt.Errorf("MUNEEM_BACKUP_MASTER_KEYS entry %d must be version:base64", i+1)
	}
	if _, dup := w.keys[version]; dup {
		return fmt.Errorf("MUNEEM_BACKUP_MASTER_KEYS names %s twice", version)
	}
	mk, err := newMasterKey(key)
	if err != nil {
		return fmt.Errorf("master key %s: %w", version, err)
	}
	w.keys[version] = mk
	if i == 0 {
		w.active = version
	}
	return nil
}

func (w *Wrapper) addLegacy(legacy string) error {
	mk, err := newMasterKey(legacy)
	if err != nil {
		return fmt.Errorf("MUNEEM_BACKUP_MASTER_KEY: %w", err)
	}
	if existing, ok := w.keys[LegacyVersion]; ok {
		if subtle.ConstantTimeCompare(existing.raw, mk.raw) != 1 {
			return errors.New("MUNEEM_BACKUP_MASTER_KEY differs from v1 in MUNEEM_BACKUP_MASTER_KEYS")
		}
		return nil
	}
	w.keys[LegacyVersion] = mk
	if w.active == "" {
		w.active = LegacyVersion
	}
	return nil
}

func newMasterKey(keyB64 string) (masterKey, error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(keyB64))
	if err != nil || len(raw) != 32 {
		return masterKey{}, errors.New("a backup master key must be base64 of 32 bytes")
	}
	block, err := aes.NewCipher(raw)
	if err != nil {
		return masterKey{}, err
	}
	aead, err := cipher.NewGCM(block)
	return masterKey{raw: raw, aead: aead}, err
}

// Active is the version new keys are wrapped under.
func (w *Wrapper) Active() string { return w.active }

// aad binds a wrapped key to its row, so a key copied under another business or key id does not open.
func aad(businessID, keyID string) []byte {
	return []byte("muneem-backup-key\x00" + businessID + "\x00" + keyID)
}

func (w *Wrapper) Wrap(businessID, keyID string, key []byte) (version string, nonce, sealed []byte, err error) {
	aead := w.keys[w.active].aead
	nonce = make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", nil, nil, err
	}
	return w.active, nonce, aead.Seal(nil, nonce, key, aad(businessID, keyID)), nil
}

func (w *Wrapper) Unwrap(version, businessID, keyID string, nonce, sealed []byte) ([]byte, error) {
	mk, ok := w.keys[version]
	if !ok {
		return nil, fmt.Errorf("unwrap backup key %s: master key %s is not in the keyring", keyID, version)
	}
	key, err := mk.aead.Open(nil, nonce, sealed, aad(businessID, keyID))
	if err != nil {
		return nil, fmt.Errorf("unwrap backup key %s: %w", keyID, err)
	}
	return key, nil
}
