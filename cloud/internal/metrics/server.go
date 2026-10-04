package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// DefaultAddr keeps /metrics on loopback; the container overrides it to listen for the private scrape network.
const DefaultAddr = "127.0.0.1:9090"

// Handler serves only GET /metrics; it is never mounted on the public Echo server.
func (m *Metrics) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", promhttp.HandlerFor(m.Registry, promhttp.HandlerOpts{Registry: m.Registry}))
	return mux
}

func (m *Metrics) Server(addr string) *http.Server {
	if addr == "" {
		addr = DefaultAddr
	}
	return &http.Server{Addr: addr, Handler: m.Handler(), ReadHeaderTimeout: 5 * time.Second}
}
