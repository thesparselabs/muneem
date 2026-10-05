package httpx

import "testing"

func TestProtocolsDefaultToNAndNMinusOne(t *testing.T) {
	p := DefaultProtocols()
	if p.Current != SyncProtocol || p.Min != max(1, SyncProtocol-1) {
		t.Fatalf("defaults: %+v", p)
	}
	if !(Protocols{}).Accepts(SyncProtocol) || (Protocols{}).Accepts(0) || (Protocols{}).Accepts(SyncProtocol+1) {
		t.Fatal("the zero value must mean the defaults")
	}
	next := Protocols{Min: 1, Current: 2}
	for v, want := range map[int]bool{0: false, 1: true, 2: true, 3: false} {
		if next.Accepts(v) != want {
			t.Fatalf("N=2/min=1 accepts %d: want %v", v, want)
		}
	}
}

func TestProtocolsFromEnv(t *testing.T) {
	env := func(v string) func(string) string { return func(string) string { return v } }
	if p, err := ProtocolsFromEnv(env("")); err != nil || p != DefaultProtocols() {
		t.Fatalf("unset: %+v %v", p, err)
	}
	if p, err := ProtocolsFromEnv(env(" 1 ")); err != nil || p.Min != 1 {
		t.Fatalf("1: %+v %v", p, err)
	}
	for _, bad := range []string{"0", "x", "99"} {
		if _, err := ProtocolsFromEnv(env(bad)); err == nil {
			t.Fatalf("%q should be refused", bad)
		}
	}
}
