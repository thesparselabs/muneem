package compliance

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/domain/gst"
	"github.com/sparselabs/muneem/cloud/internal/domain/returns"
)

const fixture = "../../../../packages/domain/fixtures/compliance/scenarios.json"

// The parts of a scenario the cloud also computes: invoice tax, credit notes and the month's set-off.
type scenario struct {
	Name     string `json:"name"`
	Expected struct {
		Invoices []struct {
			Ref    string            `json:"ref"`
			Input  gst.InvoiceInput  `json:"input"`
			Result gst.InvoiceResult `json:"result"`
		} `json:"invoices"`
		CreditNotes []struct {
			Ref    string         `json:"ref"`
			Input  returns.Input  `json:"input"`
			Result returns.Result `json:"result"`
		} `json:"creditNotes"`
		Setoff *struct {
			Liability gst.Heads        `json:"liability"`
			Credit    gst.Heads        `json:"credit"`
			Result    gst.SetoffResult `json:"result"`
		} `json:"setoff"`
	} `json:"expected"`
}

func load(t *testing.T) []scenario {
	t.Helper()
	b, err := os.ReadFile(fixture)
	if err != nil {
		t.Fatal(err)
	}
	var fx struct {
		Scenarios []scenario `json:"scenarios"`
	}
	if err := json.Unmarshal(b, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.Scenarios) < 12 {
		t.Fatalf("expected the full scenario suite, got %d", len(fx.Scenarios))
	}
	return fx.Scenarios
}

func TestScenarios(t *testing.T) {
	invoices, notes, setoffs := 0, 0, 0
	for _, s := range load(t) {
		if !strings.HasPrefix(s.Name, "HAND") {
			t.Errorf("%s: every scenario is hand-checked", s.Name)
		}
		for _, inv := range s.Expected.Invoices {
			invoices++
			in := inv.Input
			got, err := gst.ComputeInvoice(&in)
			if err != nil || !reflect.DeepEqual(*got, inv.Result) {
				g, _ := json.Marshal(got)
				w, _ := json.Marshal(inv.Result)
				t.Errorf("%s %s (%v):\n got  %s\n want %s", s.Name, inv.Ref, err, g, w)
			}
		}
		for _, cn := range s.Expected.CreditNotes {
			notes++
			got, err := returns.Compute(cn.Input)
			if err != nil || !reflect.DeepEqual(*got, cn.Result) {
				t.Errorf("%s %s (%v): got %+v, want %+v", s.Name, cn.Ref, err, got, cn.Result)
			}
		}
		if so := s.Expected.Setoff; so != nil {
			setoffs++
			got, err := gst.ComputeSetoff(so.Liability, so.Credit)
			if err != nil || got != so.Result {
				t.Errorf("%s set-off (%v): got %+v, want %+v", s.Name, err, got, so.Result)
			}
		}
	}
	if invoices < 30 || notes < 4 || setoffs < 2 {
		t.Fatalf("suite too small: %d invoices, %d credit notes, %d set-offs", invoices, notes, setoffs)
	}
	t.Logf("%d invoices, %d credit notes, %d set-offs agree with TypeScript", invoices, notes, setoffs)
}
