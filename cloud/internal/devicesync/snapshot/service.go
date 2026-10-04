package snapshot

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// ObjectStore is where bundles live; objectstore.S3 in production, objectstore.Memory in tests.
type ObjectStore interface {
	Put(ctx context.Context, key string, body io.Reader) error
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
}

type Options struct {
	ReuseWithin  int64         // a ready bundle at most this many changes behind is handed out again
	Expiry       time.Duration // how long a ready bundle is handed out
	URLTTL       time.Duration // the presigned URL's lifetime
	BuildTimeout time.Duration // a build running longer is failed
	Workers      int           // builds running at once
}

var DefaultOptions = Options{ReuseWithin: 1000, Expiry: 24 * time.Hour, URLTTL: time.Hour, BuildTimeout: 15 * time.Minute, Workers: 2}

// Service implements devicesync.Snapshots: it records a building row, builds in the background, and presigns.
type Service struct {
	db    *store.DB
	store ObjectStore
	log   *slog.Logger
	opt   Options
	slots chan struct{}
	wg    sync.WaitGroup
}

func NewService(db *store.DB, objects ObjectStore, log *slog.Logger, opt Options) *Service {
	return &Service{db: db, store: objects, log: log, opt: opt, slots: make(chan struct{}, opt.Workers)}
}

// Wait blocks until every started build has finished.
func (s *Service) Wait() { s.wg.Wait() }

func scope(c devicesync.Caller, businessID string) store.Scope {
	return store.Scope{UserID: c.UserID, BusinessID: businessID, DeviceID: c.DeviceID}
}

func (s *Service) Request(ctx context.Context, c devicesync.Caller, businessID string) (*devicesync.Snapshot, error) {
	var r *row
	started := false
	err := s.db.WithTx(ctx, scope(c, businessID), func(tx pgx.Tx) error {
		if err := devicesync.CanBootstrap(ctx, tx, c, businessID); err != nil {
			return err
		}
		var err error
		if r, err = s.reuse(ctx, tx, businessID); err != nil || r != nil {
			return err
		}
		started = true
		r, err = insertBuilding(ctx, tx, ulid.Make().String(), businessID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if started {
		s.start(r.ID, businessID)
	}
	return s.view(ctx, r)
}

func (s *Service) reuse(ctx context.Context, tx pgx.Tx, businessID string) (*row, error) {
	if err := lockRequests(ctx, tx, businessID); err != nil {
		return nil, err
	}
	seq, err := currentSeq(ctx, tx, businessID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	return reusable(ctx, tx, businessID, seq-s.opt.ReuseWithin, now.Add(-s.opt.BuildTimeout), now.Add(s.opt.URLTTL))
}

func (s *Service) Get(ctx context.Context, c devicesync.Caller, snapshotID string) (*devicesync.Snapshot, error) {
	var r *row
	err := s.db.WithTx(ctx, scope(c, ""), func(tx pgx.Tx) error {
		var err error
		if r, err = byID(ctx, tx, snapshotID); err != nil {
			return err
		}
		if r == nil {
			return devicesync.ErrSnapshotNotFound
		}
		return devicesync.CanBootstrap(ctx, tx, c, r.BusinessID)
	})
	if errors.Is(err, devicesync.ErrNotMember) {
		return nil, devicesync.ErrSnapshotNotFound
	}
	if err != nil {
		return nil, err
	}
	return s.view(ctx, r)
}

// view is the wire Snapshot; a ready one carries a fresh presigned URL, expiring with the URL or the bundle.
func (s *Service) view(ctx context.Context, r *row) (*devicesync.Snapshot, error) {
	out := &devicesync.Snapshot{SnapshotID: r.ID, Status: r.status(time.Now().Add(-s.opt.BuildTimeout))}
	if out.Status != devicesync.SnapshotReady {
		return out, nil
	}
	expires := time.Now().Add(s.opt.URLTTL).UTC().Truncate(time.Second)
	if r.ExpiresAt.Before(expires) {
		expires = r.ExpiresAt.UTC()
	}
	if !expires.After(time.Now()) {
		out.Status = devicesync.SnapshotFailed
		return out, nil
	}
	url, err := s.store.PresignGet(ctx, *r.ObjectKey, time.Until(expires))
	if err != nil {
		return nil, err
	}
	out.URL, out.AsOfSeq, out.Bytes, out.ExpiresAt = &url, r.AsOfSeq, r.Bytes, &expires
	return out, nil
}
