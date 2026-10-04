package admin

import (
	"bytes"
	"embed"
	"errors"
	"html/template"
	"net/http"
	"net/url"
	"regexp"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api/adminapi"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

//go:embed templates/*.html static/admin.css
var assets embed.FS

const (
	sessionCookie = "muneem_op"
	loginCookie   = "muneem_op_login"
)

// Web is the server-rendered admin page: plain HTML forms over the same Directory and Actions as the JSON API.
type Web struct {
	operators *Operators
	dir       *Directory
	actions   *Actions
	csrf      *CSRF
	pages     map[string]*template.Template
}

var pageNames = []string{"login", "shops", "shop", "dead_letters", "review_items", "backups", "error"}

func NewWeb(operators *Operators, dir *Directory, actions *Actions, csrf *CSRF) *Web {
	w := &Web{operators: operators, dir: dir, actions: actions, csrf: csrf, pages: map[string]*template.Template{}}
	for _, name := range pageNames {
		w.pages[name] = template.Must(template.New("layout.html").Funcs(viewFuncs).ParseFS(assets, "templates/layout.html", "templates/"+name+".html"))
	}
	return w
}

func (w *Web) mount(g *echo.Group, loginLimit, audit echo.MiddlewareFunc) {
	home := func(c echo.Context) error { return c.Redirect(http.StatusSeeOther, "/admin/shops") }
	g.GET("", home)
	g.GET("/", home)
	g.GET("/static/admin.css", w.stylesheet)
	g.GET("/login", w.loginForm)
	g.POST("/login", w.login, loginLimit)
	g.POST("/logout", w.logout, w.session, w.checkCSRF)
	g.GET("/shops", w.shops, w.session, audit)
	g.GET("/shops/:businessId", w.shop, w.session, audit)
	g.GET("/shops/:businessId/dead-letters", w.deadLetters, w.session, audit)
	g.GET("/shops/:businessId/review-items", w.reviewItems(false), w.session, audit)
	g.GET("/shops/:businessId/chain-breaks", w.reviewItems(true), w.session, audit)
	g.GET("/shops/:businessId/backups", w.backups, w.session, audit)
	g.POST("/devices/:deviceId/revoke", w.revoke, w.session, w.checkCSRF)
	g.POST("/dead-letters/:id/resend", w.resend, w.session, w.checkCSRF)
	g.POST("/dead-letters/:id/dismiss", w.dismiss, w.session, w.checkCSRF)
}

type view struct {
	Title  string
	CSRF   string
	Notice string
	Error  string
	Signed bool
	Data   any
}

func (w *Web) render(c echo.Context, status int, page string, v view) error {
	if s := sessionFrom(c); s.TokenID != "" {
		v.Signed, v.CSRF = true, w.csrf.Token(s.TokenID)
	}
	var html bytes.Buffer
	if err := w.pages[page].ExecuteTemplate(&html, "layout", v); err != nil {
		return err
	}
	return c.HTMLBlob(status, html.Bytes())
}

func (w *Web) stylesheet(c echo.Context) error {
	css, err := assets.ReadFile("static/admin.css")
	if err != nil {
		return err
	}
	return c.Blob(http.StatusOK, "text/css; charset=utf-8", css)
}

func cookie(name, value, path string, maxAge int) *http.Cookie {
	return &http.Cookie{Name: name, Value: value, Path: path, MaxAge: maxAge, HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode}
}

func (w *Web) loginForm(c echo.Context) error {
	return w.renderLogin(c, http.StatusOK, "")
}

func (w *Web) renderLogin(c echo.Context, status int, problem string) error {
	token := randomToken()
	c.SetCookie(cookie(loginCookie, token, "/admin/login", 600))
	return w.render(c, status, "login", view{Title: "Sign in", CSRF: token, Error: problem})
}

func (w *Web) login(c echo.Context) error {
	sent, err := c.Cookie(loginCookie)
	if err != nil || !sameToken(sent.Value, c.FormValue("csrf")) {
		return w.renderLogin(c, http.StatusForbidden, "The form expired. Sign in again.")
	}
	token, err := w.operators.Login(c.Request().Context(), c.FormValue("identifier"), c.FormValue("password"), requestID(c))
	if errors.Is(err, ErrInvalidLogin) {
		return w.renderLogin(c, http.StatusUnauthorized, "Wrong email or password, or the account is not an operator.")
	}
	if err != nil {
		return err
	}
	c.SetCookie(cookie(loginCookie, "", "/admin/login", -1))
	c.SetCookie(cookie(sessionCookie, token, "/admin", int(SessionTTL.Seconds())))
	return c.Redirect(http.StatusSeeOther, "/admin/shops")
}

func (w *Web) logout(c echo.Context) error {
	if err := w.dir.Audit(c.Request().Context(), actorOf(c, ""), nil, "admin.logout", "operator", sessionFrom(c).OperatorID, nil); err != nil {
		return err
	}
	c.SetCookie(cookie(sessionCookie, "", "/admin", -1))
	return c.Redirect(http.StatusSeeOther, "/admin/login")
}

func (w *Web) session(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		raw, err := c.Cookie(sessionCookie)
		if err != nil {
			return c.Redirect(http.StatusSeeOther, "/admin/login")
		}
		s, err := w.operators.Authenticate(c.Request().Context(), raw.Value)
		if errors.Is(err, ErrNotOperator) {
			return c.Redirect(http.StatusSeeOther, "/admin/login")
		}
		if err != nil {
			return err
		}
		c.Set(sessionKey, s)
		return next(c)
	}
}

