package admin

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
)

var pointerText = regexp.MustCompile(`0xc[0-9a-f]{9}`)

func TestEveryPageRendersEscaped(t *testing.T) {
	w := NewWeb(nil, nil, nil, NewCSRF())
	now := time.Now()
	resent := adminapi.Resent
	note := "fixed in 1.0.1"
	depth := 3
	next := "01NEXT"
	shop := adminapi.ShopSummary{BusinessId: "B1", BusinessName: `<script>alert(1)</script>`, OrganizationName: "Org", CreatedAt: now,
		DevicesActive: 1, DevicesTotal: 2, DevicesSilent: 1, OutboxDepthMax: &depth, DeadLettersOpen: 2, LastSeenAt: &now}
	pages := map[string]any{
		"login": nil,
		"error": nil,
		"shops": adminapi.ShopPage{Items: []adminapi.ShopSummary{shop}, NextCursor: &next},
		"shop": shopPage{Shop: shop, Tab: "devices", Body: []adminapi.AdminDevice{
			{Id: "D1", Status: adminapi.Active, Platform: "win32", AppVersion: "1.0.0", SchemaVersion: 30, CreatedAt: now, Silent: true, OutboxDepth: &depth},
			{Id: "D2", Status: adminapi.Revoked, Platform: "win32", AppVersion: "1.0.0", SchemaVersion: 30, CreatedAt: now},
		}},
		"dead_letters": shopPage{Shop: shop, Tab: "dead-letters", Open: true, Next: &next, Body: []adminapi.DeadLetter{
			{Id: 7, BusinessId: "B1", DeviceId: "D1", OperationId: "O1", EntityType: "sale", EntityId: "S1", ErrorCode: "TOTAL_MISMATCH", CreatedAt: now, PayloadPreview: `{"a":1}`},
			{Id: 8, BusinessId: "B1", DeviceId: "D1", OperationId: "O2", EntityType: "sale", EntityId: "S2", ErrorCode: "TOTAL_MISMATCH", CreatedAt: now,
				ResolvedAt: &now, Resolution: &resent, ResolutionNote: &note},
		}},
		"review_items": shopPage{Shop: shop, Tab: "chain-breaks", Body: []adminapi.ReviewItem{
			{Id: "R1", Kind: "audit_chain_broken", EntityType: "audit_log", EntityId: "A1", DeviceId: "D1", OperationId: "O3", CreatedAt: now, Detail: map[string]any{"seq": 4}},
		}},
		"backups": shopPage{Shop: shop, Tab: "backups", Body: []adminapi.Backup{{Id: "K1", DeviceId: "D1", Bytes: 10, Status: adminapi.Ready, CreatedAt: now, ConfirmedAt: &now}}},
	}
	for name, data := range pages {
		rec := httptest.NewRecorder()
		c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/admin/", nil), rec)
		c.Set(sessionKey, Session{OperatorID: "U1", TokenID: "T1"})
		if err := w.render(c, http.StatusOK, name, view{Title: name, Data: data}); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		html := rec.Body.String()
		if strings.Contains(html, "<script>") || pointerText.MatchString(html) {
			t.Fatalf("%s leaks raw markup or a pointer:\n%s", name, html)
		}
		if !strings.Contains(html, `name="csrf" value="`+w.csrf.Token("T1")+`"`) {
			t.Fatalf("%s carries no CSRF token", name)
		}
	}
}

func TestDeadLetterPageOffersActionsOnlyWhileOpen(t *testing.T) {
	w := NewWeb(nil, nil, nil, NewCSRF())
	now := time.Now()
	resent := adminapi.Resent
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/admin/", nil), rec)
	body := []adminapi.DeadLetter{{Id: 8, ResolvedAt: &now, Resolution: &resent, CreatedAt: now}}
	if err := w.render(c, http.StatusOK, "dead_letters", view{Data: shopPage{Tab: "dead-letters", Body: body}}); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(rec.Body.String(), "/resend") {
		t.Fatal("a resolved letter offers no resend")
	}
}

func TestPagesAndReasonsAreBounded(t *testing.T) {
	for _, n := range []int{0, 101, -1} {
		if _, err := PageOf(&n, nil); err == nil {
			t.Fatalf("limit %d accepted", n)
		}
	}
	long := strings.Repeat("x", 65)
	if _, err := PageOf(nil, &long); err == nil {
		t.Fatal("an overlong cursor is accepted")
	}
	if p, _ := PageOf(nil, nil); p.Limit != defaultLimit {
		t.Fatalf("default limit %d", p.Limit)
	}
	for _, bad := range []string{"", "  ok  ", strings.Repeat("y", 501)} {
		if _, err := reasonOf(bad); err == nil {
			t.Fatalf("reason %q accepted", bad)
		}
	}
	if r, err := reasonOf("  stolen laptop  "); err != nil || r != "stolen laptop" {
		t.Fatalf("reason %q %v", r, err)
	}
}

func TestCSRFTokensBindToTheSession(t *testing.T) {
	x := NewCSRF()
	if !x.Valid("T1", x.Token("T1")) || x.Valid("T2", x.Token("T1")) || x.Valid("", x.Token("")) || NewCSRF().Valid("T1", x.Token("T1")) {
		t.Fatal("a CSRF token must verify only for its own session and process key")
	}
}

func TestNoticesEchoOnlyFixedTextAndWellFormedCodes(t *testing.T) {
	for query, want := range map[string]string{
		"done=dismissed": "Dead letter dismissed.",
		"done=resend-rejected&code=TOTAL_MISMATCH": "(TOTAL_MISMATCH)",
		"done=<b>hi</b>":                "",
		"done=resend-rejected&code=<b>": notices["resend-rejected"],
	} {
		c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/admin/x?"+query, nil), httptest.NewRecorder())
		got := notice(c)
		if (want == "" && got != "") || !strings.Contains(got, want) || strings.Contains(got, "<") {
			t.Fatalf("%s → %q", query, got)
		}
	}
}
