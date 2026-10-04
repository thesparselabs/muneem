// Package conflict resolves a master or config write against the cloud's current version (ADR-0041, LLD §9).
package conflict

import (
	"encoding/json"
	"reflect"
	"slices"
	"sort"
)

type Payload = map[string]any

// Current is the cloud's stored version of an entity.
type Current struct {
	Version int
	Payload Payload
	Deleted bool
	Writer  string
}

// Incoming is a device's write. Baseline is the stored payload of the version the device edited, nil when unknown.
type Incoming struct {
	EntityType string
	Tombstone  bool
	Payload    Payload
	Device     string
	Baseline   Payload
}

type Field struct {
	Field  string `json:"field"`
	Rule   string `json:"rule"`
	Winner string `json:"winner"`
	Cloud  any    `json:"cloud"`
	Device any    `json:"device"`
}

// Outcome is what the cloud stores. Ignored means the write changed nothing because a tombstone already won.
type Outcome struct {
	Payload   Payload
	Version   int
	Delete    bool
	Ignored   bool
	Fields    []Field
	Tombstone bool
}

const (
	RuleCloudWins          = "cloud_wins"
	RuleLastWriterWins     = "last_writer_wins"
	RuleTombstoneWins      = "tombstone_wins"
	winnerCloud            = "cloud"
	winnerDevice           = "device"
	versionKey             = "version"
	updatedAtCamel         = "updatedAt"
	updatedAtSnake         = "updated_at"
	erasedAtKey            = "erasedAt"
	unversioned        int = -1
)

// Resolve applies the matrix: a tombstone wins; a write based on the current version (or on none) replaces it;
// a write based on an older version is merged field by field against the version it was based on.
func Resolve(cur *Current, in Incoming) Outcome {
	if cur == nil {
		return replace(0, in)
	}
	if cur.Deleted {
		return Outcome{Payload: cur.Payload, Version: cur.Version, Delete: true, Ignored: true, Tombstone: !in.Tombstone}
	}
	if in.Tombstone {
		return replace(cur.Version, in)
	}
	if stalePrices(cur, in) {
		return keepPrices(cur, in)
	}
	if erasureWins(cur, in) {
		return keepErased(cur, in)
	}
	base := baseVersion(in.Payload)
	if base == unversioned || cur.Version <= base {
		return replace(cur.Version, in)
	}
	return merge(cur, in)
}

// A product's prices are replaced whole, naming the items replaced; replacing items the cloud no longer has is stale.
func stalePrices(cur *Current, in Incoming) bool {
	return in.EntityType == "price_list_item" && !sameIDs(itemIDs(cur.Payload["items"]), itemIDs(in.Payload["retired"]))
}

func keepPrices(cur *Current, in Incoming) Outcome {
	version := cur.Version + 1
	f := Field{Field: "items", Rule: RuleCloudWins, Winner: winnerCloud, Cloud: cur.Payload["items"], Device: in.Payload["items"]}
	return Outcome{Payload: stamp(clone(cur.Payload), version), Version: version, Fields: []Field{f}}
}

// An erased customer stays erased (ADR-0050): a write that does not carry the erasure changes nothing of the profile.
func erasureWins(cur *Current, in Incoming) bool {
	erased, _ := cur.Payload[erasedAtKey].(string)
	sent, _ := in.Payload[erasedAtKey].(string)
	return in.EntityType == "customer" && erased != "" && sent == ""
}

func keepErased(cur *Current, in Incoming) Outcome {
	version := cur.Version + 1
	f := Field{Field: erasedAtKey, Rule: RuleCloudWins, Winner: winnerCloud, Cloud: cur.Payload[erasedAtKey], Device: in.Payload[erasedAtKey]}
	return Outcome{Payload: stamp(clone(cur.Payload), version), Version: version, Fields: []Field{f}}
}

func itemIDs(v any) []string {
	list, _ := v.([]any)
	ids := make([]string, 0, len(list))
	for _, x := range list {
		switch item := x.(type) {
		case string:
			ids = append(ids, item)
		case map[string]any:
			if id, ok := item["id"].(string); ok {
				ids = append(ids, id)
			}
		}
	}
	sort.Strings(ids)
	return ids
}

func sameIDs(a, b []string) bool { return slices.Equal(a, b) }

func baseVersion(p Payload) int {
	v, ok := p[versionKey].(float64)
	if !ok || v < 1 {
		return unversioned
	}
	return int(v) - 1
}

func replace(currentVersion int, in Incoming) Outcome {
	version := currentVersion + 1
	if sent, ok := in.Payload[versionKey].(float64); ok && int(sent) > version {
		version = int(sent)
	}
	return Outcome{Payload: stamp(clone(in.Payload), version), Version: version, Delete: in.Tombstone}
}

func merge(cur *Current, in Incoming) Outcome {
	result := clone(cur.Payload)
	var fields []Field
	deviceIsLater := deviceWinsTie(cur, in)
	for key, sent := range in.Payload {
		if key == versionKey {
			continue
		}
		base, current := in.Baseline[key], cur.Payload[key]
		if same(sent, base) {
			continue
		}
		if same(current, base) || same(sent, current) {
			result[key] = sent
			continue
		}
		f := Field{Field: key, Rule: RuleLastWriterWins, Winner: winnerCloud, Cloud: current, Device: sent}
		switch {
		case Protected(in.EntityType, key):
			f.Rule = RuleCloudWins
		case deviceIsLater:
			f.Winner = winnerDevice
			result[key] = sent
		}
		if !isUpdatedAt(key) {
			fields = append(fields, f)
		}
	}
	version := cur.Version + 1
	return Outcome{Payload: stamp(result, version), Version: version, Fields: fields}
}

// deviceWinsTie compares the writes' updatedAt; equal times go to the larger device id.
func deviceWinsTie(cur *Current, in Incoming) bool {
	sent, stored := updatedAt(in.Payload), updatedAt(cur.Payload)
	if sent == "" || stored == "" {
		return true
	}
	if sent != stored {
		return sent > stored
	}
	return in.Device > cur.Writer
}

func updatedAt(p Payload) string {
	for _, k := range []string{updatedAtCamel, updatedAtSnake} {
		if s, ok := p[k].(string); ok {
			return s
		}
	}
	return ""
}

func isUpdatedAt(key string) bool { return key == updatedAtCamel || key == updatedAtSnake }

func stamp(p Payload, version int) Payload {
	if _, ok := p[versionKey]; ok {
		p[versionKey] = float64(version)
	}
	return p
}

func clone(p Payload) Payload {
	out := make(Payload, len(p))
	for k, v := range p {
		out[k] = v
	}
	return out
}

func same(a, b any) bool { return reflect.DeepEqual(a, b) }

// Differs reports whether what the cloud stores is not what the device sent, so the sender must apply it too.
func Differs(stored, sent Payload) bool { return !same(stored, sent) }

// Decode reads a payload so values compare by meaning, not by formatting.
func Decode(raw []byte) (Payload, error) {
	var p Payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	if p == nil {
		p = Payload{}
	}
	return p, nil
}
