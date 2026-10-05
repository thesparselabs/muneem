package devicesync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync/verify"
)

func invalidState(format string, a ...any) error {
	return &verify.Failure{Code: CodeInvalidState, Detail: fmt.Sprintf(format, a...)}
}

// yearClose stores a close whole, version by version (ADR-0045). The first close of a year wins; a second from another
// device is refused, as is a close before every month is locked and an adjustment made from an older version.
func (a *applier) yearClose(cur *entityRow) (*stored, error) {
	in, err := verify.DecodeFyClose(a.op.Payload)
	if err != nil {
		return nil, err
	}
	if a.op.OperationType == "create" {
		if err := a.firstClose(cur, in); err != nil {
			return nil, err
		}
		return a.stored(1, a.op.Payload, false, a.origin()), nil
	}
	if cur == nil {
		return nil, &verify.Failure{Code: CodePayloadInvalid, Detail: "an adjustment of a close the cloud does not hold"}
	}
	held, err := verify.DecodeFyClose(cur.Payload)
	if err != nil {
		return nil, err
	}
	if in.Version != cur.Version+1 {
		return nil, invalidState("%s is at version %d; this adjustment was made from version %d", in.Fy, cur.Version, in.Version-1)
	}
	if !keepsClosings(held, in) {
		return nil, invalidState("%s: an adjustment must keep every earlier closing", in.Fy)
	}
	return a.stored(in.Version, a.op.Payload, false, a.origin()), nil
}

func (a *applier) firstClose(cur *entityRow, in *verify.FyClose) error {
	if in.Version != 1 {
		return invalidState("a close starts at version 1")
	}
	other, err := closeOfYear(a.ctx, a.tx, a.businessID, in.Fy)
	if err != nil {
		return err
	}
	if cur != nil || other != "" {
		return invalidState("%s is already closed (%s)", in.Fy, other)
	}
	var open []string
	for _, month := range fyMonths(in.Fy) {
		_, locked, err := periodLocked(a.ctx, a.tx, a.businessID, month)
		if err != nil {
			return err
		}
		if !locked {
			open = append(open, month[:7])
		}
	}
	if len(open) > 0 {
		return invalidState("%s has months not locked: %s", in.Fy, strings.Join(open, ", "))
	}
	return nil
}

func keepsClosings(held, in *verify.FyClose) bool {
	if len(in.Closings) != len(held.Closings)+1 {
		return false
	}
	for i, c := range held.Closings {
		if journalID(c.Journal) != journalID(in.Closings[i].Journal) {
			return false
		}
	}
	return true
}

func journalID(j *verify.Journal) string {
	if j == nil {
		return ""
	}
	return j.ID
}

func fyMonths(fy string) []string {
	y, _ := strconv.Atoi(fy[:4])
	out := make([]string, 0, 12)
	for i := 0; i < 12; i++ {
		month, year := (i+3)%12+1, y
		if i >= 9 {
			year = y + 1
		}
		out = append(out, fmt.Sprintf("%04d-%02d-01", year, month))
	}
	return out
}

func closeOfYear(ctx context.Context, tx pgx.Tx, businessID, fy string) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `SELECT entity_id FROM entity_state WHERE business_id = $1 AND entity_type = 'fy_close' AND payload->>'fy' = $2 LIMIT 1`,
		businessID, fy).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}
