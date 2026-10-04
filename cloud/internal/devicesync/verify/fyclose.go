package verify

import (
	"encoding/json"
	"regexp"
)

var fyRe = regexp.MustCompile(`^(\d{4})-\d{2}$`)

type ClosingBalance struct {
	Code     string `json:"code"`
	Type     string `json:"type"`
	NetPaise int64  `json:"netPaise"`
}

type Closing struct {
	Version  int              `json:"version"`
	Journal  *Journal         `json:"journal"`
	Balances []ClosingBalance `json:"balances"`
}

type FyClose struct {
	Fy       string    `json:"fy"`
	FyEnd    string    `json:"fyEnd"`
	Version  int       `json:"version"`
	Closings []Closing `json:"closings"`
}

func DecodeFyClose(payload []byte) (*FyClose, error) {
	var c FyClose
	if err := json.Unmarshal(payload, &c); err != nil {
		return nil, fail(PayloadInvalid, "fy_close: %v", err)
	}
	return &c, nil
}

func (c *FyClose) journals() []*Journal {
	var out []*Journal
	for i := range c.Closings {
		if c.Closings[i].Journal != nil {
			out = append(out, c.Closings[i].Journal)
		}
	}
	return out
}

// ADR-0045: every closing is dated the year's last day and closes exactly the income and expense balances it names to
// 3300 Retained Earnings; versions run 1, 2, … with one closing each.
func verifyFyClose(c *FyClose) error {
	m := fyRe.FindStringSubmatch(c.Fy)
	if m == nil || c.FyEnd != nextYear(m[1])+"-03-31" {
		return fail(PayloadInvalid, "fy_close for %q ends %q", c.Fy, c.FyEnd)
	}
	if c.Version != len(c.Closings) || c.Version < 1 {
		return fail(PayloadInvalid, "fy_close version %d with %d closings", c.Version, len(c.Closings))
	}
	for i := range c.Closings {
		if err := verifyClosing(&c.Closings[i], i+1, c.FyEnd); err != nil {
			return err
		}
	}
	return nil
}

func nextYear(y string) string {
	b := []byte(y)
	for i := len(b) - 1; i >= 0; i-- {
		if b[i] < '9' {
			b[i]++
			return string(b)
		}
		b[i] = '0'
	}
	return "1" + string(b)
}

func verifyClosing(c *Closing, version int, fyEnd string) error {
	if c.Version != version {
		return fail(PayloadInvalid, "closing %d says version %d", version, c.Version)
	}
	var profit int64
	for _, b := range c.Balances {
		if b.Type != "income" && b.Type != "expense" {
			return fail(JournalMismatch, "closing %d names account %s of type %q", version, b.Code, b.Type)
		}
		profit -= b.NetPaise
	}
	j := c.Journal
	if j == nil {
		return expectEq(JournalMismatch, "closing with no journal leaves", nonZero(c.Balances), 0)
	}
	if j.Source != "closing" || j.EntryDate != fyEnd || j.DocDate != fyEnd || j.LatePosting || j.ReversalOf != nil {
		return fail(JournalMismatch, "closing journal %s is %s on %s; expected closing on %s", j.ID, j.Source, j.EntryDate, fyEnd)
	}
	net := map[string]int64{}
	for i, l := range j.Lines {
		if l.Party != nil || (l.Account.Role != "" && l.Account.Role != "retained_earnings") {
			return fail(JournalMismatch, "closing journal line %d posts to %q", i+1, l.Account.Role+l.Account.Code)
		}
		key := l.Account.Code
		if l.Account.Role == "retained_earnings" {
			key = "3300"
		}
		net[key] += l.DebitPaise - l.CreditPaise
	}
	for _, b := range c.Balances {
		if err := expectEq(JournalMismatch, "closing of "+b.Code, net[b.Code], -b.NetPaise); err != nil {
			return err
		}
		delete(net, b.Code)
	}
	if err := expectEq(JournalMismatch, "retained earnings", -net["3300"], profit); err != nil {
		return err
	}
	delete(net, "3300")
	for code, n := range net {
		if n != 0 {
			return fail(JournalMismatch, "closing journal moves %d on %s, which it does not close", n, code)
		}
	}
	return nil
}

func nonZero(bs []ClosingBalance) int64 {
	var n int64
	for _, b := range bs {
		if b.NetPaise != 0 {
			n++
		}
	}
	return n
}
