package admin

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/url"
	"reflect"
	"time"
)

var viewFuncs = template.FuncMap{
	"when":   when,
	"ago":    ago,
	"num":    num,
	"str":    str,
	"pretty": pretty,
	"seg":    url.PathEscape,
}

func timeOf(v any) (time.Time, bool) {
	switch t := v.(type) {
	case time.Time:
		return t, !t.IsZero()
	case *time.Time:
		if t != nil {
			return *t, true
		}
	}
	return time.Time{}, false
}

func when(v any) string {
	t, ok := timeOf(v)
	if !ok {
		return "never"
	}
	return t.UTC().Format("2006-01-02 15:04 UTC")
}

// ago is a coarse age: minutes under two hours, hours under three days, then days.
func ago(v any) string {
	t, ok := timeOf(v)
	if !ok {
		return "never"
	}
	d := time.Since(t)
	switch {
	case d < 2*time.Hour:
		return fmt.Sprintf("%d min ago", int(d.Minutes()))
	case d < 72*time.Hour:
		return fmt.Sprintf("%d h ago", int(d.Hours()))
	}
	return fmt.Sprintf("%d days ago", int(d.Hours()/24))
}

func num(v any) string {
	if s := str(v); s != "" {
		return s
	}
	return "—"
}

// str prints a value or what a non-nil pointer holds; nil is empty.
func str(v any) string {
	r := reflect.ValueOf(v)
	for r.IsValid() && r.Kind() == reflect.Pointer {
		if r.IsNil() {
			return ""
		}
		r = r.Elem()
	}
	if !r.IsValid() {
		return ""
	}
	return fmt.Sprint(r.Interface())
}

func pretty(v any) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return ""
	}
	return string(b)
}
