package deploycheck_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.yaml.in/yaml/v3"

	"github.com/sparselabs/muneem/cloud/internal/health"
	"github.com/sparselabs/muneem/cloud/internal/metrics"
)

const repo = "../../../"

func read(t *testing.T, rel string) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(repo, rel))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func parseYAML(t *testing.T, rel string, into any) {
	t.Helper()
	if err := yaml.Unmarshal(read(t, rel), into); err != nil {
		t.Fatalf("%s: %v", rel, err)
	}
}

// exported is every metric family name the API serves, read from a registry with each family touched once.
func exported(t *testing.T) map[string]bool {
	t.Helper()
	m := metrics.New()
	pool, err := pgxpool.New(context.Background(), "postgres://nobody@127.0.0.1:1/none")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	m.WatchPool(pool)
	m.ObserveRequest("GET", "/v1/health", 200, time.Millisecond)
	m.OperationResult("applied", "")
	m.DeadLettered("X")
	m.ObserveJob("j", "ok", time.Millisecond)
	m.ReadyCheck("postgres", true)
	g := health.NewGauges(m.Registry)
	now := time.Now()
	one := int64(1)
	g.SetBusinesses(now, []health.Business{{BusinessID: "b"}})
	g.SetDevices(now, []health.Device{{BusinessID: "b", DeviceID: "d", LastSeenAt: &now}})
	g.SetRejections([]health.Rejection{{BusinessID: "b", Code: "X"}})
	g.SetUnbalanced(nil, []health.Imbalance{{BusinessID: "b"}})
	g.SetIntegrity(now, []health.DeviceIntegrity{{BusinessID: "b", DeviceID: "d", JournalCountDiff: &one, DebitDiffPaise: &one, CreditDiffPaise: &one}})
	g.Succeeded("businesses", now)
	families, err := m.Registry.Gather()
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, f := range families {
		names[f.GetName()] = true
	}
	return names
}

var metricName = regexp.MustCompile(`\bmuneem_[a-z0-9_]+`)

func checkMetrics(t *testing.T, where, expr string, known map[string]bool) {
	t.Helper()
	for _, name := range metricName.FindAllString(expr, -1) {
		base := name
		for _, suffix := range []string{"_bucket", "_count", "_sum"} {
			if trimmed, ok := strings.CutSuffix(name, suffix); ok && known[trimmed] {
				base = trimmed
			}
		}
		if !known[base] {
			t.Errorf("%s uses %s, which the API does not export", where, name)
		}
	}
}

type alertRules struct {
	APIVersion int `yaml:"apiVersion"`
	Groups     []struct {
		Name     string `yaml:"name"`
		Interval string `yaml:"interval"`
		Rules    []struct {
			UID       string `yaml:"uid"`
			Title     string `yaml:"title"`
			Condition string `yaml:"condition"`
			For       string `yaml:"for"`
			Data      []struct {
				RefID         string         `yaml:"refId"`
				DatasourceUID string         `yaml:"datasourceUid"`
				Model         map[string]any `yaml:"model"`
			} `yaml:"data"`
			Labels      map[string]string `yaml:"labels"`
			Annotations map[string]string `yaml:"annotations"`
		} `yaml:"rules"`
	} `yaml:"groups"`
}

func TestEveryAlertIsWellFormedAndHasARunbook(t *testing.T) {
	var rules alertRules
	parseYAML(t, "deploy/monitoring/grafana/provisioning/alerting/rules.yml", &rules)
	known := exported(t)
	seen := map[string]bool{}
	count := 0
	for _, g := range rules.Groups {
		if _, err := time.ParseDuration(g.Interval); err != nil {
			t.Errorf("group %s interval %q", g.Name, g.Interval)
		}
		for _, r := range g.Rules {
			count++
			if seen[r.UID] || !strings.HasPrefix(r.UID, "muneem-") || len(r.UID) > 40 {
				t.Errorf("uid %q is duplicate, unprefixed or too long", r.UID)
			}
			seen[r.UID] = true
			if _, err := time.ParseDuration(r.For); err != nil {
				t.Errorf("%s: for %q", r.UID, r.For)
			}
			if r.Labels["severity"] != "critical" && r.Labels["severity"] != "warning" {
				t.Errorf("%s: severity %q", r.UID, r.Labels["severity"])
			}
			runbook := strings.TrimPrefix(r.UID, "muneem-") + ".md"
			if !strings.HasSuffix(r.Annotations["runbook_url"], "/docs/runbooks/"+runbook) {
				t.Errorf("%s: runbook_url %q", r.UID, r.Annotations["runbook_url"])
			}
			if _, err := os.Stat(filepath.Join(repo, "docs/runbooks", runbook)); err != nil {
				t.Errorf("%s: no runbook docs/runbooks/%s", r.UID, runbook)
			}
			if r.Annotations["summary"] == "" || strings.Contains(r.Annotations["summary"], "$") {
				t.Errorf("%s: summary missing, or uses $ (provisioning would read it as an environment variable)", r.UID)
			}
			refs := map[string]string{}
			for _, d := range r.Data {
				refs[d.RefID] = d.DatasourceUID
				if expr, ok := d.Model["expr"].(string); ok {
					checkMetrics(t, r.UID, expr, known)
				}
			}
			if refs["A"] != "prometheus" && refs["A"] != "loki" || refs[r.Condition] != "__expr__" {
				t.Errorf("%s: data %v, condition %s", r.UID, refs, r.Condition)
			}
		}
	}
	if count < 15 {
		t.Fatalf("only %d alert rules", count)
	}
}

