// Package backups stores devices' encrypted backups in object storage and escrows their data keys (Stage 8f, ADR-0047).
package backups

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

const DataKeyBytes = 32

// Wrapper seals data keys under the server master key (MUNEEM_BACKUP_MASTER_KEY); a KMS can stand behind the same shape.
type Wrapper struct{ aead cipher.AEAD }

// NewWrapper takes the master key as base64 of 32 bytes.
func NewWrapper(masterKeyB64 string) (*Wrapper, error) {
	key, err := base64.StdEncoding.DecodeString(masterKeyB64)
	if err != nil || len(key) != 32 {
		return nil, errors.New("MUNEEM_BACKUP_MASTER_KEY must be base64 of 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Wrapper{aead: aead}, nil
}

// aad binds a wrapped key to its row, so a key copied under another business or key id does not open.
func aad(businessID, keyID string) []byte {
	return []byte("muneem-backup-key\x00" + businessID + "\x00" + keyID)
}

func (w *Wrapper) Wrap(businessID, keyID string, key []byte) (nonce, sealed []byte, err error) {
	nonce = make([]byte, w.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	return nonce, w.aead.Seal(nil, nonce, key, aad(businessID, keyID)), nil
}

func (w *Wrapper) Unwrap(businessID, keyID string, nonce, sealed []byte) ([]byte, error) {
	key, err := w.aead.Open(nil, nonce, sealed, aad(businessID, keyID))
	if err != nil {
		return nil, fmt.Errorf("unwrap backup key %s: %w", keyID, err)
	}
	return key, nil
}
