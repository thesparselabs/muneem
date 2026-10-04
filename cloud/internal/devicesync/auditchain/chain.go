package auditchain

import "fmt"

type Verdict int

const (
	Append Verdict = iota
	Duplicate
	Gap
	Broken
)

// Tip is what the cloud holds of one device's chain: the hash at the incoming seq (if any) and its last row.
type Tip struct {
	HeldHash *string
	LastSeq  int64
	LastHash string
}

// Check places a row on its chain: its own hash first, then a seq already held, the next seq linked to the last hash,
// or a gap the earlier rows have yet to fill. Mirrors AuditLedger.check in packages/sync-reference.
func Check(e *Entry, t Tip) (Verdict, string, error) {
	h, err := e.ComputeHash()
	if err != nil {
		return 0, "", err
	}
	if h != e.Hash {
		return Broken, fmt.Sprintf("seq %d: the hash does not match the row", e.Seq), nil
	}
	if t.HeldHash != nil {
		if *t.HeldHash == e.Hash {
			return Duplicate, "", nil
		}
		return Broken, fmt.Sprintf("seq %d already holds another row", e.Seq), nil
	}
	if e.Seq > t.LastSeq+1 {
		return Gap, fmt.Sprintf("waiting for audit seq %d", t.LastSeq+1), nil
	}
	previous := t.LastHash
	if t.LastSeq == 0 {
		previous = Genesis
	}
	if e.PrevHash != previous {
		return Broken, fmt.Sprintf("seq %d: prev_hash does not link to seq %d", e.Seq, e.Seq-1), nil
	}
	return Append, "", nil
}
