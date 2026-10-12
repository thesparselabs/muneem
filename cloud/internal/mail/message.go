// Package mail composes a text email with one attachment and sends it through an SMTP relay (FR-085, ADR-0067).
package mail

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	netmail "net/mail"
	"strings"
	"time"
)

// Sender delivers one message; SMTP in production, a recorder in tests.
type Sender interface {
	Send(ctx context.Context, m Message) error
}

type Attachment struct {
	FileName    string
	ContentType string
	Content     []byte
}

type Message struct {
	ID         string // becomes the Message-ID's local part
	FromName   string
	To         string
	ReplyTo    string
	Subject    string
	Text       string
	Attachment Attachment
}

var ErrHeaderInjection = errors.New("a header value contains a line break")

// Address checks one bare recipient address, the only form a share sends to.
func Address(s string) (string, error) {
	a, err := netmail.ParseAddress(s)
	if err != nil || a.Name != "" || a.Address != s {
		return "", fmt.Errorf("not a single email address: %q", s)
	}
	return a.Address, nil
}

func headerSafe(values ...string) error {
	for _, v := range values {
		if strings.ContainsAny(v, "\r\n") {
			return ErrHeaderInjection
		}
	}
	return nil
}

// Compose renders m as RFC 5322 + MIME (multipart/mixed: a UTF-8 text part and a base64 attachment) from the relay's own
// address; the shop appears only as the display name and the Reply-To.
func Compose(from string, m Message, boundary string, date time.Time) ([]byte, error) {
	if err := headerSafe(from, m.ID, m.FromName, m.To, m.ReplyTo, m.Subject, m.Attachment.FileName, m.Attachment.ContentType, boundary); err != nil {
		return nil, err
	}
	var b bytes.Buffer
	header := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	header("From", (&netmail.Address{Name: m.FromName, Address: from}).String())
	header("To", (&netmail.Address{Address: m.To}).String())
	if m.ReplyTo != "" {
		header("Reply-To", (&netmail.Address{Address: m.ReplyTo}).String())
	}
	header("Subject", mime.QEncoding.Encode("utf-8", m.Subject))
	header("Date", date.UTC().Format(time.RFC1123Z))
	header("Message-ID", fmt.Sprintf("<%s@%s>", m.ID, domainOf(from)))
	header("MIME-Version", "1.0")
	header("Content-Type", mime.FormatMediaType("multipart/mixed", map[string]string{"boundary": boundary}))
	b.WriteString("\r\n")

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	header("Content-Type", "text/plain; charset=utf-8")
	header("Content-Transfer-Encoding", "quoted-printable")
	b.WriteString("\r\n")
	qp := quotedprintable.NewWriter(&b)
	if _, err := qp.Write([]byte(strings.ReplaceAll(m.Text, "\n", "\r\n"))); err != nil {
		return nil, err
	}
	if err := qp.Close(); err != nil {
		return nil, err
	}
	b.WriteString("\r\n")

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	header("Content-Type", mime.FormatMediaType(m.Attachment.ContentType, map[string]string{"name": m.Attachment.FileName}))
	header("Content-Transfer-Encoding", "base64")
	header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": m.Attachment.FileName}))
	b.WriteString("\r\n")
	encoded := base64.StdEncoding.EncodeToString(m.Attachment.Content)
	for len(encoded) > 76 {
		b.WriteString(encoded[:76] + "\r\n")
		encoded = encoded[76:]
	}
	b.WriteString(encoded + "\r\n")
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.Bytes(), nil
}

func domainOf(address string) string {
	if at := strings.LastIndexByte(address, '@'); at >= 0 {
		return address[at+1:]
	}
	return "localhost"
}
