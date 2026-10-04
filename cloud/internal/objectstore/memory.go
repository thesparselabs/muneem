package objectstore

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Memory keeps objects in a map and serves them over HTTP (with Range) at BaseURL, standing in for S3 in tests.
type Memory struct {
	BaseURL string
	mu      sync.Mutex
	objects map[string][]byte
}

func NewMemory() *Memory { return &Memory{objects: map[string][]byte{}} }

func (m *Memory) Put(_ context.Context, key string, body io.Reader) error {
	raw, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[key] = raw
	return nil
}

func (m *Memory) PresignGet(_ context.Context, key string, ttl time.Duration) (string, error) {
	return m.BaseURL + "/" + key + "?expires=" + time.Now().Add(ttl).UTC().Format(time.RFC3339), nil
}

func (m *Memory) Object(key string) ([]byte, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	raw, ok := m.objects[key]
	return raw, ok
}

func (m *Memory) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	raw, ok := m.Object(strings.TrimPrefix(r.URL.Path, "/"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(raw))
}
