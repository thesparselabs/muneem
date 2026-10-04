package parties

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/domain/money"
)

const fixture = "../../../../packages/domain/fixtures/parties/allocation.json"

func TestAllocationGoldenVectors(t *testing.T) {
	b, err := os.ReadFile(fixture)
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Cases []struct {
			Name        string            `json:"name"`
			Items       []OpenItem        `json:"items"`
			AmountPaise int64             `json:"amountPaise"`
			Expected    *AllocationResult `json:"expected"`
			Error       string            `json:"error"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(b, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.Cases) < 40 {
		t.Fatalf("expected many cases, got %d", len(fx.Cases))
	}
	for _, c := range fx.Cases {
		got, err := AllocateOldestFirst(c.Items, c.AmountPaise)
		if c.Error != "" {
			var de *money.DomainError
			if !errors.As(err, &de) || de.Code != c.Error {
				t.Errorf("%s: want %s, got %v", c.Name, c.Error, err)
			}
			continue
		}
		if err != nil || !reflect.DeepEqual(got, c.Expected) {
			t.Errorf("%s: got %+v (%v), want %+v", c.Name, got, err, c.Expected)
		}
	}
}