func TestEveryRunbookBelongsToAnAlert(t *testing.T) {
	raw := string(read(t, "deploy/monitoring/grafana/provisioning/alerting/rules.yml"))
	pages, _ := filepath.Glob(filepath.Join(repo, "docs/runbooks/*.md"))
	for _, p := range pages {
		name := strings.TrimSuffix(filepath.Base(p), ".md")
		if name != "README" && !strings.Contains(raw, `"muneem-`+name+`"`) {
			t.Errorf("runbook %s has no alert", name)
		}
	}
}

type dashboard struct {
	UID    string `json:"uid"`
	Title  string `json:"title"`
	Panels []struct {
		Title      string                   `json:"title"`
		Datasource map[string]string        `json:"datasource"`
		GridPos    struct{ X, Y, W, H int } `json:"gridPos"`
		Targets    []struct {
			Expr string `json:"expr"`
		} `json:"targets"`
	} `json:"panels"`
}

func TestDashboardsParseAndUseExportedMetrics(t *testing.T) {
	known := exported(t)
	files, _ := filepath.Glob(filepath.Join(repo, "deploy/monitoring/grafana/dashboards/*.json"))
	if len(files) < 4 {
		t.Fatalf("%d dashboards", len(files))
	}
	uids := map[string]bool{}
	for _, f := range files {
		raw, _ := os.ReadFile(f)
		var d dashboard
		if err := json.Unmarshal(raw, &d); err != nil {
			t.Fatalf("%s: %v", f, err)
		}
		if d.UID == "" || uids[d.UID] || len(d.Panels) == 0 {
			t.Errorf("%s: uid %q duplicate or empty, %d panels", f, d.UID, len(d.Panels))
		}
		uids[d.UID] = true
		for _, p := range d.Panels {
			if p.GridPos.X+p.GridPos.W > 24 || p.GridPos.W == 0 {
				t.Errorf("%s / %s: gridPos %+v", d.UID, p.Title, p.GridPos)
			}
			if uid := p.Datasource["uid"]; uid != "prometheus" && uid != "loki" {
				t.Errorf("%s / %s: datasource %q", d.UID, p.Title, uid)
			}
			for _, target := range p.Targets {
				checkMetrics(t, d.UID+" / "+p.Title, target.Expr, known)
			}
		}
	}
}

func TestProvisioningAndServiceConfigsParse(t *testing.T) {
	var datasources struct {
		Datasources []struct{ UID, Type, URL string } `yaml:"datasources"`
	}
	parseYAML(t, "deploy/monitoring/grafana/provisioning/datasources/datasources.yml", &datasources)
	uids := map[string]string{}
	for _, d := range datasources.Datasources {
		uids[d.UID] = d.Type
	}
	if uids["prometheus"] != "prometheus" || uids["loki"] != "loki" {
		t.Fatalf("datasource uids %v", uids)
	}
	var parsed any
	for _, f := range []string{"deploy/monitoring/grafana/provisioning/dashboards/dashboards.yml", "deploy/monitoring/grafana/provisioning/alerting/notifications.yml",
		"deploy/monitoring/prometheus/prometheus.yml", "deploy/monitoring/prometheus/targets/api.yml.example", "deploy/monitoring/loki/loki.yml",
		"deploy/monitoring/docker-compose.monitoring.yml", "deploy/monitoring/docker-compose.agent.yml"} {
		parseYAML(t, f, &parsed)
	}
}

// The metrics port must never be reachable through Caddy or bound publicly by default.
func TestMetricsStayOffThePublicPath(t *testing.T) {
	var compose struct {
		Services map[string]struct {
			Ports       []string          `yaml:"ports"`
			Environment map[string]string `yaml:"environment"`
		} `yaml:"services"`
	}
	parseYAML(t, "deploy/docker-compose.prod.yml", &compose)
	api := compose.Services["api"]
	if len(api.Ports) != 1 || !strings.HasPrefix(api.Ports[0], "${MUNEEM_METRICS_BIND:-127.0.0.1}:9090:") {
		t.Fatalf("api ports %v", api.Ports)
	}
	if api.Environment["MUNEEM_METRICS_ADDR"] == "" {
		t.Fatal("MUNEEM_METRICS_ADDR not set for the container")
	}
	for _, caddyfile := range []string{"deploy/Caddyfile", "deploy/monitoring/Caddyfile"} {
		if strings.Contains(string(read(t, caddyfile)), "9090") {
			t.Fatalf("%s proxies the metrics port", caddyfile)
		}
	}
}
