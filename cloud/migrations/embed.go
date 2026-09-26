// Package migrations embeds the numbered SQL files for golang-migrate.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
