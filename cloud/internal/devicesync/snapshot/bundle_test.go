package snapshot_test

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/snapshot"
	"github.com/sparselabs/muneem/cloud/internal/objectstore"
)

// fakeSource hands out changes per stream, already in the order the database would give them.
type fakeSource struct {
	streams map[string][]devicesync.Change
	fail    error
}

func (f fakeSource) Watermark(context.Context) (int64, error) {
	var max int64
	for _, cs := range f.streams {
		for _, c := range cs {
			max = maxInt(max, c.Seq)
		}
	}
	return max, nil
}

func maxInt(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func (f fakeSource) Count(_ context.Context, stream string, _ int64) (int64, error) {
	return int64(len(f.streams[stream])), nil
}

func (f fakeSource) Each(_ context.Context, stream string, _ int64, emit func(devicesync.Change) error) error {
	for _, c := range f.streams[stream] {
		if err := emit(c); err != nil {
			return err
		}
	}
	if stream == devicesync.StreamDocuments {
		return f.fail
	}
	return nil
}

func change(seq int64, stream, entityType, id, op string, version int, payload string) devicesync.Change {
	return devicesync.Change{Seq: seq, Stream: stream, EntityType: entityType, EntityID: id, Op: op, Version: version, Payload: json.RawMessage(payload)}
}

func sample() fakeSource {
	return fakeSource{streams: map[string][]devicesync.Change{
		devicesync.StreamDocuments: {
			change(5, "documents", "sale", "S1", "upsert", 1, `{"id":"S1","status":"posted"}`),
			change(9, "documents", "sale", "S1", "upsert", 2, `{"id":"S1","status":"cancelled"}`),
		},
		devicesync.StreamMasters: {
			change(3, "masters", "uom", "U1", "upsert", 1, `{"id":"U1"}`),
			change(8, "masters", "product", "P1", "upsert", 2, `{"id":"P1","name":"Tea"}`),
			change(7, "masters", "barcode", "B1", "delete", 2, `{"id":"B1"}`),
		},
		devicesync.StreamConfig:  {change(1, "config", "business", "BIZ", "upsert", 1, `{"id":"BIZ"}`)},
		devicesync.StreamControl: {change(6, "control", "accounting_period", "AP1", "upsert", 1, `{"id":"AP1"}`)},
	}}
}

func TestBundleIsAHeaderThenEveryStreamInOrder(t *testing.T) {
	var buf bytes.Buffer
	h, err := snapshot.Write(context.Background(), sample(), "BIZ", &buf)
	if err != nil {
		t.Fatal(err)
	}
	got, changes, err := snapshot.Decode(&buf)
	if err != nil {
		t.Fatal(err)
	}
	want := snapshot.Header{Format: "muneem-bundle", Version: 1, BusinessID: "BIZ", AsOfSeq: 9,
		Counts: map[string]int64{"control": 1, "config": 1, "masters": 3, "documents": 2}}
	if !equalJSON(t, got, want) || !equalJSON(t, h, want) {
		t.Fatalf("header %+v", got)
	}
	var order []string
	for _, c := range changes {
		order = append(order, c.EntityID)
	}
	if !equalJSON(t, order, []string{"AP1", "BIZ", "U1", "P1", "B1", "S1", "S1"}) {
		t.Fatalf("order %v", order)
	}
	if changes[4].Op != "delete" || string(changes[6].Payload) != `{"id":"S1","status":"cancelled"}` || changes[5].Version != 1 {
		t.Fatalf("a delete and both versions of the cancelled sale should pass through: %+v", changes[4:])
	}
}

func TestBundleIsOneValidGzipStream(t *testing.T) {
	var buf bytes.Buffer
	if _, err := snapshot.Write(context.Background(), sample(), "BIZ", &buf); err != nil {
		t.Fatal(err)
	}
	gz, err := gzip.NewReader(&buf)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := io.ReadAll(gz)
	if err != nil {
		t.Fatal(err)
	}
	if lines := bytes.Count(raw, []byte("\n")); lines != 8 || raw[len(raw)-1] != '\n' {
		t.Fatalf("%d newline-terminated lines, want 8", lines)
	}
}

func TestBundleStopsOnASourceError(t *testing.T) {
	src := sample()
	src.fail = errors.New("connection lost")
	if _, err := snapshot.Write(context.Background(), src, "BIZ", io.Discard); err == nil {
		t.Fatal("a source error must fail the build")
	}
}

func TestMemoryStoreServesRanges(t *testing.T) {
	m := objectstore.NewMemory()
	srv := httptest.NewServer(m)
	defer srv.Close()
	m.BaseURL = srv.URL
	if err := m.Put(context.Background(), "a/b.gz", bytes.NewReader([]byte("0123456789"))); err != nil {
		t.Fatal(err)
	}
	url, err := m.PresignGet(context.Background(), "a/b.gz", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Range", "bytes=4-")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if body, _ := io.ReadAll(res.Body); res.StatusCode != http.StatusPartialContent || string(body) != "456789" {
		t.Fatalf("HTTP %d %q", res.StatusCode, body)
	}
}

func equalJSON(t *testing.T, a, b any) bool {
	t.Helper()
	x, err := json.Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	y, err := json.Marshal(b)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.Equal(x, y)
}
