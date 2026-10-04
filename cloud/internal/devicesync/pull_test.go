package devicesync_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/store"
)

func TestPullPagesOneStreamInSeqOrder(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	var seen []string
	since, pages := int64(0), 0
	for {
		code, page := c.pullLimit(a, f.businessID, "masters", since, 4)
		if code != http.StatusOK {
			t.Fatalf("HTTP %d", code)
		}
		pages++
		for _, ch := range page.Changes {
			if ch.Stream != "masters" || ch.Seq <= since {
				t.Fatalf("out of stream or order: %+v", ch)
			}
			seen = append(seen, ch.EntityType)
		}
		since = page.NextSeq
		if !page.HasMore {
			break
		}
	}
	if len(seen) != 15 || pages != 4 {
		t.Fatalf("got %d changes in %d pages", len(seen), pages)
	}
	if code, page := c.pull(a, f.businessID, "masters", since); code != http.StatusOK || len(page.Changes) != 0 || page.NextSeq != since {
		t.Fatalf("an empty page should keep the cursor: %+v", page)
	}
	if n := c.count(`SELECT COALESCE(last_pull_seq, 0)::int FROM device WHERE id = $1`, a.id); int64(n) != since {
		t.Fatalf("last_pull_seq %d, want %d", n, since)
	}
}

func TestPullRefusesNonMembersAndBadParameters(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.find("business")))
	stranger := c.stranger()
	if code, _ := c.pull(stranger, f.businessID, "masters", 0); code != http.StatusNotFound {
		t.Fatalf("stranger: HTTP %d", code)
	}
	if code, _ := c.pullLimit(a, f.businessID, "masters", 0, 501); code != http.StatusUnprocessableEntity && code != http.StatusBadRequest {
		t.Fatalf("limit 501: HTTP %d", code)
	}
	if code, _ := c.pull(a, f.businessID, "everything", 0); code != http.StatusUnprocessableEntity && code != http.StatusBadRequest {
		t.Fatalf("bad stream: HTTP %d", code)
	}
}

// Row-level security keeps one business's changes out of another's transactions under the API role.
func TestChangeLogIsTenantScoped(t *testing.T) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	visible := func(businessID string) int {
		var n int
		err := c.db.WithTx(context.Background(), store.Scope{BusinessID: businessID}, func(tx pgx.Tx) error {
			if _, err := tx.Exec(context.Background(), "SET LOCAL ROLE muneem_api"); err != nil {
				return err
			}
			return tx.QueryRow(context.Background(), `SELECT (SELECT COUNT(*) FROM change_log) + (SELECT COUNT(*) FROM entity_state)`).Scan(&n)
		})
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
	if visible(f.businessID) == 0 || visible(ulid.Make().String()) != 0 {
		t.Fatal("change_log/entity_state are not scoped to the business")
	}
}
