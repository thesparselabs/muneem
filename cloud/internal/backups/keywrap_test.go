package backups

import (
	"bytes"
	"testing"
)

const master = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
const otherMaster = "HyAeHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgE="

func TestWrappedKeysOpenOnlyUnderTheirBusinessAndKeyID(t *testing.T) {
	w, err := NewWrapper(master)
	if err != nil {
		t.Fatal(err)
	}
	key := bytes.Repeat([]byte{7}, DataKeyBytes)
	version, nonce, sealed, err := w.Wrap("biz-1", "00aa", key)
	if err != nil {
		t.Fatal(err)
	}
	if version != LegacyVersion {
		t.Fatalf("the single master key is %s, got %s", LegacyVersion, version)
	}
	if bytes.Contains(sealed, key) {
		t.Fatal("the wrapped key must not contain the key")
	}
	if got, err := w.Unwrap(version, "biz-1", "00aa", nonce, sealed); err != nil || !bytes.Equal(got, key) {
		t.Fatalf("round trip: %v", err)
	}
	if _, err := w.Unwrap(version, "biz-2", "00aa", nonce, sealed); err == nil {
		t.Fatal("a key moved to another business must not open")
	}
	if _, err := w.Unwrap(version, "biz-1", "00bb", nonce, sealed); err == nil {
		t.Fatal("a key moved to another key id must not open")
	}
	other, _ := NewWrapper(otherMaster)
	if _, err := other.Unwrap(version, "biz-1", "00aa", nonce, sealed); err == nil {
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

func TestTheFirstKeyInTheRingWrapsAndEveryVersionUnwrapsItsOwn(t *testing.T) {
	old, _ := NewWrapper(master)
	_, n1, s1, _ := old.Wrap("biz", "k1", bytes.Repeat([]byte{1}, DataKeyBytes))
	ring, err := MasterKeysFromEnv("v2:"+otherMaster, master)
	if err != nil {
		t.Fatal(err)
	}
	if ring.Active() != "v2" {
		t.Fatalf("active = %s", ring.Active())
	}
	if _, err := ring.Unwrap("v1", "biz", "k1", n1, s1); err != nil {
		t.Fatalf("the legacy key joins the ring as v1: %v", err)
	}
	version, n2, s2, _ := ring.Wrap("biz", "k2", bytes.Repeat([]byte{2}, DataKeyBytes))
	if version != "v2" {
		t.Fatalf("wrapped under %s", version)
	}
	if _, err := ring.Unwrap("v1", "biz", "k2", n2, s2); err == nil {
		t.Fatal("a v2 key must not open as v1")
	}
	if _, err := old.Unwrap("v2", "biz", "k2", n2, s2); err == nil {
		t.Fatal("a ring without v2 must refuse a v2 key")
	}
}

func TestMasterKeyRingsAreValidated(t *testing.T) {
	for _, bad := range []struct{ keys, legacy string }{
		{"", ""},
		{"v2", ""},
		{"v2:short", ""},
		{"bad version:" + master, ""},
		{"v2:" + master + ",v2:" + otherMaster, ""},
		{"v2:" + otherMaster + ",v1:" + otherMaster, master},
	} {
		if _, err := MasterKeysFromEnv(bad.keys, bad.legacy); err == nil {
			t.Fatalf("%+v should be refused", bad)
		}
	}
	if w, err := MasterKeysFromEnv("v2:"+otherMaster+",v1:"+master, master); err != nil || w.Active() != "v2" {
		t.Fatalf("the legacy key may repeat v1: %v", err)
	}
}
