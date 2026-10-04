package backups

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/objectstore"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// ObjectStore is where encrypted backups live; objectstore.S3 in production, objectstore.Memory in tests.
type ObjectStore interface {
	PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error)
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	Get(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
}

type Options struct {
	Keep       int           // ready backups kept per business
	URLTTL     time.Duration // presigned PUT and GET lifetime
	StaleAfter time.Duration // a pending backup never confirmed is removed after this
	MaxBytes   int64
}

var DefaultOptions = Options{Keep: 30, URLTTL: time.Hour, StaleAfter: 24 * time.Hour, MaxBytes: 4 << 30}

var (
	ErrNotFound     = errors.New("backup not found")
	ErrNotUploaded  = errors.New("backup object not uploaded")
	ErrChecksum     = errors.New("backup object does not match its size and checksum")
	ErrKeyConflict  = errors.New("a different key is escrowed under that key id")
	ErrKeyNotFound  = errors.New("no escrowed key")
	ErrTooLarge     = errors.New("backup too large")
	ErrUnconfigured = errors.New("backups are not configured")
	ErrNotMember    = devicesync.ErrNotMember
)

type Caller = devicesync.Caller

type Service struct {
	db      *store.DB
	objects ObjectStore
	wrapper *Wrapper
	log     *slog.Logger
	opt     Options
}

// NewService takes nil objects or wrapper when that half is not configured; its calls then fail with ErrUnconfigured.
func NewService(db *store.DB, objects ObjectStore, wrapper *Wrapper, log *slog.Logger, opt Options) *Service {
	return &Service{db: db, objects: objects, wrapper: wrapper, log: log, opt: opt}
}

func scope(c Caller, businessID string) store.Scope {
	return store.Scope{UserID: c.UserID, BusinessID: businessID, DeviceID: c.DeviceID}
}

type Upload struct {
	BackupID  string
	URL       string
	ExpiresAt time.Time
}

type PresignInput struct {
	BusinessID    string
	Bytes         int64
	SHA256        string
	KeyID         string
	SchemaVersion int
}

// Presign records a pending backup and hands back a PUT URL; its key must already be escrowed, or it could never be restored.
func (s *Service) Presign(ctx context.Context, c Caller, in PresignInput) (*Upload, error) {
	if s.objects == nil {
		return nil, ErrUnconfigured
	}
	if in.Bytes > s.opt.MaxBytes {
		return nil, ErrTooLarge
	}
	b := row{ID: ulid.Make().String(), BusinessID: in.BusinessID, DeviceID: c.DeviceID, Bytes: in.Bytes, SHA256: in.SHA256, KeyID: in.KeyID, SchemaVersion: in.SchemaVersion}
	b.ObjectKey = "backups/" + in.BusinessID + "/" + b.ID + ".mbk"
	err := s.db.WithTx(ctx, scope(c, in.BusinessID), func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, in.BusinessID); err != nil {
			return err
		}
		k, err := getKey(ctx, tx, in.BusinessID, &in.KeyID)
		if err != nil {
			return err
		}
		if k == nil {
			return ErrKeyNotFound
		}
		return insertPending(ctx, tx, b)
	})
	if err != nil {
		return nil, err
	}
	expires := time.Now().Add(s.opt.URLTTL).UTC().Truncate(time.Second)
	url, err := s.objects.PresignPut(ctx, b.ObjectKey, time.Until(expires))
	if err != nil {
		return nil, err
	}
	return &Upload{BackupID: b.ID, URL: url, ExpiresAt: expires}, nil
}

