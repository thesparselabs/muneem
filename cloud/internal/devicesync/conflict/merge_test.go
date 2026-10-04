package conflict

import (
	"reflect"
	"testing"
)

func product(version int, price float64, name, updatedAt string) Payload {
	return Payload{"id": "P", "name": name, "sellingPricePaise": price, "version": float64(version), "updatedAt": updatedAt}
}

func TestNewEntityIsStoredAsSent(t *testing.T) {
	out := Resolve(nil, Incoming{EntityType: "product", Payload: product(1, 100, "Soap", "t1"), Device: "A"})
	if out.Version != 1 || Differs(out.Payload, product(1, 100, "Soap", "t1")) || len(out.Fields) != 0 {
		t.Fatalf("got %+v", out)
	}
}

func TestWriteOnTheCurrentVersionReplacesIt(t *testing.T) {
	cur := &Current{Version: 1, Payload: product(1, 100, "Soap", "t1"), Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 120, "Soap", "t2"), Device: "B"})
	if out.Version != 2 || out.Payload["sellingPricePaise"] != 120.0 || len(out.Fields) != 0 {
		t.Fatalf("got %+v", out)
	}
}

func TestSupersededWritesKeepTheDevicesVersion(t *testing.T) {
	cur := &Current{Version: 1, Payload: product(1, 100, "Soap", "t1"), Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "product", Payload: product(4, 120, "Soap", "t2"), Device: "A"})
	if out.Version != 4 || Differs(out.Payload, product(4, 120, "Soap", "t2")) {
		t.Fatalf("got %+v", out)
	}
}

func TestPriceConflictKeepsTheCloudsValue(t *testing.T) {
	base := product(1, 100, "Soap", "t1")
	cur := &Current{Version: 2, Payload: product(2, 125, "Soap", "t2"), Writer: "A"}
	sent := product(2, 99, "Soap", "t3")
	out := Resolve(cur, Incoming{EntityType: "product", Payload: sent, Device: "B", Baseline: base})
	if out.Payload["sellingPricePaise"] != 125.0 || out.Version != 3 || !Differs(out.Payload, sent) {
		t.Fatalf("got %+v", out)
	}
	if len(out.Fields) != 1 || out.Fields[0].Rule != RuleCloudWins || out.Fields[0].Winner != winnerCloud {
		t.Fatalf("fields %+v", out.Fields)
	}
}

func TestUnconflictedFieldsFromAnOlderBaseApply(t *testing.T) {
	base := product(1, 100, "Soap", "t1")
	cur := &Current{Version: 2, Payload: product(2, 125, "Soap", "t2"), Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 100, "Soap Bar", "t3"), Device: "B", Baseline: base})
	if out.Payload["name"] != "Soap Bar" || out.Payload["sellingPricePaise"] != 125.0 || len(out.Fields) != 0 {
		t.Fatalf("got %+v", out)
	}
}

func TestSimpleFieldLastWriterWinsByUpdatedAt(t *testing.T) {
	base := product(1, 100, "Soap", "t1")
	cur := &Current{Version: 2, Payload: product(2, 100, "Soap Cake", "t5"), Writer: "A"}
	earlier := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 100, "Soap Bar", "t3"), Device: "B", Baseline: base})
	if earlier.Payload["name"] != "Soap Cake" || earlier.Fields[0].Winner != winnerCloud || earlier.Fields[0].Rule != RuleLastWriterWins {
		t.Fatalf("earlier write should lose: %+v", earlier)
	}
	later := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 100, "Soap Bar", "t9"), Device: "B", Baseline: base})
	if later.Payload["name"] != "Soap Bar" || later.Payload["updatedAt"] != "t9" || later.Fields[0].Winner != winnerDevice {
		t.Fatalf("later write should win: %+v", later)
	}
}

func TestEqualTimesGoToTheLargerDeviceID(t *testing.T) {
	base := product(1, 100, "Soap", "t1")
	cur := &Current{Version: 2, Payload: product(2, 100, "Soap Cake", "t5"), Writer: "B"}
	if out := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 100, "Soap Bar", "t5"), Device: "C", Baseline: base}); out.Payload["name"] != "Soap Bar" {
		t.Fatalf("C > B should win: %+v", out)
	}
	if out := Resolve(cur, Incoming{EntityType: "product", Payload: product(2, 100, "Soap Bar", "t5"), Device: "A", Baseline: base}); out.Payload["name"] != "Soap Cake" {
		t.Fatalf("A < B should lose: %+v", out)
	}
}

