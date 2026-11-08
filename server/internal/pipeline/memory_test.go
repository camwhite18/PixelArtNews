package pipeline

import (
	"testing"
	"time"

	"github.com/camwhite18/pixelartnews/server/internal/store"
)

func TestMemoryNote(t *testing.T) {
	loc := time.UTC
	now := time.Date(2026, 11, 8, 8, 0, 0, 0, loc)
	past := []store.PastSegment{
		{Type: "story", Headline: "Fresh from this run", CreatedAt: now.Add(-5 * time.Minute)},
		{Type: "story", Headline: "Talks run late", CreatedAt: now.Add(-2 * time.Hour)},
		{Type: "headlines", Headline: "talks run late", CreatedAt: now.Add(-3 * time.Hour)},
		{Type: "weather", Headline: "Weather: rain", CreatedAt: now.Add(-3 * time.Hour)},
		{Type: "story", Headline: "Goat elected mayor", CreatedAt: now.Add(-14 * time.Hour)},
		{Type: "story", Headline: "", CreatedAt: now.Add(-15 * time.Hour)},
	}
	got := MemoryNote(past, now, loc)
	want := "- earlier this morning: Talks run late\n- yesterday evening: Goat elected mayor\n"
	if got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestWhenAired(t *testing.T) {
	loc := time.UTC
	now := time.Date(2026, 11, 8, 20, 0, 0, 0, loc)
	cases := map[time.Time]string{
		time.Date(2026, 11, 8, 7, 0, 0, 0, loc):   "earlier this morning",
		time.Date(2026, 11, 8, 14, 0, 0, 0, loc):  "earlier this afternoon",
		time.Date(2026, 11, 7, 18, 0, 0, 0, loc):  "yesterday evening",
		time.Date(2026, 11, 8, 1, 0, 0, 0, loc):   "overnight",
		time.Date(2026, 11, 7, 23, 30, 0, 0, loc): "last night",
	}
	for at, want := range cases {
		if got := whenAired(at, now, loc); got != want {
			t.Errorf("whenAired(%s) = %q, want %q", at.Format(time.Kitchen), got, want)
		}
	}
	if got := MemoryNote(nil, now, loc); got != "" {
		t.Fatalf("no past segments should give no note, got %q", got)
	}
}
