// Package share emails a document a device sends on a shop's behalf (FR-085, ADR-0067): one PDF to one recipient,
// once per share id, at most DailyLimit a day per business. The PDF passes through and is never stored.
package share

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/mail"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

type Options struct {
	MaxBytes   int // the decoded PDF; the 2 MiB request limit holds its base64
	DailyLimit int // emails a business may send in any 24 hours
}

var DefaultOptions = Options{MaxBytes: 1 << 20, DailyLimit: 500}

var (
	ErrUnconfigured = errors.New("no SMTP relay is configured")
	ErrRateLimited  = errors.New("the business has sent its emails for today")
	ErrSendFailed   = errors.New("the SMTP relay did not take the message")
	ErrNotMember    = devicesync.ErrNotMember
)

type Caller = devicesync.Caller

type Email struct {
	ShareID    string
	BusinessID string
	To         string
	ReplyTo    string
	FromName   string
	Subject    string
	Text       string
	FileName   string
	PDF        []byte
}

type Service struct {
	db     *store.DB
	sender mail.Sender
	log    *slog.Logger
	opt    Options
}

// NewService takes a nil sender when no relay is configured; Send then fails with ErrUnconfigured.
func NewService(db *store.DB, sender mail.Sender, log *slog.Logger, opt Options) *Service {
	return &Service{db: db, sender: sender, log: log, opt: opt}
}

func (s *Service) MaxBytes() int { return s.opt.MaxBytes }

// Send relays e once. A share already sent answers with its first sent time; one still marked sending (a crash or a
// relay failure after the claim) is sent again, so a share is delivered at least once and, once acknowledged, never twice.
func (s *Service) Send(ctx context.Context, c Caller, e Email) (time.Time, error) {
	if s.sender == nil {
		return time.Time{}, ErrUnconfigured
	}
	scope := store.Scope{UserID: c.UserID, BusinessID: e.BusinessID, DeviceID: c.DeviceID}
	var sentAt *time.Time
	err := s.db.WithTx(ctx, scope, func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, e.BusinessID); err != nil {
			return err
		}
		prior, err := sentAtOf(ctx, tx, e.BusinessID, e.ShareID)
		if err != nil || prior != nil {
			sentAt = prior
			return err
		}
		n, err := sentSince(ctx, tx, e.BusinessID, time.Now().Add(-24*time.Hour))
		if err != nil {
			return err
		}
		if n >= s.opt.DailyLimit {
			return ErrRateLimited
		}
		return claim(ctx, tx, e.BusinessID, e.ShareID, c.DeviceID, e.To, len(e.PDF))
	})
	if err != nil || sentAt != nil {
		return deref(sentAt), err
	}
	msg := mail.Message{ID: e.ShareID, FromName: e.FromName, To: e.To, ReplyTo: e.ReplyTo, Subject: e.Subject, Text: e.Text,
		Attachment: mail.Attachment{FileName: e.FileName, ContentType: "application/pdf", Content: e.PDF}}
	if err := s.sender.Send(ctx, msg); err != nil {
		s.log.Warn("share email not relayed", "business_id", e.BusinessID, "share_id", e.ShareID, "error", err)
		return time.Time{}, fmt.Errorf("%w: %v", ErrSendFailed, err)
	}
	var at time.Time
	err = s.db.WithTx(ctx, scope, func(tx pgx.Tx) error {
		var err error
		at, err = markSent(ctx, tx, e.BusinessID, e.ShareID)
		return err
	})
	return at, err
}

func deref(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
