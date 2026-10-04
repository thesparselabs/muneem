package devicesync_test

import (
	"encoding/json"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/httpx"
)

// The previous protocol's fixtures, frozen when it was current (ADR-0049). Bump with SyncProtocol: vN−1 stays here.
const previousProtocolFixtures = protocolFixtures + "v1/"

// A server one protocol ahead (N=2, min=1) still serves protocol-1 devices exactly as the v1 fixtures recorded.
func TestPreviousProtocolFixturesOnNextServer(t *testing.T) {
	files, err := filepath.Glob(previousProtocolFixtures + "*.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no frozen v1 fixtures: %v", err)
	}
	for _, f := range files {
		t.Run(strings.TrimSuffix(filepath.Base(f), ".json"), func(t *testing.T) {
			c := newCloudWith(t, httpx.Protocols{Min: 1, Current: 2})
			c.protocol = 1
			runFixture(t, f, c)
		})
	}
}

func TestProtocolOutsideTheRangeIsRefused(t *testing.T) {
	c := newCloudWith(t, httpx.Protocols{Min: 1, Current: 2})
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	d := c.registerDevice()
	push := []byte(`{"businessId":"01M43QAXKXG58YZF2DJP7Y1QRN","protocol":1,"schemaVersion":14,"clientTime":"2026-10-04T10:00:00.000Z","operations":[]}`)
	pull := url.Values{"businessId": {"01M43QAXKXG58YZF2DJP7Y1QRN"}, "stream": {"masters"}, "since": {"0"}}
	for _, header := range []int{0, 3} {
		c.protocol = header
		for name, call := range map[string]func() (int, []byte){
			"push": func() (int, []byte) { return c.do(d, http.MethodPost, "/v1/sync/push", nil, push) },
			"pull": func() (int, []byte) { return c.do(d, http.MethodGet, "/v1/sync/pull", pull, nil) },
		} {
			code, body := call()
			if code != http.StatusUpgradeRequired || errorCode(t, body) != "VERSION_UNSUPPORTED" {
				t.Fatalf("protocol %d %s: want 426 VERSION_UNSUPPORTED, got %d %s", header, name, code, body)
			}
		}
	}
	c.protocol = 1
	if code, body := c.do(d, http.MethodPost, "/v1/sync/push", nil, []byte(strings.Replace(string(push), `"protocol":1`, `"protocol":0`, 1))); code != http.StatusUpgradeRequired {
		t.Fatalf("a push body naming protocol 0: want 426, got %d %s", code, body)
	}
	// Past the gate, the unknown business is what answers.
	if code, body := c.do(d, http.MethodGet, "/v1/sync/pull", pull, nil); code != http.StatusNotFound {
		t.Fatalf("protocol 1 on an N=2 server: want the handler's 404, got %d %s", code, body)
	}
}

func TestMissingProtocolHeaderIsRefused(t *testing.T) {
	c := newCloud(t)
	c.seedOwner("01J00000000000000000000A01", "01J00000000000000000000B01")
	d := c.registerDevice()
	c.noProtocolHeader = true
	code, body := c.do(d, http.MethodGet, "/v1/sync/pull", url.Values{"businessId": {"01M43QAXKXG58YZF2DJP7Y1QRN"}, "stream": {"masters"}, "since": {"0"}}, nil)
	if code != http.StatusUpgradeRequired || !strings.Contains(string(body), "not none") {
		t.Fatalf("want 426, got %d %s", code, body)
	}
}

func errorCode(t *testing.T, body []byte) string {
	t.Helper()
	var e struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &e); err != nil {
		t.Fatalf("not an error body: %s", body)
	}
	return e.Error.Code
}
