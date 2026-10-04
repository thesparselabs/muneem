package devicesync_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
	"github.com/sparselabs/muneem/cloud/internal/devicesync/snapshot"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

func (c *cloud) bootstrap(d *testDevice, businessID string) (int, devicesync.Snapshot) {
	c.t.Helper()
	body, _ := json.Marshal(map[string]string{"businessId": businessID})
	return c.snapshotReply(c.do(d, http.MethodPost, "/v1/sync/bootstrap", nil, body))
}

func (c *cloud) snapshot(d *testDevice, id string) (int, devicesync.Snapshot) {
	c.t.Helper()
	return c.snapshotReply(c.do(d, http.MethodGet, "/v1/sync/bootstrap/"+id, nil, nil))
}

func (c *cloud) snapshotReply(code int, raw []byte) (int, devicesync.Snapshot) {
	var s devicesync.Snapshot
	if code == http.StatusOK {
		if err := json.Unmarshal(raw, &s); err != nil {
			c.t.Fatal(err)
		}
	}
	return code, s
}

// readySnapshot asks for a bundle, waits for the build and returns the ready snapshot.
func (c *cloud) readySnapshot(d *testDevice, businessID string) devicesync.Snapshot {
	c.t.Helper()
	code, s := c.bootstrap(d, businessID)
	if code != http.StatusOK {
		c.t.Fatalf("bootstrap: HTTP %d", code)
	}
	c.snaps.Wait()
	if code, s = c.snapshot(d, s.SnapshotID); code != http.StatusOK || s.Status != devicesync.SnapshotReady || s.URL == nil {
		c.t.Fatalf("snapshot: HTTP %d %+v", code, s)
	}
	return s
}

func download(t *testing.T, url, rangeHeader string) (int, []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, raw
}

// richFlow pushes the recorded flow plus a merged master edit (a review item), a cancelled payment and a voided
// barcode, so every stream and both kinds of op are in the bundle.
func richFlow(t *testing.T) (*cloud, flow, *testDevice) {
	c, f, a := setup(t)
	b := c.registerDevice()
	c.push(a, f.request(f.ops...))
	customer := f.find("customer")
	c.push(a, f.request(edited(t, customer, map[string]any{"name": "Ravi Kumar", "version": 2, "updatedAt": "2026-10-04T11:00:00.000Z"})))
	c.push(b, f.request(edited(t, customer, map[string]any{"name": "Ravi K", "version": 2, "updatedAt": "2026-10-04T10:30:00.000Z"})))
	payment := f.find("payment")
	c.pushOne(a, f.request(newOp("payment", payment.EntityID, "cancel", map[string]any{"id": payment.EntityID, "status": "cancelled", "reason": "bounced", "journal": nil})))
	bc := barcode(f.find("product").EntityID, "8901234567890")
	c.push(a, f.request(bc))
	c.push(a, f.request(newOp("barcode", bc.EntityID, "void", map[string]any{"id": bc.EntityID, "productId": f.find("product").EntityID})))
	return c, f, a
}

