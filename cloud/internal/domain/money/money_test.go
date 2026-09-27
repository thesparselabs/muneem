package money

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

const fixtures = "../../../../packages/domain/fixtures/money/"

func TestDivRoundFixtures(t *testing.T) {
	var fx struct {
		Cases []struct{ N, D, Expected int64 }
	}
	b, err := os.ReadFile(fixtures + "divround.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.Cases) == 0 {
		t.Fatal("no cases")
	}
	for _, c := range fx.Cases {
		got, err := DivRound(c.N, c.D)
		if err != nil {
			t.Errorf("%d/%d: %v", c.N, c.D, err)
			continue
		}
		if got != c.Expected {
			t.Errorf("%d/%d: got %d want %d", c.N, c.D, got, c.Expected)
		}
	}
}

func TestDivRoundBounds(t *testing.T) {
	if _, err := DivRound(1, 0); err == nil || err.(*DomainError).Code != "DIVIDE_BY_ZERO" {
		t.Error("expected DIVIDE_BY_ZERO")
	}
	if _, err := DivRound(1<<53, 1); err == nil || err.(*DomainError).Code != "OVERFLOW" {
		t.Error("expected OVERFLOW on 2^53")
	}
	if _, err := DivRound(9007199254740000, 3); err == nil || err.(*DomainError).Code != "OVERFLOW" {
		t.Error("expected OVERFLOW on 2n+d > 2^53-1 (same bound as TS)")
	}
	if got, _ := DivRound(-4, 10); got != 0 {
		t.Errorf("got %d", got)
	}
}

func TestApportionFixtures(t *testing.T) {
	var fx struct {
		Cases []struct {
			Total    int64
			Weights  []int64
			Expected []int64
		}
	}
	b, err := os.ReadFile(fixtures + "apportion.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &fx); err != nil {
		t.Fatal(err)
	}
	for _, c := range fx.Cases {
		got, err := Apportion(c.Total, c.Weights)
		if err != nil {
			t.Errorf("%v: %v", c, err)
			continue
		}
		if !reflect.DeepEqual(got, c.Expected) {
			t.Errorf("apportion(%d,%v): got %v want %v", c.Total, c.Weights, got, c.Expected)
		}
	}
	if _, err := Apportion(5, []int64{0, 0}); err == nil {
		t.Error("expected error for non-zero total over zero weights")
	}
	// BigInt path: 500 weights ~1e9, total 1e9
	w := make([]int64, 500)
	for i := range w {
		w[i] = 1_000_000_000 + int64(i)
	}
	parts, err := Apportion(1_000_000_000, w)
	if err != nil {
		t.Fatal(err)
	}
	var s int64
	for _, p := range parts {
		s += p
	}
	if s != 1_000_000_000 {
		t.Errorf("sum %d", s)
	}
}

func TestPctOf(t *testing.T) {
	if v, _ := PctOf(10_000, 1800); v != 1800 {
		t.Error(v)
	}
	if v, _ := PctOf(10_000_000, 25); v != 25_000 {
		t.Error(v)
	}
	if v, _ := PctOf(3, 5000); v != 2 {
		t.Error(v)
	}
}
