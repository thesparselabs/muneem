// Package verify recomputes what the cloud can check exactly in a pushed document (Stage 7b): GST and totals with the
// Go GST port, journal balance, and journal amounts against the document's. Posting rules and costing are not rebuilt.
package verify

import "fmt"

const (
	TotalMismatch    = "TOTAL_MISMATCH"
	JournalImbalance = "JOURNAL_IMBALANCE"
	JournalMismatch  = "JOURNAL_MISMATCH"
	PayloadInvalid   = "PAYLOAD_INVALID"
)

// Failure is a permanent rejection: the operation goes to dead-letter as sent.
type Failure struct {
	Code   string
	Detail string
}

func (f *Failure) Error() string { return f.Code + ": " + f.Detail }

func fail(code, format string, a ...any) *Failure {
	return &Failure{Code: code, Detail: fmt.Sprintf(format, a...)}
}

func expectEq(code, what string, got, want int64) error {
	if got != want {
		return fail(code, "%s: %d, expected %d", what, got, want)
	}
	return nil
}

func firstErr(errs ...error) error {
	for _, e := range errs {
		if e != nil {
			return e
		}
	}
	return nil
}
