package gst

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/domain/money"
)

const setoffFixture = "../../../../packages/domain/fixtures/setoff/setoff-golden.json"

func TestSetoffGoldenVectors(t *testing.T) {
	b, err := os.ReadFile(setoffFixture)
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Cases []struct {
			Name      string        `json:"name"`
			Liability Heads         `json:"liability"`
			Credit    Heads         `json:"credit"`
			Expected  *SetoffResult `json:"expected"`
			Error     string        `json:"error"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(b, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.Cases) < 40 {
		t.Fatalf("expected many cases, got %d", len(fx.Cases))
	}
	for _, c := range fx.Cases {
		got, err := ComputeSetoff(c.Liability, c.Credit)
		if c.Error != "" {
			var de *money.DomainError
			if !errors.As(err, &de) || de.Code != c.Error {
				t.Errorf("%s: want %s, got %v", c.Name, c.Error, err)
			}
			continue
		}
		if err != nil || got != *c.Expected {
			t.Errorf("%s: got %+v (%v), want %+v", c.Name, got, err, *c.Expected)
		}
	}
}
