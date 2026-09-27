package gst

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

const fixtureDir = "../../../../packages/domain/fixtures/gst/"

// The cross-language contract: every case in packages/domain/fixtures/gst must match byte-for-byte.
func TestGoldenVectors(t *testing.T) {
	files, err := filepath.Glob(fixtureDir + "*.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no fixture files found: %v", err)
	}
	total := 0
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		var fx FixtureFile
		if err := json.Unmarshal(b, &fx); err != nil {
			t.Fatal(err)
		}
		for _, c := range fx.Cases {
			total++
			got, err := ComputeInvoice(&c.Input)
			if err != nil {
				t.Errorf("%s: %v", c.Name, err)
				continue
			}
			if !reflect.DeepEqual(*got, c.Expected) {
				g, _ := json.Marshal(got)
				w, _ := json.Marshal(c.Expected)
				t.Errorf("%s:\n got  %s\n want %s", c.Name, g, w)
			}
		}
	}
	if total < 50 {
		t.Fatalf("expected many fixture cases, got %d", total)
	}
	t.Logf("%d golden cases passed", total)
}

func TestValidation(t *testing.T) {
	_, err := ComputeInvoice(&InvoiceInput{SupplierStateCode: "7", PlaceOfSupplyStateCode: "07", TaxScheme: "regular"})
	if err == nil {
		t.Fatal("expected INVALID_INPUT")
	}
	in := &InvoiceInput{DocType: "tax_invoice", SupplierStateCode: "07", PlaceOfSupplyStateCode: "07", TaxScheme: "regular",
		BillDiscount: Discount{Kind: "amount", Value: 20000}, B2clThresholdPaise: 1,
		Lines: []LineInput{{QtyMilli: 1000, UnitPricePaise: 10000, LineDiscount: Discount{Kind: "amount"}, GstRateBp: 1800, TaxTreatment: "taxable"}}}
	if _, err := ComputeInvoice(in); err == nil || err.Error()[:22] != "DISCOUNT_EXCEEDS_VALUE" {
		t.Fatalf("expected DISCOUNT_EXCEEDS_VALUE, got %v", err)
	}
}