func TestBootstrapBundleReplaysToTheCloudsState(t *testing.T) {
	c, f, a := richFlow(t)
	newcomer := c.registerDevice()
	code, first := c.bootstrap(newcomer, f.businessID)
	if code != http.StatusOK || first.Status != devicesync.SnapshotBuilding || first.URL != nil {
		t.Fatalf("a new member device should start a build: HTTP %d %+v", code, first)
	}
	c.snaps.Wait()
	_, s := c.snapshot(newcomer, first.SnapshotID)
	maxSeq := int64(c.count(`SELECT MAX(seq)::int FROM change_log WHERE business_id = $1`, f.businessID))
	if s.Status != devicesync.SnapshotReady || s.AsOfSeq == nil || *s.AsOfSeq != maxSeq || s.ExpiresAt == nil ||
		s.ExpiresAt.After(time.Now().Add(time.Hour+time.Minute)) {
		t.Fatalf("ready snapshot %+v, max seq %d", s, maxSeq)
	}
	status, raw := download(t, *s.URL, "")
	if status != http.StatusOK || int64(len(raw)) != *s.Bytes {
		t.Fatalf("download: HTTP %d, %d bytes of %d", status, len(raw), *s.Bytes)
	}
	if status, tail := download(t, *s.URL, "bytes=10-"); status != http.StatusPartialContent || !bytes.Equal(tail, raw[10:]) {
		t.Fatalf("a resumed download should get the rest: HTTP %d", status)
	}
	h, changes, err := snapshot.Decode(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	assertHeader(t, h, f.businessID, maxSeq, changes)
	assertStreamOrder(t, changes)
	assertDocumentsAreTheChangeLog(t, c, a, f.businessID, changes)
	if got, want := replay(changes), c.entityState(f.businessID); !reflect.DeepEqual(got, want) {
		t.Fatalf("the bundle replays to\n%v\nbut entity_state is\n%v", got, want)
	}
	if got, want := replay(changes), replay(c.pullAll(a, f.businessID)); !reflect.DeepEqual(got, want) {
		t.Fatal("the bundle and a full pull should replay to the same state")
	}
}

func assertHeader(t *testing.T, h snapshot.Header, businessID string, asOf int64, changes []devicesync.Change) {
	t.Helper()
	perStream := map[string]int64{}
	for _, ch := range changes {
		perStream[ch.Stream]++
	}
	if h.Format != "muneem-bundle" || h.Version != 1 || h.BusinessID != businessID || h.AsOfSeq != asOf || !reflect.DeepEqual(h.Counts, perStream) {
		t.Fatalf("header %+v, lines per stream %v", h, perStream)
	}
	for _, stream := range devicesync.StreamOrder {
		if perStream[stream] == 0 {
			t.Fatalf("no %s changes in the bundle", stream)
		}
	}
}

func assertStreamOrder(t *testing.T, changes []devicesync.Change) {
	t.Helper()
	rank := func(ch devicesync.Change) int { return slices.Index(devicesync.StreamOrder, ch.Stream) }
	for i := 1; i < len(changes); i++ {
		if rank(changes[i]) < rank(changes[i-1]) {
			t.Fatalf("line %d (%s) comes after %s", i+2, changes[i].Stream, changes[i-1].Stream)
		}
	}
	sawProduct := false
	for _, ch := range changes {
		sawProduct = sawProduct || ch.EntityType == "product"
		if ch.EntityType == "barcode" && !sawProduct {
			t.Fatal("a barcode came before its product")
		}
	}
}

func assertDocumentsAreTheChangeLog(t *testing.T, c *cloud, d *testDevice, businessID string, changes []devicesync.Change) {
	t.Helper()
	var bundled []devicesync.Change
	versions := map[int]bool{}
	for _, ch := range changes {
		if ch.Stream == devicesync.StreamDocuments {
			bundled = append(bundled, ch)
			if ch.EntityType == "payment" {
				versions[ch.Version] = true
			}
		}
	}
	if !versions[1] || !versions[2] {
		t.Fatalf("the cancelled payment should carry both versions, got %v", versions)
	}
	if pulled := c.pullStream(d, businessID, devicesync.StreamDocuments); !reflect.DeepEqual(normalize(bundled), normalize(pulled)) {
		t.Fatal("the bundle's documents should be the documents change log, in seq order")
	}
}

func (c *cloud) pullStream(d *testDevice, businessID, stream string) []devicesync.Change {
	var out []devicesync.Change
	for since := int64(0); ; {
		_, page := c.pull(d, businessID, stream, since)
		out = append(out, page.Changes...)
		if !page.HasMore {
			return out
		}
		since = page.NextSeq
	}
}

func (c *cloud) pullAll(d *testDevice, businessID string) []devicesync.Change {
	var out []devicesync.Change
	for _, stream := range devicesync.StreamOrder {
		out = append(out, c.pullStream(d, businessID, stream)...)
	}
	return out
}

type entityKey struct{ Type, ID string }

type entityValue struct {
	Version int
	Deleted bool
	Payload any
}

// replay applies changes the way a device does: per entity, the last line wins.
func replay(changes []devicesync.Change) map[entityKey]entityValue {
	out := map[entityKey]entityValue{}
	for _, ch := range changes {
		var p any
		_ = json.Unmarshal(ch.Payload, &p)
		out[entityKey{ch.EntityType, ch.EntityID}] = entityValue{Version: ch.Version, Deleted: ch.Op == "delete", Payload: p}
	}
	return out
}

func (c *cloud) entityState(businessID string) map[entityKey]entityValue {
	c.t.Helper()
	rows, err := c.db.Pool.Query(context.Background(), `SELECT entity_type, entity_id, version, deleted_at IS NOT NULL, payload FROM entity_state
		WHERE business_id = $1`, businessID)
	if err != nil {
		c.t.Fatal(err)
	}
	defer rows.Close()
	out := map[entityKey]entityValue{}
	for rows.Next() {
		var k entityKey
		var v entityValue
		var raw json.RawMessage
		if err := rows.Scan(&k.Type, &k.ID, &v.Version, &v.Deleted, &raw); err != nil {
			c.t.Fatal(err)
		}
		_ = json.Unmarshal(raw, &v.Payload)
		out[k] = v
	}
	return out
}

func normalize(changes []devicesync.Change) []map[string]any {
	out := make([]map[string]any, 0, len(changes))
	for _, ch := range changes {
		raw, _ := json.Marshal(ch)
		var m map[string]any
		_ = json.Unmarshal(raw, &m)
		out = append(out, m)
	}
	return out
}

func TestBootstrapReusesARecentBundle(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	_, building := c.bootstrap(a, f.businessID)
	if _, again := c.bootstrap(a, f.businessID); again.SnapshotID != building.SnapshotID {
		t.Fatal("a second request while building should share the build")
	}
	c.snaps.Wait()
	c.push(a, f.request(edited(t, f.find("customer"), map[string]any{"name": "Ravi Kumar", "version": 2})))
	if ready := c.readySnapshot(a, f.businessID); ready.SnapshotID != building.SnapshotID {
		t.Fatal("a bundle fewer than 1,000 changes behind should be reused")
	}
	if _, err := c.db.Pool.Exec(context.Background(), `UPDATE snapshot SET as_of_seq = as_of_seq - 1001`); err != nil {
		t.Fatal(err)
	}
	fresh := c.readySnapshot(a, f.businessID)
	maxSeq := int64(c.count(`SELECT MAX(seq)::int FROM change_log WHERE business_id = $1`, f.businessID))
	if fresh.SnapshotID == building.SnapshotID || *fresh.AsOfSeq != maxSeq {
		t.Fatalf("a bundle too far behind should be rebuilt: %+v", fresh)
	}
}

func TestBootstrapIsForMembersDevicesOnly(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	s := c.readySnapshot(a, f.businessID)
	stranger := c.stranger()
	if code, _ := c.bootstrap(stranger, f.businessID); code != http.StatusNotFound {
		t.Fatalf("stranger bootstrap: HTTP %d", code)
	}
	if code, _ := c.snapshot(stranger, s.SnapshotID); code != http.StatusNotFound {
		t.Fatalf("stranger snapshot: HTTP %d", code)
	}
	if code, _ := c.snapshot(a, ulid.Make().String()); code != http.StatusNotFound {
		t.Fatalf("unknown snapshot: HTTP %d", code)
	}
	elsewhere := c.registerDevice()
	other := &store.Business{ID: ulid.Make().String(), OrganizationID: c.org, Name: "Other shop", BusinessType: "retail", StateCode: "27",
		TaxScheme: "regular", FyStartMonth: 4, CreatedBy: c.user}
	err := c.db.WithTx(context.Background(), store.Scope{}, func(tx pgx.Tx) error {
		if err := store.InsertBusiness(context.Background(), tx, other); err != nil {
			return err
		}
		_, err := tx.Exec(context.Background(), `UPDATE device SET business_id = $2 WHERE id = $1`, elsewhere.id, other.ID)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if code, _ := c.bootstrap(elsewhere, f.businessID); code != http.StatusNotFound {
		t.Fatalf("a device bound to another business: HTTP %d", code)
	}
}

// Under the API role a member finds a snapshot by id with no business scope yet (0003); anyone else does not.
func TestSnapshotRowsAreVisibleToMembersOnly(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	s := c.readySnapshot(a, f.businessID)
	stranger := c.stranger()
	visible := func(userID string) int {
		var n int
		err := c.db.WithTx(context.Background(), store.Scope{UserID: userID}, func(tx pgx.Tx) error {
			if _, err := tx.Exec(context.Background(), "SET LOCAL ROLE muneem_api"); err != nil {
				return err
			}
			return tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM snapshot WHERE id = $1`, s.SnapshotID).Scan(&n)
		})
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
	if visible(a.user) != 1 || visible(stranger.user) != 0 {
		t.Fatal("snapshot rows should be readable by the business's members only")
	}
}

type brokenStore struct{}

func (brokenStore) Put(_ context.Context, _ string, body io.Reader) error {
	_, _ = io.CopyN(io.Discard, body, 10)
	return errors.New("bucket unreachable")
}

func (brokenStore) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("unused")
}

func TestABuildThatCannotUploadFails(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	svc := snapshot.NewService(c.db, brokenStore{}, slog.New(slog.NewTextHandler(io.Discard, nil)), snapshot.DefaultOptions)
	caller := devicesync.Caller{UserID: a.user, DeviceID: a.id}
	s, err := svc.Request(context.Background(), caller, f.businessID)
	if err != nil {
		t.Fatal(err)
	}
	svc.Wait()
	if s, err = svc.Get(context.Background(), caller, s.SnapshotID); err != nil || s.Status != devicesync.SnapshotFailed || s.URL != nil {
		t.Fatalf("%+v %v", s, err)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM snapshot WHERE status = 'failed' AND error LIKE '%bucket unreachable%'`); n != 1 {
		t.Fatal("the failure should be recorded with its reason")
	}
}

// stuckStore never finishes an upload until its context ends.
type stuckStore struct{ brokenStore }

func (stuckStore) Put(ctx context.Context, _ string, _ io.Reader) error {
	<-ctx.Done()
	return ctx.Err()
}

func TestShutdownCancelsABuildPastTheDeadlineAndRecordsItFailed(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	svc := snapshot.NewService(c.db, stuckStore{}, slog.New(slog.NewTextHandler(io.Discard, nil)), snapshot.DefaultOptions)
	caller := devicesync.Caller{UserID: a.user, DeviceID: a.id}
	if _, err := svc.Request(context.Background(), caller, f.businessID); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	if err := svc.Shutdown(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("shutdown: %v", err)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM snapshot WHERE status = 'failed'`); n != 1 {
		t.Fatal("a build cut off by shutdown should be recorded as failed")
	}
}

func TestShutdownWaitsForARunningBuild(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	caller := devicesync.Caller{UserID: a.user, DeviceID: a.id}
	if _, err := c.snaps.Request(context.Background(), caller, f.businessID); err != nil {
		t.Fatal(err)
	}
	if err := c.snaps.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM snapshot WHERE status = 'ready'`); n != 1 {
		t.Fatal("shutdown should let the build finish")
	}
}
