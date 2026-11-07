package pipeline

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestTrimSummaryKeepsShortText(t *testing.T) {
	s := "A short summary."
	if got := trimSummary(s); got != s {
		t.Fatalf("got %q, want it unchanged", got)
	}
}

func TestTrimSummaryCutsAtAWord(t *testing.T) {
	s := strings.Repeat("word ", 200)
	got := trimSummary(s)
	if len(got) > maxSummary+len("…") {
		t.Fatalf("too long: %d bytes", len(got))
	}
	if !strings.HasSuffix(got, "word…") {
		t.Fatalf("should end on a whole word: %q", got[len(got)-20:])
	}
}

func TestTrimSummaryKeepsUTF8Valid(t *testing.T) {
	s := strings.Repeat("é", 400) // one long "word" of two-byte characters
	got := trimSummary(s)
	if !utf8.ValidString(got) {
		t.Fatal("cut through a character")
	}
}
