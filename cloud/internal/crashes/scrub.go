// Package crashes is the self-hosted crash collector (ADR-0053): a Sentry-protocol ingest for the store, envelope and
// minidump endpoints that keeps only allow-listed fields and writes each report as one log line for Loki.
package crashes

import (
	"path"
	"regexp"
	"strconv"
	"strings"
)

// Report is everything a crash report may carry once it is scrubbed; nothing else from the event survives.
type Report struct {
	EventID       string  `json:"event_id"`
	Timestamp     string  `json:"timestamp,omitempty"`
	Level         string  `json:"level,omitempty"`
	Platform      string  `json:"platform,omitempty"`
	Release       string  `json:"release,omitempty"`
	Environment   string  `json:"environment,omitempty"`
	Kind          string  `json:"kind,omitempty"`
	Process       string  `json:"process,omitempty"`
	OS            string  `json:"os,omitempty"`
	SchemaVersion string  `json:"schema_version,omitempty"`
	Installation  string  `json:"installation,omitempty"`
	Exceptions    []Error `json:"exceptions,omitempty"`
}

type Error struct {
	Type   string   `json:"type"`
	Value  string   `json:"value,omitempty"`
	Frames []string `json:"frames,omitempty"`
}

var allowedTags = map[string]func(*Report, string){
	"kind":           func(r *Report, v string) { r.Kind = truncate(Redact(v), 40) },
	"process":        func(r *Report, v string) { r.Process = truncate(Redact(v), 40) },
	"os":             func(r *Report, v string) { r.OS = truncate(Redact(v), 80) },
	"schema_version": func(r *Report, v string) { r.SchemaVersion = only(v, versionPattern) },
	"installation":   func(r *Report, v string) { r.Installation = only(v, hashPattern) },
}

var (
	versionPattern = regexp.MustCompile(`^[0-9]{1,6}$`)
	hashPattern    = regexp.MustCompile(`^[0-9a-f]{8,64}$`)
)

// only keeps a value that is exactly the expected shape, so an identifier never needs redacting.
func only(v string, shape *regexp.Regexp) string {
	if shape.MatchString(v) {
		return v
	}
	return ""
}

const (
	maxField      = 200
	maxMessage    = 500
	maxExceptions = 5
	maxFrames     = 30
)

var (
	emailPattern  = regexp.MustCompile(`[\w.+-]+@[\w-]+\.[\w.-]+`)
	gstinPattern  = regexp.MustCompile(`(?i)\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b`)
	digitsPattern = regexp.MustCompile(`\d{6,}`)
	quotedPattern = regexp.MustCompile(`"[^"]*"|'[^']*'`)
	pathPattern   = regexp.MustCompile(`(?:[A-Za-z]:)?[\\/][^\s:]+[\\/]`)
)

// Redact strips what an error message can leak: quoted values, e-mails, GSTINs, phone or long numbers, and directories.
func Redact(s string) string {
	s = quotedPattern.ReplaceAllString(s, `"…"`)
	s = emailPattern.ReplaceAllString(s, "[email]")
	s = gstinPattern.ReplaceAllString(s, "[gstin]")
	s = digitsPattern.ReplaceAllString(s, "[number]")
	s = pathPattern.ReplaceAllString(s, "…/")
	return truncate(s, maxMessage)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return strings.ToValidUTF8(s[:n], "")
}

func str(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return truncate(v, maxField)
}

func obj(m map[string]any, key string) map[string]any {
	v, _ := m[key].(map[string]any)
	return v
}

func list(m map[string]any, key string) []any {
	v, _ := m[key].([]any)
	return v
}

// Scrub builds a Report from a decoded Sentry event by allow-list: users, requests, breadcrumbs, extras, contexts and
// unknown tags are dropped whole, and the free text that remains is redacted.
func Scrub(event map[string]any) Report {
	r := Report{EventID: str(event, "event_id"), Level: str(event, "level"), Platform: str(event, "platform"),
		Release: str(event, "release"), Environment: str(event, "environment")}
	if ts, ok := event["timestamp"].(string); ok {
		r.Timestamp = truncate(ts, 40)
	}
	for key, value := range tags(event["tags"]) {
		if set, ok := allowedTags[key]; ok {
			set(&r, value)
		}
	}
	for i, e := range list(obj(event, "exception"), "values") {
		if i == maxExceptions {
			break
		}
		if ex, ok := e.(map[string]any); ok {
			r.Exceptions = append(r.Exceptions, scrubError(ex))
		}
	}
	return r
}

// tags accepts both Sentry shapes: an object, or a list of [key, value] pairs.
func tags(v any) map[string]string {
	out := map[string]string{}
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			if s, ok := val.(string); ok {
				out[k] = s
			}
		}
	case []any:
		for _, pair := range t {
			if p, ok := pair.([]any); ok && len(p) == 2 {
				k, _ := p[0].(string)
				s, _ := p[1].(string)
				out[k] = s
			}
		}
	}
	return out
}

func scrubError(ex map[string]any) Error {
	e := Error{Type: truncate(Redact(str(ex, "type")), maxField), Value: Redact(str(ex, "value"))}
	frames := list(obj(ex, "stacktrace"), "frames")
	if len(frames) > maxFrames {
		frames = frames[len(frames)-maxFrames:]
	}
	for _, f := range frames {
		if fm, ok := f.(map[string]any); ok {
			e.Frames = append(e.Frames, frame(fm))
		}
	}
	return e
}

// frame keeps the file's base name, the function and the line: never the source context or local variables.
func frame(f map[string]any) string {
	file := path.Base(strings.ReplaceAll(str(f, "filename"), `\`, "/"))
	line, _ := f["lineno"].(float64)
	fn := str(f, "function")
	if fn == "" {
		fn = "?"
	}
	return truncate(fn+" ("+file+":"+lineLabel(line)+")", maxField)
}

func lineLabel(line float64) string {
	if line <= 0 {
		return "?"
	}
	return strconv.Itoa(int(line))
}

// sanitize applies the same per-field rule as the event tags, for minidump form fields.
func sanitize(name, v string) string {
	switch name {
	case "installation":
		return only(v, hashPattern)
	case "schema_version":
		return only(v, versionPattern)
	}
	return truncate(Redact(v), 80)
}
