// verify-fixture: reads a GstFixtureFile-shaped JSON on stdin, runs the Go GST engine on every
// case's input, and writes {"results":[...]} in the same order. Used by scripts/diff-fuzz.ts to
// prove the Go port matches the TypeScript engine on random invoices.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/sparselabs/muneem/cloud/internal/domain/gst"
	"github.com/sparselabs/muneem/cloud/internal/domain/money"
)

func main() {
	in, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	var fx struct {
		Cases []struct {
			Name  string           `json:"name"`
			Input gst.InvoiceInput `json:"input"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(in, &fx); err != nil {
		fmt.Fprintln(os.Stderr, "bad input:", err)
		os.Exit(2)
	}
	results := make([]any, len(fx.Cases))
	for i, c := range fx.Cases {
		r, err := gst.ComputeInvoice(&c.Input)
		if err != nil {
			var de *money.DomainError
			code := "INTERNAL"
			if errors.As(err, &de) {
				code = de.Code
			}
			results[i] = map[string]any{"error": map[string]string{"code": code, "message": err.Error()}}
			continue
		}
		results[i] = r
	}
	enc := json.NewEncoder(os.Stdout)
	if err := enc.Encode(map[string]any{"results": results}); err != nil {
		os.Exit(2)
	}
}