// Confirm checks the stored object against the size and SHA-256 the device declared, then prunes past the newest Keep.
func (s *Service) Confirm(ctx context.Context, c Caller, backupID string) (*row, error) {
	if s.objects == nil {
		return nil, ErrUnconfigured
	}
	b, err := s.memberRow(ctx, c, backupID)
	if err != nil {
		return nil, err
	}
	if b.DeviceID != c.DeviceID {
		return nil, ErrNotFound
	}
	if b.Status == "ready" {
		return b, nil
	}
	if err := s.check(ctx, b); err != nil {
		if errors.Is(err, ErrChecksum) {
			s.discard(ctx, c, *b)
		}
		return nil, err
	}
	var ready *row
	var gone []row
	err = s.db.WithTx(ctx, scope(c, b.BusinessID), func(tx pgx.Tx) error {
		var err error
		if ready, err = markReady(ctx, tx, b.ID); err != nil {
			return err
		}
		if gone, err = expired(ctx, tx, b.BusinessID, s.opt.Keep, time.Now().Add(-s.opt.StaleAfter)); err != nil {
			return err
		}
		for _, g := range gone {
			if err := deleteRow(ctx, tx, g.ID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, g := range gone {
		if err := s.objects.Delete(ctx, g.ObjectKey); err != nil {
			s.log.Warn("pruned backup object not deleted", "backup_id", g.ID, "error", err)
		}
	}
	return ready, nil
}

func (s *Service) check(ctx context.Context, b *row) error {
	body, size, err := s.objects.Get(ctx, b.ObjectKey)
	if errors.Is(err, objectstore.ErrNotFound) {
		return ErrNotUploaded
	}
	if err != nil {
		return err
	}
	defer body.Close()
	if size != b.Bytes {
		return ErrChecksum
	}
	h := sha256.New()
	if _, err := io.Copy(h, body); err != nil {
		return err
	}
	if hex.EncodeToString(h.Sum(nil)) != b.SHA256 {
		return ErrChecksum
	}
	return nil
}

func (s *Service) discard(ctx context.Context, c Caller, b row) {
	err := s.db.WithTx(ctx, scope(c, b.BusinessID), func(tx pgx.Tx) error { return deleteRow(ctx, tx, b.ID) })
	if err == nil {
		err = s.objects.Delete(ctx, b.ObjectKey)
	}
	if err != nil {
		s.log.Warn("mismatched backup not discarded", "backup_id", b.ID, "error", err)
	}
}

func (s *Service) List(ctx context.Context, c Caller, businessID string) ([]row, error) {
	var out []row
	err := s.db.WithTx(ctx, scope(c, businessID), func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, businessID); err != nil {
			return err
		}
		var err error
		out, err = listReady(ctx, tx, businessID)
		return err
	})
	return out, err
}

type Download struct {
	row
	URL       string
	ExpiresAt time.Time
}

func (s *Service) Get(ctx context.Context, c Caller, backupID string) (*Download, error) {
	if s.objects == nil {
		return nil, ErrUnconfigured
	}
	b, err := s.memberRow(ctx, c, backupID)
	if err != nil {
		return nil, err
	}
	if b.Status != "ready" {
		return nil, ErrNotFound
	}
	expires := time.Now().Add(s.opt.URLTTL).UTC().Truncate(time.Second)
	url, err := s.objects.PresignGet(ctx, b.ObjectKey, time.Until(expires))
	if err != nil {
		return nil, err
	}
	return &Download{row: *b, URL: url, ExpiresAt: expires}, nil
}

// memberRow reads a backup by id for a member's device; another business's backup reads as not found.
func (s *Service) memberRow(ctx context.Context, c Caller, backupID string) (*row, error) {
	var b *row
	err := s.db.WithTx(ctx, scope(c, ""), func(tx pgx.Tx) error {
		var err error
		if b, err = byID(ctx, tx, backupID); err != nil {
			return err
		}
		if b == nil {
			return ErrNotFound
		}
		return devicesync.CanBootstrap(ctx, tx, c, b.BusinessID)
	})
	if errors.Is(err, ErrNotMember) {
		return nil, ErrNotFound
	}
	return b, err
}

// Escrow stores a data key once per (business, key id); sending the same key again succeeds.
func (s *Service) Escrow(ctx context.Context, c Caller, businessID, keyID string, key []byte) error {
	if s.wrapper == nil {
		return ErrUnconfigured
	}
	version, nonce, wrapped, err := s.wrapper.Wrap(businessID, keyID, key)
	if err != nil {
		return err
	}
	err = s.db.WithTx(ctx, scope(c, businessID), func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, businessID); err != nil {
			return err
		}
		if err := insertKey(ctx, tx, businessID, keyID, c.DeviceID, version, nonce, wrapped); err != nil {
			return err
		}
		stored, err := getKey(ctx, tx, businessID, &keyID)
		if err != nil {
			return err
		}
		have, err := s.wrapper.Unwrap(stored.Version, businessID, keyID, stored.Nonce, stored.Wrapped)
		if err != nil {
			return err
		}
		if subtle.ConstantTimeCompare(have, key) != 1 {
			return ErrKeyConflict
		}
		return nil
	})
	if err == nil {
		s.log.Info("backup key escrowed", "business_id", businessID, "key_id", keyID, "device_id", c.DeviceID)
	}
	return err
}

// Key hands a member's device an escrowed key: the one named, or the business's first.
func (s *Service) Key(ctx context.Context, c Caller, businessID string, keyID *string) (string, []byte, error) {
	if s.wrapper == nil {
		return "", nil, ErrUnconfigured
	}
	var k *wrappedKey
	err := s.db.WithTx(ctx, scope(c, businessID), func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, businessID); err != nil {
			return err
		}
		var err error
		k, err = getKey(ctx, tx, businessID, keyID)
		return err
	})
	if err != nil {
		return "", nil, err
	}
	if k == nil {
		return "", nil, ErrKeyNotFound
	}
	key, err := s.wrapper.Unwrap(k.Version, businessID, k.KeyID, k.Nonce, k.Wrapped)
	if err != nil {
		return "", nil, err
	}
	s.log.Info("backup key released", "business_id", businessID, "key_id", k.KeyID, "device_id", c.DeviceID)
	return k.KeyID, key, nil
}
