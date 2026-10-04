// Package metrics owns the API's Prometheus registry (ADR-0053); it is served only on the internal metrics port.
package metrics

import (
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

const namespace = "muneem"

// Metrics implements the observer interfaces the domain packages declare, so none of them imports Prometheus.
type Metrics struct {
	Registry *prometheus.Registry

	httpRequests *prometheus.CounterVec
	httpDuration *prometheus.HistogramVec
	ingestOps    *prometheus.CounterVec
	deadLetters  *prometheus.CounterVec
	jobRuns      *prometheus.CounterVec
	jobDuration  *prometheus.HistogramVec
	readyCheck   *prometheus.GaugeVec
}

func New() *Metrics {
	m := &Metrics{
		Registry: prometheus.NewRegistry(),
		httpRequests: prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: namespace, Name: "http_requests_total",
			Help: "HTTP requests by method, route template and status code."}, []string{"method", "route", "status"}),
		httpDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{Namespace: namespace, Name: "http_request_duration_seconds",
			Help: "HTTP request latency by method and route template.", Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}},
			[]string{"method", "route"}),
		ingestOps: prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: namespace, Name: "ingest_operations_total",
			Help: "Pushed operations by result status and rejection code (empty when not rejected)."}, []string{"status", "code"}),
		deadLetters: prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: namespace, Name: "dead_letters_total",
			Help: "Operations written to dead_letter, by error code."}, []string{"code"}),
		jobRuns: prometheus.NewCounterVec(prometheus.CounterOpts{Namespace: namespace, Name: "job_runs_total",
			Help: "Background job runs (snapshot builds, backup confirmations, health probes) by outcome."}, []string{"job", "outcome"}),
		jobDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{Namespace: namespace, Name: "job_duration_seconds",
			Help: "Background job duration.", Buckets: []float64{.05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60, 120, 300, 900}}, []string{"job"}),
		readyCheck: prometheus.NewGaugeVec(prometheus.GaugeOpts{Namespace: namespace, Name: "ready_check_ok",
			Help: "1 when the readiness check last passed, 0 when it failed."}, []string{"check"}),
	}
	m.Registry.MustRegister(m.httpRequests, m.httpDuration, m.ingestOps, m.deadLetters, m.jobRuns, m.jobDuration, m.readyCheck,
		collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	return m
}

// WatchPool exports the pgx pool's connection statistics.
func (m *Metrics) WatchPool(pool *pgxpool.Pool) {
	m.Registry.MustRegister(newPoolCollector(pool))
}

func (m *Metrics) ObserveRequest(method, route string, status int, took time.Duration) {
	m.httpRequests.WithLabelValues(method, route, strconv.Itoa(status)).Inc()
	m.httpDuration.WithLabelValues(method, route).Observe(took.Seconds())
}

func (m *Metrics) OperationResult(status, code string) {
	m.ingestOps.WithLabelValues(status, code).Inc()
}

func (m *Metrics) DeadLettered(code string) { m.deadLetters.WithLabelValues(code).Inc() }

func (m *Metrics) ObserveJob(job, outcome string, took time.Duration) {
	m.jobRuns.WithLabelValues(job, outcome).Inc()
	m.jobDuration.WithLabelValues(job).Observe(took.Seconds())
}

func (m *Metrics) ReadyCheck(name string, ok bool) {
	v := 0.0
	if ok {
		v = 1
	}
	m.readyCheck.WithLabelValues(name).Set(v)
}
