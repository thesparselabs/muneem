package snapshot

import (
	"context"
	"io"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

func (s *Service) start(id, businessID string) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.slots <- struct{}{}
		defer func() { <-s.slots }()
		s.build(id, businessID)
	}()
}

func objectKey(businessID, id string) string {
	return "snapshots/" + businessID + "/" + id + ".ndjson.gz"
}

func (s *Service) build(id, businessID string) {
	ctx, cancel := context.WithTimeout(context.Background(), s.opt.BuildTimeout)
	defer cancel()
	key := objectKey(businessID, id)
	h, bytes, err := s.upload(ctx, businessID, key)
	finish := func(tx pgx.Tx) error {
		if err != nil {
			return markFailed(ctx, tx, id, err.Error())
		}
		return markReady(ctx, tx, id, h, key, bytes, time.Now().Add(s.opt.Expiry))
	}
	if txErr := s.db.WithTx(ctx, store.Scope{BusinessID: businessID}, finish); txErr != nil {
		s.log.Error("snapshot status not recorded", "snapshot_id", id, "business_id", businessID, "error", txErr)
	}
	if err != nil {
		s.log.Error("snapshot build failed", "alert", true, "snapshot_id", id, "business_id", businessID, "error", err)
		return
	}
	s.log.Info("snapshot built", "snapshot_id", id, "business_id", businessID, "as_of_seq", h.AsOfSeq, "bytes", bytes)
}

// upload pipes the bundle from one read snapshot of the database straight into the object store.
func (s *Service) upload(ctx context.Context, businessID, key string) (Header, int64, error) {
	pr, pw := io.Pipe()
	written := make(chan writeResult, 1)
	go func() {
		var h Header
		err := s.db.WithSnapshotTx(ctx, store.Scope{BusinessID: businessID}, func(tx pgx.Tx) error {
			var err error
			h, err = Write(ctx, pgSource{tx: tx, businessID: businessID}, businessID, pw)
			return err
		})
		pw.CloseWithError(err)
		written <- writeResult{h, err}
	}()
	body := &countingReader{r: pr}
	putErr := s.store.Put(ctx, key, body)
	pr.CloseWithError(io.ErrClosedPipe)
	w := <-written
	if putErr != nil {
		return w.h, 0, putErr
	}
	return w.h, body.n, w.err
}

type writeResult struct {
	h   Header
	err error
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
