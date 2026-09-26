package device

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
)

func TestSigningStringAndVerify(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	body := []byte(`{"a":1}`)
	msg := SigningString("POST", "/v1/businesses", "1700000000", body)
	sig := ed25519.Sign(priv, msg)
	if !ed25519.Verify(pub, msg, sig) {
		t.Fatal("signature should verify")
	}
	if ed25519.Verify(pub, SigningString("POST", "/v1/businesses", "1700000001", body), sig) {
		t.Fatal("timestamp change must break the signature")
	}
	if ed25519.Verify(pub, SigningString("POST", "/v1/businesses", "1700000000", []byte(`{"a":2}`)), sig) {
		t.Fatal("body change must break the signature")
	}
}