func TestConfigKeepsTheCloudsValueOnEveryField(t *testing.T) {
	base := Payload{"name": "Till 1", "version": 1.0}
	cur := &Current{Version: 2, Payload: Payload{"name": "Till A", "version": 2.0}, Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "terminal", Payload: Payload{"name": "Till B", "version": 2.0}, Device: "Z", Baseline: base})
	if out.Payload["name"] != "Till A" || out.Fields[0].Rule != RuleCloudWins {
		t.Fatalf("got %+v", out)
	}
}

func TestTombstoneWinsOverAConcurrentUpdate(t *testing.T) {
	cur := &Current{Version: 2, Payload: Payload{"id": "X"}, Deleted: true, Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "barcode", Payload: Payload{"id": "X", "code": "123"}, Device: "B"})
	if !out.Ignored || !out.Tombstone || !out.Delete || out.Version != 2 {
		t.Fatalf("got %+v", out)
	}
	live := &Current{Version: 1, Payload: Payload{"id": "X", "code": "123"}, Writer: "A"}
	if out := Resolve(live, Incoming{EntityType: "barcode", Tombstone: true, Payload: Payload{"id": "X"}, Device: "B"}); !out.Delete || out.Version != 2 {
		t.Fatalf("delete should apply: %+v", out)
	}
}

func TestUnversionedWritesReplace(t *testing.T) {
	cur := &Current{Version: 3, Payload: Payload{"code": "DEL1", "name": "Main"}, Writer: "A"}
	out := Resolve(cur, Incoming{EntityType: "warehouse", Payload: Payload{"code": "DEL1", "name": "Front"}, Device: "B"})
	if !reflect.DeepEqual(out.Payload, Payload{"code": "DEL1", "name": "Front"}) || out.Version != 4 {
		t.Fatalf("got %+v", out)
	}
}

func TestStalePriceItemsKeepTheCloudsPrices(t *testing.T) {
	cur := &Current{Version: 3, Payload: Payload{"items": []any{map[string]any{"id": "A2", "pricePaise": 12500.0}}, "retired": []any{"A1"}}}
	stale := Incoming{EntityType: "price_list_item", Payload: Payload{"items": []any{map[string]any{"id": "B2", "pricePaise": 9900.0}}, "retired": []any{"A1"}}}
	out := Resolve(cur, stale)
	if out.Version != 4 || len(out.Fields) != 1 || out.Fields[0].Rule != RuleCloudWins {
		t.Fatalf("stale edit should keep the cloud's prices: %+v", out)
	}
	if items := out.Payload["items"].([]any); items[0].(map[string]any)["id"] != "A2" {
		t.Fatalf("cloud items replaced: %v", items)
	}
	fresh := Incoming{EntityType: "price_list_item", Payload: Payload{"items": []any{map[string]any{"id": "B3"}}, "retired": []any{"A2"}}}
	if out := Resolve(cur, fresh); len(out.Fields) != 0 || out.Payload["items"].([]any)[0].(map[string]any)["id"] != "B3" {
		t.Fatalf("an edit of the current items should replace them: %+v", out)
	}
}

func TestAnErasedCustomerStaysErased(t *testing.T) {
	base := Payload{"id": "C", "name": "Ravi", "phone": "9876543210", "version": 1.0, "updatedAt": "t1"}
	erased := Payload{"id": "C", "name": "Erased customer", "version": 2.0, "updatedAt": "t2", "erasedAt": "t2"}
	cur := &Current{Version: 2, Payload: erased, Writer: "A"}
	stale := Payload{"id": "C", "name": "Ravi", "phone": "9876500000", "email": "r@x.in", "version": 2.0, "updatedAt": "t3"}
	out := Resolve(cur, Incoming{EntityType: "customer", Payload: stale, Device: "B", Baseline: base})
	if out.Version != 3 || out.Payload["phone"] != nil || out.Payload["email"] != nil || out.Payload["name"] != "Erased customer" {
		t.Fatalf("got %+v", out)
	}
	if len(out.Fields) != 1 || out.Fields[0].Field != erasedAtKey || out.Fields[0].Rule != RuleCloudWins {
		t.Fatalf("fields %+v", out.Fields)
	}
	again := Resolve(cur, Incoming{EntityType: "customer", Payload: Payload{"id": "C", "name": "Erased customer", "version": 3.0, "erasedAt": "t2"}, Device: "A"})
	if again.Version != 3 || len(again.Fields) != 0 {
		t.Fatalf("an erased write should apply as usual: %+v", again)
	}
}
