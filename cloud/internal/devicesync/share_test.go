package devicesync_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/mail"
)

// mailbox records what the share route hands the relay; fail makes the relay refuse.
type mailbox struct {
	mu   sync.Mutex
	sent []mail.Message
	fail bool
}

func (m *mailbox) Send(_ context.Context, msg mail.Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fail {
		return errors.New("relay down")
	}
	m.sent = append(m.sent, msg)
	return nil
}

func (m *mailbox) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.sent)
}

var invoicePDF = []byte("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n")

func shareRequest(businessID string) api.ShareEmailRequest {
	reply := "shop@example.com"
	return api.ShareEmailRequest{
		ShareId: ulid.Make().String(), BusinessId: businessID, To: "meena@example.com", ReplyTo: &reply, FromName: "Sharma Store",
		Subject: "Invoice DE01/2627/000042 from Sharma Store", Text: "Dear Meena,\nYour invoice is attached.",
		Attachment: api.ShareAttachment{FileName: "invoice-DE01_2627_000042.pdf", ContentBase64: base64.StdEncoding.EncodeToString(invoicePDF)},
	}
}

func (c *cloud) shareEmail(d *testDevice, r api.ShareEmailRequest) (int, api.ShareEmailResult, string) {
	body, _ := json.Marshal(r)
	code, raw := c.do(d, http.MethodPost, "/v1/share/email", nil, body)
	var res api.ShareEmailResult
	if code == http.StatusOK {
		_ = json.Unmarshal(raw, &res)
	}
	var e api.ErrorResponse
	_ = json.Unmarshal(raw, &e)
	return code, res, e.Error.Code
}

func TestAShareIsEmailedOnceAndARetryIsAnsweredWithoutASecond(t *testing.T) {
	c, a, businessID := backupSetup(t)
	r := shareRequest(businessID)
	code, first, _ := c.shareEmail(a, r)
	if code != http.StatusOK || first.Status != api.Sent || first.ShareId != r.ShareId {
		t.Fatalf("HTTP %d %+v", code, first)
	}
	if c.mails.count() != 1 {
		t.Fatalf("relayed %d", c.mails.count())
	}
	got := c.mails.sent[0]
	if got.ID != r.ShareId || got.To != "meena@example.com" || got.ReplyTo != "shop@example.com" || got.FromName != "Sharma Store" ||
		got.Attachment.FileName != r.Attachment.FileName || got.Attachment.ContentType != "application/pdf" || !bytes.Equal(got.Attachment.Content, invoicePDF) {
		t.Fatalf("relayed %+v", got)
	}
	code, again, _ := c.shareEmail(a, r)
	if code != http.StatusOK || !again.SentAt.Equal(first.SentAt) || c.mails.count() != 1 {
		t.Fatalf("a retried share must not send twice: HTTP %d %+v, relayed %d", code, again, c.mails.count())
	}
	if n := c.count(`SELECT count(*)::int FROM share_email WHERE business_id = $1 AND status = 'sent' AND device_id = $2`, businessID, a.id); n != 1 {
		t.Fatalf("share_email rows %d", n)
	}
}

func TestARelayFailureIsTransientAndTheRetrySends(t *testing.T) {
	c, a, businessID := backupSetup(t)
	r := shareRequest(businessID)
	c.mails.fail = true
	if code, _, errCode := c.shareEmail(a, r); code != http.StatusBadGateway || errCode != "MAIL_SEND_FAILED" {
		t.Fatalf("HTTP %d %s", code, errCode)
	}
	c.mails.fail = false
	if code, res, _ := c.shareEmail(a, r); code != http.StatusOK || res.Status != api.Sent || c.mails.count() != 1 {
		t.Fatalf("HTTP %d %+v, relayed %d", code, res, c.mails.count())
	}
}

func TestOnlyAMembersDeviceMayEmailForTheBusiness(t *testing.T) {
	c, _, businessID := backupSetup(t)
	if code, _, errCode := c.shareEmail(c.stranger(), shareRequest(businessID)); code != http.StatusNotFound || errCode != "NOT_FOUND" {
		t.Fatalf("a stranger: HTTP %d %s", code, errCode)
	}
	if c.mails.count() != 0 {
		t.Fatal("nothing may be relayed for a stranger")
	}
}

func TestAShareEmailIsCheckedBeforeAnythingIsRelayed(t *testing.T) {
	c, a, businessID := backupSetup(t)
	bad := map[string]func(*api.ShareEmailRequest){
		"two recipients":     func(r *api.ShareEmailRequest) { r.To = "a@example.com, b@example.com" },
		"a named recipient":  func(r *api.ShareEmailRequest) { r.To = "Meena <meena@example.com>" },
		"a header injection": func(r *api.ShareEmailRequest) { r.Subject = "Invoice\r\nBcc: victim@example.com" },
		"a bad reply-to":     func(r *api.ShareEmailRequest) { s := "not-an-address"; r.ReplyTo = &s },
		"not a PDF": func(r *api.ShareEmailRequest) {
			r.Attachment.ContentBase64 = base64.StdEncoding.EncodeToString([]byte("<html>"))
		},
		"a path in the name": func(r *api.ShareEmailRequest) { r.Attachment.FileName = "../../etc/passwd.pdf" },
		"not a ULID":         func(r *api.ShareEmailRequest) { r.ShareId = "share-1" },
		"a long subject":     func(r *api.ShareEmailRequest) { r.Subject = strings.Repeat("x", 201) },
		"too large": func(r *api.ShareEmailRequest) {
			r.Attachment.ContentBase64 = base64.StdEncoding.EncodeToString(append([]byte("%PDF-"), make([]byte, 1<<20)...))
		},
	}
	for name, mutate := range bad {
		r := shareRequest(businessID)
		mutate(&r)
		if code, _, errCode := c.shareEmail(a, r); code != http.StatusUnprocessableEntity && code != http.StatusRequestEntityTooLarge {
			t.Errorf("%s: HTTP %d %s", name, code, errCode)
		}
	}
	if c.mails.count() != 0 {
		t.Fatalf("relayed %d bad requests", c.mails.count())
	}
}

func TestABusinessStopsAtItsDailyLimit(t *testing.T) {
	c, a, businessID := backupSetup(t)
	if _, err := c.db.Pool.Exec(context.Background(), `INSERT INTO share_email (business_id, share_id, device_id, recipient, bytes, status, sent_at)
		SELECT $1, 'S' || g, $2, 'x@example.com', 10, 'sent', now() FROM generate_series(1, 500) g`, businessID, a.id); err != nil {
		t.Fatal(err)
	}
	if code, _, errCode := c.shareEmail(a, shareRequest(businessID)); code != http.StatusTooManyRequests || errCode != "RATE_LIMITED" {
		t.Fatalf("HTTP %d %s", code, errCode)
	}
	if c.mails.count() != 0 {
		t.Fatal("nothing is relayed past the limit")
	}
}
