package admin_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/admin"
	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/device"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/store"
	"github.com/sparselabs/muneem/cloud/internal/testdb"
)

const (
	operatorEmail    = "ops@muneem.test"
	operatorPassword = "operator-password-1"
	shopEmail        = "owner@shop.test"
	shopPassword     = "shop-password-1"
)

type world struct {
	t     *testing.T
	db    *store.DB
	e     *echo.Echo
	keys  *auth.Keyring
	shopA string
	shopB string
	devA  string
	devB  string
	owner string
}

func newWorld(t *testing.T) *world {
	db := testdb.OpenOwn(t, "admin")
	testdb.Reset(t, db)
	keys, err := auth.KeyringFromEnv("", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	dir := &admin.Directory{DB: db}
	operators := &admin.Operators{Dir: dir, Tokens: admin.NewTokens(keys)}
	actions := &admin.Actions{Dir: dir, App: db, Ingest: &devicesync.Ingest{DB: db, Log: log}, Revocations: devicesync.Control{}, Keys: device.NewVerifier(db)}
	w := &world{t: t, db: db, keys: keys, e: admin.NewServer(admin.NewModule(dir, operators, actions, admin.NewCSRF()), log)}
	w.seed()
	if _, err := admin.GrantOperator(context.Background(), db, operatorEmail, func() (string, error) { return operatorPassword, nil }); err != nil {
		t.Fatal(err)
	}
	return w
}

func (w *world) exec(sql string, args ...any) {
	w.t.Helper()
	if _, err := w.db.Pool.Exec(context.Background(), sql, args...); err != nil {
		w.t.Fatalf("%s: %v", sql, err)
	}
}

func (w *world) seed() {
	hash, err := auth.HashPassword(shopPassword)
	if err != nil {
		w.t.Fatal(err)
	}
	w.owner = ulid.Make().String()
	w.exec(`INSERT INTO app_user (id, name, identifier, email, password_hash) VALUES ($1, 'Owner', $2, $2, $3)`, w.owner, shopEmail, hash)
	w.shopA, w.devA = w.shop("Sharma Store")
	w.shopB, w.devB = w.shop("Gupta Traders")
}

func (w *world) shop(name string) (business, dev string) {
	org, business, dev := ulid.Make().String(), ulid.Make().String(), ulid.Make().String()
	w.exec(`INSERT INTO organization (id, name) VALUES ($1, $2)`, org, name+" org")
	w.exec(`INSERT INTO organization_member (organization_id, user_id, role) VALUES ($1, $2, 'owner')`, org, w.owner)
	w.exec(`INSERT INTO business (id, organization_id, name, business_type, state_code, tax_scheme, created_by) VALUES ($1, $2, $3, 'retail', '07', 'regular', $4)`,
		business, org, name, w.owner)
	w.exec(`INSERT INTO business_membership (user_id, business_id, roles_json, grants_json) VALUES ($1, $2, '["owner"]', '[]')`, w.owner, business)
	w.exec(`INSERT INTO device (id, organization_id, business_id, registered_by, installation_id, public_key, platform, app_version, schema_version, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, 'AAAA', 'win32', '1.0.0', 30, now())`, dev, org, business, w.owner, ulid.Make().String())
	return business, dev
}

// deadLetter stores an operation as an older server rejected it.
func (w *world) deadLetter(business, dev string, op devicesync.Operation) int64 {
	raw, err := json.Marshal(op)
	if err != nil {
		w.t.Fatal(err)
	}
	w.exec(`INSERT INTO sync_operation (business_id, device_id, operation_id, entity_type, entity_id, payload_hash, status, error_code, device_seq)
		VALUES ($1, $2, $3, $4, $5, $6, 'rejected', 'PAYLOAD_INVALID', $7)`, business, dev, op.OperationID, op.EntityType, op.EntityID, op.PayloadHash, op.Seq)
	var id int64
	if err := w.db.Pool.QueryRow(context.Background(), `INSERT INTO dead_letter (business_id, device_id, operation_id, entity_type, entity_id, operation, error_code, error_detail)
		VALUES ($1, $2, $3, $4, $5, $6, 'PAYLOAD_INVALID', 'rejected by an older server') RETURNING id`,
		business, dev, op.OperationID, op.EntityType, op.EntityID, raw).Scan(&id); err != nil {
		w.t.Fatal(err)
	}
	return id
}

func uomOp(business string) devicesync.Operation {
	id := ulid.Make().String()
	payload, _ := json.Marshal(map[string]any{"id": id, "businessId": business, "code": "KG", "name": "Kilogram", "decimals": 3, "version": 1})
	return devicesync.Operation{OperationID: ulid.Make().String(), Seq: 7, EntityType: "uom", EntityID: id, OperationType: "create",
		PayloadHash: "sha256:" + id, Payload: payload}
}

type response struct {
	code    int
	body    []byte
	cookies []*http.Cookie
	header  http.Header
}

func (r response) decode(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		t.Fatalf("decode %s: %v", r.body, err)
	}
}

