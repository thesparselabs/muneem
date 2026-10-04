package verify

import (
	"encoding/json"
	"regexp"
)

var dayRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func (j *Journal) totals() (debit, credit int64) {
	for _, l := range j.Lines {
		debit += l.DebitPaise
		credit += l.CreditPaise
	}
	return
}

// net is Σ debit − Σ credit over the lines that name this account role.
func (j *Journal) net(role string) int64 {
	var n int64
	for _, l := range j.Lines {
		if l.Account.Role == role {
			n += l.DebitPaise - l.CreditPaise
		}
	}
	return n
}

func (j *Journal) netOf(roles ...string) int64 {
	var n int64
	for _, r := range roles {
		n += j.net(r)
	}
	return n
}

var inputTaxRoles = []string{"input_cgst", "input_sgst", "input_igst", "input_cess"}

func (j *Journal) partyOn(role string) []*Party {
	var out []*Party
	for _, l := range j.Lines {
		if l.Account.Role == role {
			out = append(out, l.Party)
		}
	}
	return out
}

func balanced(j *Journal) error {
	if j == nil {
		return nil
	}
	if j.ID == "" || !dayRe.MatchString(j.EntryDate) || !dayRe.MatchString(j.DocDate) {
		return fail(PayloadInvalid, "journal %q needs an id, an entry date and a document date", j.ID)
	}
	if len(j.Lines) == 0 {
		return fail(JournalImbalance, "journal %s has no lines", j.ID)
	}
	for i, l := range j.Lines {
		if l.DebitPaise < 0 || l.CreditPaise < 0 {
			return fail(JournalImbalance, "journal %s line %d has a negative amount", j.ID, i+1)
		}
		if l.Account.Role == "" && l.Account.Code == "" {
			return fail(PayloadInvalid, "journal %s line %d names no account", j.ID, i+1)
		}
	}
	if d, c := j.totals(); d != c {
		return fail(JournalImbalance, "journal %s: debit %d, credit %d", j.ID, d, c)
	}
	return nil
}

// Balanced checks every journal an operation carries before any is projected.
func Balanced(js []*Journal) error { return allBalanced(js...) }

func allBalanced(js ...*Journal) error {
	for _, j := range js {
		if err := balanced(j); err != nil {
			return err
		}
	}
	return nil
}

func refs(js []Journal) []*Journal {
	out := make([]*Journal, len(js))
	for i := range js {
		out[i] = &js[i]
	}
	return out
}

// Journals lists every journal an operation carries, in the order the device posted them.
func Journals(entityType string, payload []byte) ([]*Journal, error) {
	if entityType == "fy_close" {
		c, err := DecodeFyClose(payload)
		if err != nil {
			return nil, err
		}
		return c.journals(), nil
	}
	if entityType == "journal_entry" {
		var j Journal
		if err := json.Unmarshal(payload, &j); err != nil {
			return nil, fail(PayloadInvalid, "journal: %v", err)
		}
		return []*Journal{&j}, nil
	}
	var p struct {
		Journal     *Journal  `json:"journal"`
		Corrections []Journal `json:"corrections"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, fail(PayloadInvalid, "%s: %v", entityType, err)
	}
	var out []*Journal
	if p.Journal != nil {
		out = append(out, p.Journal)
	}
	return append(out, refs(p.Corrections)...), nil
}
