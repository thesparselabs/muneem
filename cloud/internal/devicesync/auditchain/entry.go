package auditchain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
)

// EntityType is the push-only operation that carries one audit_log row.
const EntityType = "audit_entry"

// Genesis is the prev_hash of a chain's first row.
const Genesis = "0000000000000000000000000000000000000000000000000000000000000000"

var hex64 = regexp.MustCompile(`^[0-9a-f]{64}$`)

var fields = []string{"id", "business_id", "seq", "user_id", "device_id", "terminal_id", "action", "entity_type", "entity_id",
	"before_json", "after_json", "reason", "occurred_at", "prev_hash", "hash"}

// Entry is a device's audit_log row exactly as stored there (AuditEntryPayload in packages/contracts).
type Entry struct {
	ID         string  `json:"id"`
	BusinessID string  `json:"business_id"`
	Seq        int64   `json:"seq"`
	UserID     string  `json:"user_id"`
	DeviceID   string  `json:"device_id"`
	TerminalID *string `json:"terminal_id"`
	Action     string  `json:"action"`
	EntityType string  `json:"entity_type"`
	EntityID   *string `json:"entity_id"`
	BeforeJSON *string `json:"before_json"`
	AfterJSON  *string `json:"after_json"`
	Reason     *string `json:"reason"`
	OccurredAt string  `json:"occurred_at"`
	PrevHash   string  `json:"prev_hash"`
	Hash       string  `json:"hash"`
}

// Decode accepts exactly the row's fields, every one present.
func Decode(raw json.RawMessage) (*Entry, error) {
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(raw, &keys); err != nil {
		return nil, err
	}
	if len(keys) != len(fields) {
		return nil, fmt.Errorf("an audit row has exactly %d fields, got %v", len(fields), sortedKeys(keys))
	}
	for _, f := range fields {
		if _, ok := keys[f]; !ok {
			return nil, fmt.Errorf("an audit row needs %s", f)
		}
	}
	var e Entry
	if err := json.Unmarshal(raw, &e); err != nil {
		return nil, err
	}
	if e.ID == "" || e.BusinessID == "" || e.DeviceID == "" || e.Seq < 1 || !hex64.MatchString(e.PrevHash) || !hex64.MatchString(e.Hash) {
		return nil, fmt.Errorf("an audit row needs an id, business, device, positive seq and hex hashes")
	}
	return &e, nil
}

func sortedKeys(m map[string]json.RawMessage) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ComputeHash is sha256 over the canonical JSON of the fields the device hashed (computeAuditHash in db-sqlite).
func (e *Entry) ComputeHash() (string, error) {
	before, err := embedded(e.BeforeJSON)
	if err != nil {
		return "", fmt.Errorf("before_json: %w", err)
	}
	after, err := embedded(e.AfterJSON)
	if err != nil {
		return "", fmt.Errorf("after_json: %w", err)
	}
	body, err := Canonical(map[string]any{
		"seq": e.Seq, "business_id": e.BusinessID, "device_id": e.DeviceID, "user_id": e.UserID, "action": e.Action,
		"entity_type": e.EntityType, "entity_id": optional(e.EntityID), "before": before, "after": after, "occurred_at": e.OccurredAt,
		"prev_hash": e.PrevHash,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:]), nil
}

func embedded(text *string) (any, error) {
	if text == nil {
		return nil, nil
	}
	return decode([]byte(*text))
}

func optional(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}