func (w *world) do(method, path string, body any, token string) response {
	w.t.Helper()
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(echo.HeaderAuthorization, "Bearer "+token)
	}
	return w.serve(req)
}

func (w *world) serve(req *http.Request) response {
	rec := httptest.NewRecorder()
	w.e.ServeHTTP(rec, req)
	return response{code: rec.Code, body: rec.Body.Bytes(), cookies: rec.Result().Cookies(), header: rec.Header()}
}

func (w *world) login(identifier, password string) response {
	return w.do(http.MethodPost, "/v1/admin/auth/login", map[string]string{"identifier": identifier, "password": password}, "")
}

func (w *world) operatorToken() string {
	w.t.Helper()
	r := w.login(operatorEmail, operatorPassword)
	if r.code != http.StatusOK {
		w.t.Fatalf("operator login: %d %s", r.code, r.body)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	r.decode(w.t, &tok)
	return tok.AccessToken
}

func (w *world) count(sql string, args ...any) int {
	w.t.Helper()
	var n int
	if err := w.db.Pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		w.t.Fatalf("%s: %v", sql, err)
	}
	return n
}

func TestShopUsersNeverReachTheAdmin(t *testing.T) {
	w := newWorld(t)
	if r := w.login(shopEmail, shopPassword); r.code != http.StatusUnauthorized {
		t.Fatalf("a shop owner's correct password must not open the admin: %d", r.code)
	}
	shopClaims := auth.Claims{}
	shopClaims.Subject = w.owner
	shopToken, err := auth.NewKeyringSigner(w.keys).Issue(shopClaims)
	if err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{"", shopToken, "not-a-token"} {
		if r := w.do(http.MethodGet, "/v1/admin/shops", nil, token); r.code != http.StatusUnauthorized {
			t.Fatalf("token %q reached the admin: %d %s", token, r.code, r.body)
		}
	}
	opToken := w.operatorToken()
	shopRoute := auth.NewKeyringSigner(w.keys).Require(func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+opToken)
	rec := httptest.NewRecorder()
	if _ = shopRoute(echo.New().NewContext(req, rec)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("an operator token must not open a shop route: %d", rec.Code)
	}
	if err := admin.RevokeOperator(context.Background(), w.db, operatorEmail); err != nil {
		t.Fatal(err)
	}
	if r := w.do(http.MethodGet, "/v1/admin/shops", nil, opToken); r.code != http.StatusUnauthorized {
		t.Fatalf("a revoked operator's open session must end: %d", r.code)
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.login_failed' AND entity_id = $1`, shopEmail); n != 1 {
		t.Fatalf("failed operator logins are audited: %d", n)
	}
}

