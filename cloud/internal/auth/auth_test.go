package auth

import (
	"strings"
	"testing"
)

func TestArgon2idPHCRoundTrip(t *testing.T) {
	h, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$m=65536,t=3,p=4$") {
		t.Fatalf("unexpected PHC prefix: %s", h)
	}
	ok, err := VerifyPassword(h, "correct horse battery staple")
	if err != nil || !ok {
		t.Fatalf("verify failed: %v %v", ok, err)
	}
	ok, _ = VerifyPassword(h, "wrong")
	if ok {
		t.Fatal("wrong password verified")
	}
	if _, err := VerifyPassword("$bcrypt$x", "x"); err == nil {
		t.Fatal("expected unsupported format error")
	}
}

func TestRolePresetsMirrorContracts(t *testing.T) {
	owner := RolePreset("owner")
	if len(owner) != len(resources)*len(actions) {
		t.Fatalf("owner should have every resource×action grant, got %d", len(owner))
	}
	cashier := RolePreset("cashier")
	var found bool
	for _, g := range cashier {
		if g.Permission == "accounting.view" {
			t.Fatal("cashier must not see accounting")
		}
		if g.Permission == "sales.create" && g.Limit != nil && g.Limit.MaxDiscountBp != nil && *g.Limit.MaxDiscountBp == 500 {
			found = true
		}
	}
	if !found {
		t.Fatal("cashier sales.create must carry maxDiscountBp=500")
	}
	if len(GrantsFor([]string{"unknown"})) != 0 {
		t.Fatal("unknown role must yield no grants")
	}
}

func TestJWTRoundTrip(t *testing.T) {
	s := NewSigner("test-secret")
	c := Claims{Org: "o", Device: "d", PermVer: 3}
	c.Subject = "u"
	tok, err := s.Issue(c)
	if err != nil {
		t.Fatal(err)
	}
	got, err := s.Parse(tok)
	if err != nil || got.Subject != "u" || got.Device != "d" || got.PermVer != 3 {
		t.Fatalf("parse: %+v %v", got, err)
	}
	if _, err := NewSigner("other").Parse(tok); err == nil {
		t.Fatal("token verified with wrong secret")
	}
}
