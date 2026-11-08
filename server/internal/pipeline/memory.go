package pipeline

import (
	"fmt"
	"strings"
	"time"

	"github.com/camwhite18/pixelartnews/server/internal/rundown"
	"github.com/camwhite18/pixelartnews/server/internal/store"
)

// memoryWindow is how far back presenters remember: yesterday's shows.
const memoryWindow = 30 * time.Hour

// maxMemories keeps the note short; it rides in every script prompt.
const maxMemories = 12

// whenAired says when a segment aired, the way a presenter would.
func whenAired(t, now time.Time, loc *time.Location) string {
	t, now = t.In(loc), now.In(loc)
	part := "this morning"
	switch h := t.Hour(); {
	case h >= 23 || h < 6:
		part = "overnight"
	case h >= 17:
		part = "this evening"
	case h >= 12:
		part = "this afternoon"
	}
	y1, m1, d1 := t.Date()
	y2, m2, d2 := now.Date()
	if y1 == y2 && m1 == m2 && d1 == d2 {
		return strings.Replace(part, "this", "earlier this", 1)
	}
	if part == "overnight" {
		return "last night"
	}
	return strings.Replace(part, "this ", "yesterday ", 1)
}

// MemoryNote lists stories the channel covered earlier, so presenters can
// follow them up ("we told you yesterday..."). The note is for continuity
// only: the prompt says facts must still come from today's sources.
// Segments from the last 20 minutes are this run's own and are left out.
func MemoryNote(past []store.PastSegment, now time.Time, loc *time.Location) string {
	seen := map[string]bool{}
	var b strings.Builder
	n := 0
	for _, s := range past {
		h := strings.TrimSpace(s.Headline)
		if h == "" || s.Type == rundown.TypeWeather || now.Sub(s.CreatedAt) < 20*time.Minute {
			continue
		}
		key := strings.ToLower(h)
		if seen[key] {
			continue
		}
		seen[key] = true
		fmt.Fprintf(&b, "- %s: %s\n", whenAired(s.CreatedAt, now, loc), h)
		n++
		if n == maxMemories {
			break
		}
	}
	return b.String()
}