func TestOperatorListsShopsAcrossTenants(t *testing.T) {
	w := newWorld(t)
	w.deadLetter(w.shopA, w.devA, uomOp(w.shopA))
	tok := w.operatorToken()
	r := w.do(http.MethodGet, "/v1/admin/shops", nil, tok)
	var page struct {
		Items []struct {
			BusinessID      string `json:"business_id"`
			DevicesActive   int    `json:"devices_active"`
			DeadLettersOpen int    `json:"dead_letters_open"`
		} `json:"items"`
		NextCursor *string `json:"next_cursor"`
	}
	r.decode(t, &page)
	if r.code != http.StatusOK || len(page.Items) != 2 || page.NextCursor != nil {
		t.Fatalf("both shops on one page: %d %s", r.code, r.body)
	}
	letters := map[string]int{}
	for _, s := range page.Items {
		letters[s.BusinessID] = s.DeadLettersOpen
		if s.DevicesActive != 1 {
			t.Fatalf("devices %+v", s)
		}
	}
	if letters[w.shopA] != 1 || letters[w.shopB] != 0 {
		t.Fatalf("open dead letters %v", letters)
	}
	first := w.do(http.MethodGet, "/v1/admin/shops?limit=1", nil, tok)
	first.decode(t, &page)
	if len(page.Items) != 1 || page.NextCursor == nil {
		t.Fatalf("paged: %s", first.body)
	}
	second := w.do(http.MethodGet, "/v1/admin/shops?limit=1&cursor="+url.QueryEscape(*page.NextCursor), nil, tok)
	page.NextCursor = nil
	second.decode(t, &page)
	if len(page.Items) != 1 || page.NextCursor != nil {
		t.Fatalf("second page: %s", second.body)
	}
	if r := w.do(http.MethodGet, "/v1/admin/shops?limit=1000", nil, tok); r.code != http.StatusUnprocessableEntity {
		t.Fatalf("pages are bounded: %d", r.code)
	}
	for _, path := range []string{"/v1/admin/shops/" + w.shopB, "/v1/admin/shops/" + w.shopB + "/review-items", "/v1/admin/shops/" + w.shopB + "/chain-breaks",
		"/v1/admin/shops/" + w.shopB + "/backups", "/v1/admin/shops/" + w.shopA + "/dead-letters?state=all"} {
		if r := w.do(http.MethodGet, path, nil, tok); r.code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, r.code, r.body)
		}
	}
	if r := w.do(http.MethodGet, "/v1/admin/shops/nope", nil, tok); r.code != http.StatusNotFound {
		t.Fatalf("unknown shop: %d", r.code)
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.view' AND user_id IS NOT NULL`); n < 9 {
		t.Fatalf("every operator read is audited: %d", n)
	}
}

func TestResendReappliesOnceAndResolves(t *testing.T) {
	w := newWorld(t)
	op := uomOp(w.shopA)
	id := w.deadLetter(w.shopA, w.devA, op)
	tok := w.operatorToken()
	path := "/v1/admin/dead-letters/" + itoa(id) + "/resend"
	if r := w.do(http.MethodPost, path, map[string]string{"reason": ""}, tok); r.code != http.StatusUnprocessableEntity {
		t.Fatalf("a resend needs a reason: %d", r.code)
	}
	var res struct {
		Status     string `json:"status"`
		DeadLetter struct {
			Resolution *string `json:"resolution"`
		} `json:"dead_letter"`
	}
	r := w.do(http.MethodPost, path, map[string]string{"reason": "verification bug fixed in 1.0.1"}, tok)
	r.decode(t, &res)
	if r.code != http.StatusOK || res.Status != "applied" || res.DeadLetter.Resolution == nil || *res.DeadLetter.Resolution != "resent" {
		t.Fatalf("resend: %d %s", r.code, r.body)
	}
	again := w.do(http.MethodPost, path, map[string]string{"reason": "pressed twice by accident"}, tok)
	again.decode(t, &res)
	if again.code != http.StatusOK || res.Status != "duplicate" {
		t.Fatalf("a second resend is a duplicate: %d %s", again.code, again.body)
	}
	if n := w.count(`SELECT count(*) FROM change_log WHERE business_id = $1 AND entity_id = $2`, w.shopA, op.EntityID); n != 1 {
		t.Fatalf("the operation applied %d times", n)
	}
	if n := w.count(`SELECT count(*) FROM sync_operation WHERE operation_id = $1 AND status = 'applied'`, op.OperationID); n != 1 {
		t.Fatalf("the operation is recorded applied: %d", n)
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.dead_letter.resent' AND after_json->>'reason' = 'verification bug fixed in 1.0.1'`); n != 1 {
		t.Fatalf("the resend is audited with its reason: %d", n)
	}
}

func TestAResendRefusedAgainLeavesTheLetterOpen(t *testing.T) {
	w := newWorld(t)
	bad := uomOp(w.shopA)
	bad.EntityType, bad.Payload = "business", json.RawMessage(`{"id":"other"}`)
	id := w.deadLetter(w.shopA, w.devA, bad)
	tok := w.operatorToken()
	var res struct {
		Status string  `json:"status"`
		Code   *string `json:"code"`
	}
	r := w.do(http.MethodPost, "/v1/admin/dead-letters/"+itoa(id)+"/resend", map[string]string{"reason": "try once more"}, tok)
	r.decode(t, &res)
	if r.code != http.StatusOK || res.Status != "rejected" || res.Code == nil || *res.Code != "PAYLOAD_INVALID" {
		t.Fatalf("resend: %d %s", r.code, r.body)
	}
	if n := w.count(`SELECT count(*) FROM dead_letter WHERE business_id = $1 AND resolved_at IS NULL`, w.shopA); n != 1 {
		t.Fatalf("one open dead letter, not a second copy: %d", n)
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.dead_letter.resend_failed'`); n != 1 {
		t.Fatalf("the failed attempt is audited: %d", n)
	}
}

