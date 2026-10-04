// Package snapshot builds hydration bundles (LLD §7.3, ADR-0038): gzipped NDJSON of a business's changes, a header
// line first, uploaded to object storage and handed out by presigned URL.
package snapshot

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"io"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

const (
	Format  = "muneem-bundle"
	Version = 1
)

// Header is BundleHeader in packages/contracts/src/sync/protocol.ts; Counts are change lines per stream.
type Header struct {
	Format     string           `json:"format"`
	Version    int              `json:"version"`
	BusinessID string           `json:"businessId"`
	AsOfSeq    int64            `json:"asOfSeq"`
	Counts     map[string]int64 `json:"counts"`
}

// Source reads one consistent view of a business's changes.
type Source interface {
	Watermark(ctx context.Context) (int64, error)
	Count(ctx context.Context, stream string, asOf int64) (int64, error)
	Each(ctx context.Context, stream string, asOf int64, emit func(devicesync.Change) error) error
}

// Write streams the bundle to w: the header, then every stream in STREAM_ORDER.
func Write(ctx context.Context, src Source, businessID string, w io.Writer) (Header, error) {
	h, err := header(ctx, src, businessID)
	if err != nil {
		return h, err
	}
	gz := gzip.NewWriter(w)
	enc := json.NewEncoder(gz)
	if err := enc.Encode(h); err != nil {
		return h, err
	}
	for _, stream := range devicesync.StreamOrder {
		if err := src.Each(ctx, stream, h.AsOfSeq, func(c devicesync.Change) error { return enc.Encode(c) }); err != nil {
			return h, err
		}
	}
	return h, gz.Close()
}

func header(ctx context.Context, src Source, businessID string) (Header, error) {
	h := Header{Format: Format, Version: Version, BusinessID: businessID, Counts: map[string]int64{}}
	asOf, err := src.Watermark(ctx)
	if err != nil {
		return h, err
	}
	h.AsOfSeq = asOf
	for _, stream := range devicesync.StreamOrder {
		if h.Counts[stream], err = src.Count(ctx, stream, asOf); err != nil {
			return h, err
		}
	}
	return h, nil
}
