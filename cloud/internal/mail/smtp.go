package mail

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"net/url"
	"time"
)

// SMTP relays through one server: smtp:// upgrades with STARTTLS when offered, smtps:// is TLS from the first byte.
type SMTP struct {
	Host        string
	Port        string
	Username    string
	Password    string
	From        string
	ImplicitTLS bool
	Timeout     time.Duration
	TLSConfig   *tls.Config // nil: verify the server's certificate for Host
	Now         func() time.Time
}

// SMTPFromEnv reads MUNEEM_SMTP_URL (smtp://user:pass@host:587 or smtps://user:pass@host:465) and MUNEEM_MAIL_FROM;
// an empty URL means no relay (nil, nil), and the share route answers 503.
func SMTPFromEnv(rawURL, from string) (*SMTP, error) {
	if rawURL == "" {
		return nil, nil
	}
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "smtp" && u.Scheme != "smtps") || u.Hostname() == "" {
		return nil, fmt.Errorf("MUNEEM_SMTP_URL must look like smtp://user:pass@host:587 or smtps://user:pass@host:465")
	}
	addr, err := Address(from)
	if err != nil {
		return nil, fmt.Errorf("MUNEEM_MAIL_FROM: %w", err)
	}
	s := &SMTP{Host: u.Hostname(), Port: u.Port(), From: addr, ImplicitTLS: u.Scheme == "smtps", Timeout: 30 * time.Second}
	if s.Port == "" {
		s.Port = map[bool]string{true: "465", false: "587"}[s.ImplicitTLS]
	}
	if u.User != nil {
		s.Username = u.User.Username()
		s.Password, _ = u.User.Password()
	}
	return s, nil
}

func (s *SMTP) Send(ctx context.Context, m Message) error {
	body, err := Compose(s.From, m, boundary(), s.now())
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, s.Timeout)
	defer cancel()
	conn, err := s.dial(ctx)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp greeting: %w", err)
	}
	defer c.Close()
	if !s.ImplicitTLS {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(s.tlsConfig()); err != nil {
				return fmt.Errorf("smtp starttls: %w", err)
			}
		}
	}
	if s.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(s.From); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := c.Rcpt(m.To); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(body); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp end of data: %w", err)
	}
	return c.Quit()
}

func (s *SMTP) dial(ctx context.Context) (net.Conn, error) {
	addr := net.JoinHostPort(s.Host, s.Port)
	if s.ImplicitTLS {
		return (&tls.Dialer{Config: s.tlsConfig()}).DialContext(ctx, "tcp", addr)
	}
	return (&net.Dialer{}).DialContext(ctx, "tcp", addr)
}

func (s *SMTP) tlsConfig() *tls.Config {
	if s.TLSConfig != nil {
		return s.TLSConfig
	}
	return &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
}

func (s *SMTP) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func boundary() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "muneem-" + hex.EncodeToString(b)
}
