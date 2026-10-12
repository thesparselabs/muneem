package mail_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	netmail "net/mail"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/sparselabs/muneem/cloud/internal/mail"
)

var pdf = append([]byte("%PDF-1.7\n"), bytes.Repeat([]byte{0xfe, 0x00, 0x41}, 200)...)

func message() mail.Message {
	return mail.Message{
		ID: "01JSHARE0000000000000000AA", FromName: "शर्मा स्टोर", To: "meena@example.com", ReplyTo: "shop@example.com",
		Subject: "Invoice DE01/2627/000042 — ₹1,430.00", Text: "Dear Meena,\nYour invoice is attached.\nThank you!",
		Attachment: mail.Attachment{FileName: "invoice-DE01_2627_000042.pdf", ContentType: "application/pdf", Content: pdf},
	}
}

func TestComposeIsOneTextPartAndThePDF(t *testing.T) {
	raw, err := mail.Compose("no-reply@muneem.app", message(), "b0und4ry", time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	msg, err := netmail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	from, err := msg.Header.AddressList("From")
	if err != nil || from[0].Name != "शर्मा स्टोर" || from[0].Address != "no-reply@muneem.app" {
		t.Fatalf("from = %v (%v)", from, err)
	}
	if got := msg.Header.Get("Reply-To"); got != "<shop@example.com>" {
		t.Fatalf("reply-to = %q", got)
	}
	subject, _ := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if subject != "Invoice DE01/2627/000042 — ₹1,430.00" {
		t.Fatalf("subject = %q", subject)
	}
	if msg.Header.Get("Message-ID") != "<01JSHARE0000000000000000AA@muneem.app>" {
		t.Fatalf("message-id = %q", msg.Header.Get("Message-ID"))
	}
	_, params, _ := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	parts := multipart.NewReader(msg.Body, params["boundary"])
	text, err := parts.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(quotedprintable.NewReader(text))
	if string(body) != "Dear Meena,\r\nYour invoice is attached.\r\nThank you!" {
		t.Fatalf("text = %q", body)
	}
	att, err := parts.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if att.FileName() != "invoice-DE01_2627_000042.pdf" {
		t.Fatalf("filename = %q", att.FileName())
	}
	decoded, _ := io.ReadAll(base64.NewDecoder(base64.StdEncoding, att))
	if !bytes.Equal(decoded, pdf) {
		t.Fatal("the attachment does not round-trip")
	}
	for _, line := range strings.Split(string(raw), "\r\n") {
		if len(line) > 998 {
			t.Fatalf("a line is longer than RFC 5322 allows: %d", len(line))
		}
	}
}

func TestComposeRefusesALineBreakInAHeader(t *testing.T) {
	for _, mutate := range []func(*mail.Message){
		func(m *mail.Message) { m.Subject = "Invoice\r\nBcc: victim@example.com" },
		func(m *mail.Message) { m.FromName = "Shop\nX-Evil: 1" },
		func(m *mail.Message) { m.Attachment.FileName = "a\r\n.pdf" },
	} {
		m := message()
		mutate(&m)
		if _, err := mail.Compose("no-reply@muneem.app", m, "b", time.Now()); !errors.Is(err, mail.ErrHeaderInjection) {
			t.Fatalf("expected ErrHeaderInjection, got %v", err)
		}
	}
}

func TestAddressTakesOneBareAddressOnly(t *testing.T) {
	if a, err := mail.Address("meena@example.com"); err != nil || a != "meena@example.com" {
		t.Fatalf("got %q %v", a, err)
	}
	for _, bad := range []string{"", "meena", "Meena <meena@example.com>", "a@example.com, b@example.com", " meena@example.com"} {
		if _, err := mail.Address(bad); err == nil {
			t.Fatalf("%q accepted", bad)
		}
	}
}

func TestSMTPFromEnv(t *testing.T) {
	if s, err := mail.SMTPFromEnv("", ""); s != nil || err != nil {
		t.Fatalf("no URL must mean no relay, got %v %v", s, err)
	}
	s, err := mail.SMTPFromEnv("smtps://apikey:s3cret@smtp.example.com", "bills@muneem.app")
	if err != nil || s.Host != "smtp.example.com" || s.Port != "465" || !s.ImplicitTLS || s.Username != "apikey" || s.Password != "s3cret" || s.From != "bills@muneem.app" {
		t.Fatalf("got %+v %v", s, err)
	}
	if s, _ := mail.SMTPFromEnv("smtp://relay.example.com", "bills@muneem.app"); s.Port != "587" || s.ImplicitTLS {
		t.Fatalf("smtp:// defaults to 587 with STARTTLS, got %+v", s)
	}
	for _, bad := range [][2]string{{"http://x.example.com", "a@b.c"}, {"smtp://", "a@b.c"}, {"smtp://relay.example.com", "Shop <a@b.c>"}} {
		if _, err := mail.SMTPFromEnv(bad[0], bad[1]); err == nil {
			t.Fatalf("%v accepted", bad)
		}
	}
}

type relay struct {
	addr     string
	auth     string
	from, to string
	data     []byte
	done     chan struct{}
}

// A plain-text relay on loopback that speaks just enough SMTP for one message (net/smtp allows PLAIN on localhost).
func startRelay(t *testing.T) *relay {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	r := &relay{addr: ln.Addr().String(), done: make(chan struct{})}
	go func() {
		defer close(r.done)
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		tp := textproto.NewConn(conn)
		_ = tp.PrintfLine("220 relay.test ESMTP")
		for {
			line, err := tp.ReadLine()
			if err != nil {
				return
			}
			verb := strings.ToUpper(strings.SplitN(line, " ", 2)[0])
			switch {
			case verb == "EHLO":
				_ = tp.PrintfLine("250-relay.test")
				_ = tp.PrintfLine("250 AUTH PLAIN")
			case verb == "AUTH":
				r.auth = line
				_ = tp.PrintfLine("235 2.7.0 accepted")
			case verb == "MAIL":
				r.from = line
				_ = tp.PrintfLine("250 ok")
			case verb == "RCPT":
				r.to = line
				_ = tp.PrintfLine("250 ok")
			case verb == "DATA":
				_ = tp.PrintfLine("354 go ahead")
				r.data, _ = tp.ReadDotBytes()
				_ = tp.PrintfLine("250 queued")
			case verb == "QUIT":
				_ = tp.PrintfLine("221 bye")
				return
			default:
				_ = tp.PrintfLine("502 not here")
			}
		}
	}()
	return r
}

func TestSMTPDeliversThroughTheRelay(t *testing.T) {
	r := startRelay(t)
	host, port, _ := net.SplitHostPort(r.addr)
	s := &mail.SMTP{Host: host, Port: port, Username: "apikey", Password: "s3cret", From: "bills@muneem.app", Timeout: 5 * time.Second}
	if err := s.Send(context.Background(), message()); err != nil {
		t.Fatal(err)
	}
	<-r.done
	if r.from != "MAIL FROM:<bills@muneem.app>" || r.to != "RCPT TO:<meena@example.com>" {
		t.Fatalf("envelope %q / %q", r.from, r.to)
	}
	creds, _ := base64.StdEncoding.DecodeString(strings.TrimPrefix(r.auth, "AUTH PLAIN "))
	if string(creds) != "\x00apikey\x00s3cret" {
		t.Fatalf("auth %q", creds)
	}
	msg, err := netmail.ReadMessage(bytes.NewReader(r.data))
	if err != nil || !strings.Contains(msg.Header.Get("From"), "bills@muneem.app") {
		t.Fatalf("relayed message: %v", err)
	}
}

func TestSMTPFailsWhenTheRelayIsDown(t *testing.T) {
	ln, _ := net.Listen("tcp", "127.0.0.1:0")
	addr := ln.Addr().String()
	ln.Close()
	host, port, _ := net.SplitHostPort(addr)
	s := &mail.SMTP{Host: host, Port: port, From: "bills@muneem.app", Timeout: 2 * time.Second}
	if err := s.Send(context.Background(), message()); err == nil {
		t.Fatal("a closed relay must fail the send")
	}
}
