// Package migrations embeds the goose SQL migrations so the server applies
// them on boot.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