func TestDismissIsAuditedAndFinal(t *testing.T) {
	w := newWorld(t)
	id := w.deadLetter(w.shopA, w.devA, uomOp(w.shopA))
	tok := w.operatorToken()
	path := "/v1/admin/dead-letters/" + itoa(id)
	if r := w.do(http.MethodPost, path+"/dismiss", map[string]string{"reason": "no"}, tok); r.code != http.StatusUnprocessableEntity {
		t.Fatalf("a short reason is refused: %d", r.code)
	}
	if r := w.do(http.MethodPost, path+"/dismiss", map[string]string{"reason": "shop re-entered the sale by hand"}, tok); r.code != http.StatusOK {
		t.Fatalf("dismiss: %d %s", r.code, r.body)
	}
	for _, action := range []string{"/dismiss", "/resend"} {
		if r := w.do(http.MethodPost, path+action, map[string]string{"reason": "after the dismissal"}, tok); r.code != http.StatusConflict {
			t.Fatalf("%s after a dismissal: %d %s", action, r.code, r.body)
		}
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.dead_letter.dismissed' AND business_id = $1
		AND after_json->>'reason' = 'shop re-entered the sale by hand' AND user_id IS NOT NULL`, w.shopA); n != 1 {
		t.Fatalf("the dismissal is audited with who and why: %d", n)
	}
	var letter struct {
		Resolution string `json:"resolution"`
	}
	r := w.do(http.MethodGet, path, nil, tok)
	r.decode(t, &letter)
	if letter.Resolution != "dismissed" {
		t.Fatalf("letter %s", r.body)
	}
	var open struct {
		Items []any `json:"items"`
	}
	w.do(http.MethodGet, "/v1/admin/shops/"+w.shopA+"/dead-letters", nil, tok).decode(t, &open)
	if len(open.Items) != 0 {
		t.Fatalf("a dismissed letter is no longer open: %v", open.Items)
	}
}

func TestOperatorRevokesADevice(t *testing.T) {
	w := newWorld(t)
	tok := w.operatorToken()
	var dev struct {
		Status string `json:"status"`
	}
	r := w.do(http.MethodPost, "/v1/admin/devices/"+w.devB+"/revoke", map[string]string{"reason": "laptop stolen from the shop"}, tok)
	r.decode(t, &dev)
	if r.code != http.StatusOK || dev.Status != "revoked" {
		t.Fatalf("revoke: %d %s", r.code, r.body)
	}
	if n := w.count(`SELECT count(*) FROM change_log WHERE business_id = $1 AND stream = 'control' AND entity_type = 'device' AND entity_id = $2`, w.shopB, w.devB); n != 1 {
		t.Fatalf("the other devices are told: %d", n)
	}
	if n := w.count(`SELECT count(*) FROM audit_log WHERE action = 'admin.device.revoke' AND device_id = $1`, w.devB); n != 1 {
		t.Fatalf("revocation audited: %d", n)
	}
	if r := w.do(http.MethodPost, "/v1/admin/devices/nope/revoke", map[string]string{"reason": "no such device"}, tok); r.code != http.StatusNotFound {
		t.Fatalf("unknown device: %d", r.code)
	}
}

func TestTheAdminRoleSeesOnlyWhatItIsGranted(t *testing.T) {
	w := newWorld(t)
	ctx := context.Background()
	for _, stmt := range []string{
		`SELECT count(*) FROM journal_entry`,
		`SELECT count(*) FROM entity_state`,
		`SELECT count(*) FROM backup_key`,
		`SELECT count(*) FROM refresh_token`,
		`UPDATE device SET status = 'active'`,
		`INSERT INTO audit_log (action, entity_type) VALUES ('device.revoke', 'device')`,
		`DELETE FROM dead_letter`,
		`UPDATE dead_letter SET error_code = 'X'`,
	} {
		tx, err := w.db.Pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, "SET LOCAL ROLE muneem_admin"); err != nil {
			t.Fatal(err)
		}
		_, err = tx.Exec(ctx, stmt)
		_ = tx.Rollback(ctx)
		if err == nil {
			t.Fatalf("muneem_admin may not: %s", stmt)
		}
	}
}

func TestThePageNeedsASessionAndCSRF(t *testing.T) {
	w := newWorld(t)
	id := w.deadLetter(w.shopA, w.devA, uomOp(w.shopA))
	if r := w.serve(httptest.NewRequest(http.MethodGet, "/admin/shops", nil)); r.code != http.StatusSeeOther || r.header.Get("Location") != "/admin/login" {
		t.Fatalf("no session: %d %s", r.code, r.header.Get("Location"))
	}
	form := w.serve(httptest.NewRequest(http.MethodGet, "/admin/login", nil))
	loginToken := csrfIn(t, form.body)
	if r := w.postForm("/admin/login", url.Values{"identifier": {operatorEmail}, "password": {operatorPassword}, "csrf": {loginToken}}, nil); r.code != http.StatusForbidden {
		t.Fatalf("a login without its cookie is refused: %d", r.code)
	}
	signedIn := w.postForm("/admin/login", url.Values{"identifier": {operatorEmail}, "password": {operatorPassword}, "csrf": {loginToken}}, form.cookies)
	session := cookieNamed(signedIn.cookies, "muneem_op")
	if signedIn.code != http.StatusSeeOther || session == nil || !session.HttpOnly || !session.Secure || session.SameSite != http.SameSiteStrictMode {
		t.Fatalf("sign in: %d %+v", signedIn.code, session)
	}
	jar := []*http.Cookie{session}
	page := w.get("/admin/shops/"+w.shopA+"/dead-letters", jar)
	if page.code != http.StatusOK || !strings.Contains(string(page.body), "Sharma Store") || !strings.Contains(string(page.body), "rejected by an older server") {
		t.Fatalf("dead letters page: %d %s", page.code, page.body)
	}
	if csp := page.header.Get("Content-Security-Policy"); !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Fatalf("csp %q", csp)
	}
	dismiss := "/admin/dead-letters/" + itoa(id) + "/dismiss"
	reason := url.Values{"reason": {"duplicate of a sale already synced"}, "business": {w.shopA}}
	if r := w.postForm(dismiss, reason, jar); r.code != http.StatusForbidden {
		t.Fatalf("a POST without the CSRF token is refused: %d", r.code)
	}
	reason.Set("csrf", "forged")
	if r := w.postForm(dismiss, reason, jar); r.code != http.StatusForbidden {
		t.Fatalf("a forged CSRF token is refused: %d", r.code)
	}
	reason.Set("csrf", csrfIn(t, page.body))
	r := w.postForm(dismiss, reason, jar)
	if r.code != http.StatusSeeOther || !strings.Contains(r.header.Get("Location"), "done=dismissed") {
		t.Fatalf("dismiss: %d %s", r.code, r.header.Get("Location"))
	}
	if after := w.get(r.header.Get("Location"), jar); !strings.Contains(string(after.body), "Dead letter dismissed.") {
		t.Fatalf("notice missing: %s", after.body)
	}
	for _, path := range []string{"/admin/shops", "/admin/shops/" + w.shopB, "/admin/shops/" + w.shopB + "/review-items",
		"/admin/shops/" + w.shopB + "/chain-breaks", "/admin/shops/" + w.shopB + "/backups", "/admin/static/admin.css"} {
		if r := w.get(path, jar); r.code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, r.code, r.body)
		}
	}
}

func (w *world) get(path string, cookies []*http.Cookie) response {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return w.serve(req)
}

func (w *world) postForm(path string, form url.Values, cookies []*http.Cookie) response {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(form.Encode()))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return w.serve(req)
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

var csrfField = regexp.MustCompile(`name="csrf" value="([^"]+)"`)

func csrfIn(t *testing.T, html []byte) string {
	t.Helper()
	m := csrfField.FindSubmatch(html)
	if m == nil {
		t.Fatalf("no csrf token in %s", html)
	}
	return string(m[1])
}

func cookieNamed(cookies []*http.Cookie, name string) *http.Cookie {
	for _, c := range cookies {
		if c.Name == name && c.Value != "" {
			return c
		}
	}
	return nil
}
