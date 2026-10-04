package devicesync_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

type fixture struct {
	Name  string `json:"name"`
	Setup struct {
		OrganizationID string   `json:"organizationId"`
		UserID         string   `json:"userId"`
		Devices        []string `json:"devices"`
	} `json:"setup"`
	Steps []struct {
		Device  string          `json:"device"`
		Call    string          `json:"call"`
		Request json.RawMessage `json:"request"`
		Expect  map[string]any  `json:"expect"`
	} `json:"steps"`
}

// The protocol fixtures (ADR-0042) run against the real handlers and Postgres with the README's partial-match rules.
func TestProtocolFixtures(t *testing.T) {
	files, err := filepath.Glob(protocolFixtures + "*.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no protocol fixtures: %v", err)
	}
	for _, f := range files {
		t.Run(strings.TrimSuffix(filepath.Base(f), ".json"), func(t *testing.T) { runFixture(t, f) })
	}
}

func TestPartialMatchCatchesDifferences(t *testing.T) {
	got := map[string]any{"results": []any{map[string]any{"status": "applied", "serverSeq": 4.0}}}
	if err := match(map[string]any{"results": []any{map[string]any{"status": "applied"}}}, got, ""); err != nil {
		t.Fatalf("unlisted keys must be ignored: %v", err)
	}
	for _, bad := range []map[string]any{
		{"results": []any{map[string]any{"status": "duplicate"}}},
		{"results": []any{}},
		{"hasMore": false},
	} {
		if match(bad, got, "") == nil {
			t.Fatalf("%v should not match", bad)
		}
	}
}

func runFixture(t *testing.T, path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var fx fixture
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	c := newCloud(t)
	c.seedOwner(fx.Setup.UserID, fx.Setup.OrganizationID)
	devices := map[string]*testDevice{}
	for _, symbol := range fx.Setup.Devices {
		devices[symbol] = c.registerDevice()
	}
	ids := map[string]string{}
	for s, d := range devices {
		ids[s] = d.id
	}
	for i, step := range fx.Steps {
		got := c.call(devices[step.Device], step.Call, step.Request)
		if err := matchStep(substituteDevices(step.Expect, ids).(map[string]any), got); err != nil {
			t.Fatalf("step %d (%s %s): %v", i+1, step.Device, step.Call, err)
		}
	}
}

func (c *cloud) call(d *testDevice, kind string, request json.RawMessage) map[string]any {
	c.t.Helper()
	var code int
	var body []byte
	switch kind {
	case "push":
		code, body = c.do(d, http.MethodPost, "/v1/sync/push", nil, request)
	case "pull":
		var q map[string]any
		if err := json.Unmarshal(request, &q); err != nil {
			c.t.Fatal(err)
		}
		values := url.Values{}
		for k, v := range q {
			values.Set(k, fmt.Sprint(v))
		}
		code, body = c.do(d, http.MethodGet, "/v1/sync/pull", values, nil)
	default:
		c.t.Fatalf("unknown call %q", kind)
	}
	if code != http.StatusOK {
		c.t.Fatalf("%s: HTTP %d %s", kind, code, body)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		c.t.Fatal(err)
	}
	return out
}

// substituteDevices turns a device symbol in an originDeviceId into that device's real id.
func substituteDevices(v any, ids map[string]string) any {
	switch x := v.(type) {
	case map[string]any:
		out := map[string]any{}
		for k, val := range x {
			if s, ok := val.(string); ok && k == "originDeviceId" && ids[s] != "" {
				out[k] = ids[s]
				continue
			}
			out[k] = substituteDevices(val, ids)
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, val := range x {
			out[i] = substituteDevices(val, ids)
		}
		return out
	}
	return v
}

func matchStep(expect, got map[string]any) error {
	if last, ok := expect["lastChangeFor"].(map[string]any); ok {
		change, err := lastChangeFor(got, last)
		if err != nil {
			return err
		}
		if err := match(last, change, "lastChangeFor"); err != nil {
			return err
		}
		delete(expect, "lastChangeFor")
	}
	return match(expect, got, "")
}

func lastChangeFor(page map[string]any, want map[string]any) (map[string]any, error) {
	changes, _ := page["changes"].([]any)
	for i := len(changes) - 1; i >= 0; i-- {
		ch := changes[i].(map[string]any)
		if ch["entityType"] == want["entityType"] && ch["entityId"] == want["entityId"] {
			return ch, nil
		}
	}
	return nil, fmt.Errorf("no change for %v %v in the page", want["entityType"], want["entityId"])
}

// match is the README's partial match: listed keys only, arrays by length and element.
func match(expect, got any, path string) error {
	switch e := expect.(type) {
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: expected an object, got %v", path, got)
		}
		for k, v := range e {
			if err := match(v, g[k], path+"."+k); err != nil {
				return err
			}
		}
		return nil
	case []any:
		g, ok := got.([]any)
		if !ok || len(g) != len(e) {
			return fmt.Errorf("%s: expected %d elements, got %v", path, len(e), summarize(got))
		}
		for i := range e {
			if err := match(e[i], g[i], fmt.Sprintf("%s[%d]", path, i)); err != nil {
				return err
			}
		}
		return nil
	}
	if !reflect.DeepEqual(expect, got) {
		return fmt.Errorf("%s: expected %v, got %v", path, expect, got)
	}
	return nil
}

func summarize(v any) string {
	b, _ := json.Marshal(v)
	if len(b) > 600 {
		return string(b[:600]) + "…"
	}
	return string(b)
}
