package auth

import (
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

var (
	oldSecret = strings.Repeat("o", MinSecretBytes)
	newSecret = strings.Repeat("n", MinSecretBytes)
)

func signer(t *testing.T, secrets, legacy string) *Signer {
	t.Helper()
	k, err := KeyringFromEnv(secrets, legacy)
	if err != nil {
		t.Fatal(err)
	}
	return NewKeyringSigner(k)
}

func issue(t *testing.T, s *Signer) string {
	t.Helper()
	c := Claims{}
	c.Subject = "u"
	tok, err := s.Issue(c)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func kidOf(t *testing.T, tok string) any {
	t.Helper()
	parsed, _, err := jwt.NewParser().ParseUnverified(tok, &Claims{})
	if err != nil {
		t.Fatal(err)
	}
	return parsed.Header["kid"]
}

func TestTokensCarryTheActiveKid(t *testing.T) {
	s := signer(t, "k2:"+newSecret+",k1:"+oldSecret, "")
	if kid := kidOf(t, issue(t, s)); kid != "k2" {
		t.Fatalf("kid = %v", kid)
	}
	if kid := kidOf(t, issue(t, NewSigner("legacy"))); kid != nil {
		t.Fatalf("a legacy token carries kid %v", kid)
	}
}

func TestRotationVerifiesOldTokensUntilTheirKeyIsRemoved(t *testing.T) {
	before := signer(t, "k1:"+oldSecret, "")
	old := issue(t, before)
	during := signer(t, "k2:"+newSecret+",k1:"+oldSecret, "")
	if _, err := during.Parse(old); err != nil {
		t.Fatalf("a k1 token must verify while k1 is in the ring: %v", err)
	}
	fresh := issue(t, during)
	if _, err := before.Parse(fresh); err == nil {
		t.Fatal("a k2 token must not verify where k2 is unknown")
	}
	after := signer(t, "k2:"+newSecret, "")
	if _, err := after.Parse(fresh); err != nil {
		t.Fatal(err)
	}
	if _, err := after.Parse(old); err == nil {
		t.Fatal("a k1 token must not verify once k1 is removed")
	}
}

func TestMovingFromTheLegacySecretKeepsKidlessTokensValid(t *testing.T) {
	legacyToken := issue(t, NewSigner("dev-secret"))
	s := signer(t, "k1:"+newSecret, "dev-secret")
	if _, err := s.Parse(legacyToken); err != nil {
		t.Fatalf("a kid-less token must verify under JWT_SECRET during the overlap: %v", err)
	}
	if _, err := s.Parse(issue(t, s)); err != nil {
		t.Fatal(err)
	}
	if _, err := signer(t, "k1:"+newSecret, "").Parse(legacyToken); err == nil {
		t.Fatal("a kid-less token must not verify once JWT_SECRET is removed")
	}
}

func TestAKidCannotBeVerifiedWithAnotherKeysSecret(t *testing.T) {
	forged := issue(t, signer(t, "k1:"+newSecret, ""))
	if _, err := signer(t, "k1:"+oldSecret, newSecret).Parse(forged); err == nil {
		t.Fatal("a token's kid picks its key; the legacy secret must not stand in")
	}
}

func TestADerivedRingNeitherAcceptsNorMintsTheBaseRingsTokens(t *testing.T) {
	for _, ring := range []struct{ secrets, legacy string }{{"k2:" + newSecret + ",k1:" + oldSecret, ""}, {"", "dev-secret"}} {
		base, err := KeyringFromEnv(ring.secrets, ring.legacy)
		if err != nil {
			t.Fatal(err)
		}
		shop, op := NewKeyringSigner(base), NewKeyringSigner(base.Derive("operator"))
		if _, err := op.Parse(issue(t, shop)); err == nil {
			t.Fatal("a shop token must not verify under the derived ring")
		}
		if _, err := shop.Parse(issue(t, op)); err == nil {
			t.Fatal("a derived token must not verify under the base ring")
		}
		if _, err := op.Parse(issue(t, op)); err != nil {
			t.Fatal(err)
		}
	}
}

func TestKeyringFromEnvRefusesBadRings(t *testing.T) {
	for _, bad := range []struct{ secrets, legacy string }{
		{"", ""},
		{"k1", ""},
		{"k1:short", ""},
		{"bad kid:" + newSecret, ""},
		{"k1:" + newSecret + ",k1:" + oldSecret, ""},
	} {
		if _, err := KeyringFromEnv(bad.secrets, bad.legacy); err == nil {
			t.Fatalf("%q should be refused", bad.secrets)
		}
	}
}