func (w *Web) checkCSRF(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if !w.csrf.Valid(sessionFrom(c).TokenID, c.FormValue("csrf")) {
			return w.render(c, http.StatusForbidden, "error", view{Title: "Refused", Error: "The form token is missing or stale. Go back, reload and try again."})
		}
		return next(c)
	}
}

func pageQuery(c echo.Context) (Page, error) {
	var limit *int
	if raw := c.QueryParam("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			return Page{}, errBadCursor
		}
		limit = &n
	}
	cursor := c.QueryParam("cursor")
	return PageOf(limit, &cursor)
}

func (w *Web) fail(c echo.Context, err error) error {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return w.render(c, http.StatusNotFound, "error", view{Title: "Not found", Error: "Nothing here: the shop, device or dead letter does not exist."})
	case errors.Is(err, errBadCursor):
		return w.render(c, http.StatusBadRequest, "error", view{Title: "Bad request", Error: "The page link is malformed."})
	}
	return err
}

type shopPage struct {
	Shop adminapi.ShopSummary
	Tab  string
	Body any
	Next *string
	Open bool
}

func (w *Web) shops(c echo.Context) error {
	p, err := pageQuery(c)
	if err != nil {
		return w.fail(c, err)
	}
	out, err := w.dir.Shops(c.Request().Context(), p)
	if err != nil {
		return w.fail(c, err)
	}
	return w.render(c, http.StatusOK, "shops", view{Title: "Shops", Data: out})
}

func (w *Web) shop(c echo.Context) error {
	out, err := w.dir.Shop(c.Request().Context(), c.Param("businessId"))
	if err != nil {
		return w.fail(c, err)
	}
	return w.render(c, http.StatusOK, "shop", view{Title: out.Shop.BusinessName, Notice: notice(c), Data: shopPage{Shop: out.Shop, Tab: "devices", Body: out.Devices}})
}

// tab renders one of a shop's lists under the shop's header.
func (w *Web) tab(c echo.Context, page, tab string, list func(Page) (any, *string, error)) error {
	p, err := pageQuery(c)
	if err != nil {
		return w.fail(c, err)
	}
	detail, err := w.dir.Shop(c.Request().Context(), c.Param("businessId"))
	if err != nil {
		return w.fail(c, err)
	}
	body, next, err := list(p)
	if err != nil {
		return w.fail(c, err)
	}
	return w.render(c, http.StatusOK, page, view{Title: detail.Shop.BusinessName, Notice: notice(c),
		Data: shopPage{Shop: detail.Shop, Tab: tab, Body: body, Next: next, Open: c.QueryParam("state") != "all"}})
}

func (w *Web) deadLetters(c echo.Context) error {
	return w.tab(c, "dead_letters", "dead-letters", func(p Page) (any, *string, error) {
		out, err := w.dir.DeadLetters(c.Request().Context(), c.Param("businessId"), c.QueryParam("state") != "all", p)
		return out.Items, out.NextCursor, err
	})
}

