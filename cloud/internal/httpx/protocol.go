package httpx

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/sparselabs/muneem/cloud/api"
)

// HeaderSyncProtocol mirrors SYNC_HEADERS.syncProtocol in packages/contracts/src/sync/types.ts.
const HeaderSyncProtocol = "X-Sync-Protocol"

const codeVersionUnsupported = "VERSION_UNSUPPORTED"

// Protocols is the range of sync protocols this server accepts (ADR-0049, LLD §12: N and N−1).
type Protocols struct {
	Min     int
	Current int
}

// DefaultProtocols accepts the current protocol and the one before it, never below protocol 1.
func DefaultProtocols() Protocols {
	return Protocols{Min: max(1, SyncProtocol-1), Current: SyncProtocol}
}

func (p Protocols) orDefault() Protocols {
	if p.Current == 0 {
		return DefaultProtocols()
	}
	return p
}

func (p Protocols) Accepts(v int) bool {
	p = p.orDefault()
	return v >= p.Min && v <= p.Current
}

// ProtocolsFromEnv reads MUNEEM_SYNC_MIN_PROTOCOL; unset means N−1.
func ProtocolsFromEnv(getenv func(string) string) (Protocols, error) {
	p := DefaultProtocols()
	raw := strings.TrimSpace(getenv("MUNEEM_SYNC_MIN_PROTOCOL"))
	if raw == "" {
		return p, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 || v > p.Current {
		return p, fmt.Errorf("MUNEEM_SYNC_MIN_PROTOCOL must be a protocol from 1 to %d, got %q", p.Current, raw)
	}
	p.Min = v
	return p, nil
}

// RefuseProtocol answers 426: the device keeps billing offline and shows "update required".
func RefuseProtocol(c echo.Context, p Protocols, got string) error {
	p = p.orDefault()
	return Fail(c, http.StatusUpgradeRequired, codeVersionUnsupported, api.Transient,
		fmt.Sprintf("this server speaks sync protocols %d to %d, not %s; update Muneem", p.Min, p.Current, got))
}

// SyncProtocolGate refuses a sync request whose X-Sync-Protocol is missing or outside the accepted range.
func SyncProtocolGate(p Protocols) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			raw := c.Request().Header.Get(HeaderSyncProtocol)
			v, err := strconv.Atoi(strings.TrimSpace(raw))
			if err != nil || !p.Accepts(v) {
				if raw == "" {
					raw = "none"
				}
				return RefuseProtocol(c, p, raw)
			}
			return next(c)
		}
	}
}
