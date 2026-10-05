package health_test

import (
	"math"
	"sort"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

// series flattens a registry into `name{label="v",...}` → value, labels sorted by name.
func series(t *testing.T, reg *prometheus.Registry) map[string]float64 {
	t.Helper()
	families, err := reg.Gather()
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]float64{}
	for _, f := range families {
		for _, m := range f.GetMetric() {
			labels := make([]string, 0, len(m.GetLabel()))
			for _, l := range m.GetLabel() {
				labels = append(labels, l.GetName()+`="`+l.GetValue()+`"`)
			}
			sort.Strings(labels)
			out[f.GetName()+"{"+strings.Join(labels, ",")+"}"] = m.GetGauge().GetValue()
		}
	}
	return out
}

func value(t *testing.T, reg *prometheus.Registry, key string) *float64 {
	t.Helper()
	v, ok := series(t, reg)[key]
	if !ok {
		return nil
	}
	return &v
}

func expect(t *testing.T, reg *prometheus.Registry, want map[string]float64) {
	t.Helper()
	got := series(t, reg)
	for k, w := range want {
		if v, ok := got[k]; !ok || v != w {
			t.Errorf("%s = %v (present %v), want %v", k, v, ok, w)
		}
	}
}

// within checks an age gauge to a minute, since the seed is relative to the database's now().
func within(t *testing.T, reg *prometheus.Registry, key string, want float64) {
	t.Helper()
	v := value(t, reg, key)
	if v == nil || math.Abs(*v-want) > 60 {
		t.Errorf("%s = %v, want about %v", key, v, want)
	}
}
