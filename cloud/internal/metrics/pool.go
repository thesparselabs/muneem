package metrics

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
)

type poolCollector struct {
	pool                          *pgxpool.Pool
	total, idle, acquired, max    *prometheus.Desc
	acquires, waits, waitDuration *prometheus.Desc
}

func newPoolCollector(pool *pgxpool.Pool) *poolCollector {
	d := func(name, help string) *prometheus.Desc {
		return prometheus.NewDesc(prometheus.BuildFQName(namespace, "db_pool", name), help, nil, nil)
	}
	return &poolCollector{pool: pool,
		total: d("connections", "Open connections."), idle: d("idle_connections", "Idle connections."),
		acquired: d("acquired_connections", "Connections in use."), max: d("max_connections", "The pool's connection limit."),
		acquires: d("acquires_total", "Connections acquired from the pool."), waits: d("empty_acquires_total", "Acquires that had to wait for a connection."),
		waitDuration: d("acquire_wait_seconds_total", "Time spent waiting for a connection."),
	}
}

func (c *poolCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, d := range []*prometheus.Desc{c.total, c.idle, c.acquired, c.max, c.acquires, c.waits, c.waitDuration} {
		ch <- d
	}
}

func (c *poolCollector) Collect(ch chan<- prometheus.Metric) {
	s := c.pool.Stat()
	ch <- prometheus.MustNewConstMetric(c.total, prometheus.GaugeValue, float64(s.TotalConns()))
	ch <- prometheus.MustNewConstMetric(c.idle, prometheus.GaugeValue, float64(s.IdleConns()))
	ch <- prometheus.MustNewConstMetric(c.acquired, prometheus.GaugeValue, float64(s.AcquiredConns()))
	ch <- prometheus.MustNewConstMetric(c.max, prometheus.GaugeValue, float64(s.MaxConns()))
	ch <- prometheus.MustNewConstMetric(c.acquires, prometheus.CounterValue, float64(s.AcquireCount()))
	ch <- prometheus.MustNewConstMetric(c.waits, prometheus.CounterValue, float64(s.EmptyAcquireCount()))
	ch <- prometheus.MustNewConstMetric(c.waitDuration, prometheus.CounterValue, s.AcquireDuration().Seconds())
}