func (w *Web) reviewItems(chainBreaks bool) echo.HandlerFunc {
	tab := "review-items"
	if chainBreaks {
		tab = "chain-breaks"
	}
	return func(c echo.Context) error {
		return w.tab(c, "review_items", tab, func(p Page) (any, *string, error) {
			out, err := w.dir.ReviewItems(c.Request().Context(), c.Param("businessId"), chainBreaks, p)
			return out.Items, out.NextCursor, err
		})
	}
}

func (w *Web) backups(c echo.Context) error {
	return w.tab(c, "backups", "backups", func(p Page) (any, *string, error) {
		out, err := w.dir.Backups(c.Request().Context(), c.Param("businessId"), p)
		return out.Items, out.NextCursor, err
	})
}

func shopURL(businessID, tab string, q url.Values) string {
	u := "/admin/shops/" + url.PathEscape(businessID)
	if tab != "" {
		u += "/" + tab
	}
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	return u
}

func done(what string) url.Values { return url.Values{"done": {what}} }

func (w *Web) revoke(c echo.Context) error {
	back := shopURL(c.FormValue("business"), "", nil)
	reason, err := reasonOf(c.FormValue("reason"))
	if err != nil {
		return c.Redirect(http.StatusSeeOther, shopURL(c.FormValue("business"), "", done("reason")))
	}
	d, err := w.actions.RevokeDevice(c.Request().Context(), actorOf(c, reason), c.Param("deviceId"))
	if err != nil {
		return w.fail(c, err)
	}
	if d.BusinessId != nil {
		back = shopURL(*d.BusinessId, "", done("revoked"))
	}
	return c.Redirect(http.StatusSeeOther, back)
}

func (w *Web) letterAction(c echo.Context, act func(id int64, who Actor) (string, url.Values, error)) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return w.fail(c, store.ErrNotFound)
	}
	business := c.FormValue("business")
	reason, err := reasonOf(c.FormValue("reason"))
	if err != nil {
		return c.Redirect(http.StatusSeeOther, shopURL(business, "dead-letters", done("reason")))
	}
	businessID, q, err := act(id, actorOf(c, reason))
	if errors.Is(err, errResolved) {
		return c.Redirect(http.StatusSeeOther, shopURL(business, "dead-letters", done("already-resolved")))
	}
	if err != nil {
		return w.fail(c, err)
	}
	return c.Redirect(http.StatusSeeOther, shopURL(businessID, "dead-letters", q))
}

func (w *Web) resend(c echo.Context) error {
	return w.letterAction(c, func(id int64, who Actor) (string, url.Values, error) {
		out, err := w.actions.Resend(c.Request().Context(), who, id)
		q := done("resend-" + string(out.Status))
		if out.Code != nil {
			q.Set("code", *out.Code)
		}
		return out.DeadLetter.BusinessId, q, err
	})
}

func (w *Web) dismiss(c echo.Context) error {
	return w.letterAction(c, func(id int64, who Actor) (string, url.Values, error) {
		out, err := w.actions.Dismiss(c.Request().Context(), who, id)
		return out.BusinessId, done("dismissed"), err
	})
}

var notices = map[string]string{
	"revoked":          "Device revoked. Its other devices learn it on their next pull.",
	"resend-applied":   "The operation applied; the dead letter is resolved.",
	"resend-duplicate": "The operation had already applied; the dead letter is resolved.",
	"resend-deferred":  "The cloud deferred the operation again; the dead letter stays open.",
	"resend-rejected":  "The cloud refused the operation again; the dead letter stays open.",
	"dismissed":        "Dead letter dismissed.",
	"already-resolved": "That dead letter is already resolved.",
	"reason":           "Give a reason of 5 to 500 characters.",
}

var errorCode = regexp.MustCompile(`^[A-Z_]{1,40}$`)

// notice is a fixed message chosen by the done code; nothing from the query string is echoed but a well-formed error code.
func notice(c echo.Context) string {
	msg := notices[c.QueryParam("done")]
	if code := c.QueryParam("code"); msg != "" && errorCode.MatchString(code) {
		msg += " (" + code + ")"
	}
	return msg
}
