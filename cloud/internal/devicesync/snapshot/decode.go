package snapshot

import (
	"bufio"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"

	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

// Decode reads a whole bundle back: its header and every change line, in order.
func Decode(r io.Reader) (Header, []devicesync.Change, error) {
	var h Header
	gz, err := gzip.NewReader(r)
	if err != nil {
		return h, nil, err
	}
	defer gz.Close()
	lines := bufio.NewScanner(gz)
	lines.Buffer(make([]byte, 64<<10), 16<<20)
	if !lines.Scan() {
		return h, nil, errors.Join(errors.New("bundle has no header"), lines.Err())
	}
	if err := json.Unmarshal(lines.Bytes(), &h); err != nil {
		return h, nil, err
	}
	var changes []devicesync.Change
	for lines.Scan() {
		var c devicesync.Change
		if err := json.Unmarshal(lines.Bytes(), &c); err != nil {
			return h, nil, err
		}
		changes = append(changes, c)
	}
	return h, changes, lines.Err()
}
