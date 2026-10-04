package backups

import (
	"bytes"
	"testing"
)

const master = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="

func TestWrappedKeysOpenOnlyUnderTheirBusinessAndKeyID(t *testing.T) {
	w, err := NewWrapper(master)
	if err != nil {
		t.Fatal(err)
	}
	key := bytes.Repeat([]byte{7}, DataKeyBytes)
	nonce, sealed, err := w.Wrap("biz-1", "00aa", key)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, key) {
		t.Fatal("the wrapped key must not contain the key")
	}
	if got, err := w.Unwrap("biz-1", "00aa", nonce, sealed); err != nil || !bytes.Equal(got, key) {
		t.Fatalf("round trip: %v", err)
	}
	if _, err := w.Unwrap("biz-2", "00aa", nonce, sealed); err == nil {
		t.Fatal("a key moved to another business must not open")
	}
	if _, err := w.Unwrap("biz-1", "00bb", nonce, sealed); err == nil {
		t.Fatal("a key moved to another key id must not open")
	}
	other, _ := NewWrapper("HyAeHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgE=")
	if _, err := other.Unwrap("biz-1", "00aa", nonce, sealed); err == nil {
		t.Fatal("another master key must not open it")
	}
}

func TestTheMasterKeyMustBe32Bytes(t *testing.T) {
	for _, bad := range []string{"", "not base64!", "AAECAwQFBgcICQoLDA0ODw=="} {
		if _, err := NewWrapper(bad); err == nil {
			t.Fatalf("%q should be refused", bad)
		}
	}
}
