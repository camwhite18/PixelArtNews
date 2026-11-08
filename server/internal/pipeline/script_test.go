package pipeline

import (
	"testing"

	"github.com/camwhite18/pixelartnews/server/internal/rundown"
)

func TestGroundDropsUncitedLinesAndEmptySegments(t *testing.T) {
	sources := []rundown.Source{{ID: "s1"}, {ID: "s2"}}
	segs := []ScriptSegment{
		{Type: rundown.TypeStory, Lines: []rundown.Line{
			{Speaker: "margot", Text: "Cited.", SourceIDs: []string{"s1", "s9"}},
			{Speaker: "margot", Text: "Uncited.", SourceIDs: nil},
			{Speaker: "intruder", Text: "Unknown speaker.", SourceIDs: []string{"s1"}},
		}},
		{Type: rundown.TypeStory, Lines: []rundown.Line{
			{Speaker: "kofi", Text: "Only invented sources.", SourceIDs: []string{"s7"}},
		}},
	}
	got := Ground(segs, sources, []string{"margot", "kofi"})
	if len(got) != 1 {
		t.Fatalf("expected 1 segment, got %d", len(got))
	}
	if len(got[0].Lines) != 1 || got[0].Lines[0].Text != "Cited." {
		t.Fatalf("unexpected lines: %+v", got[0].Lines)
	}
	if ids := got[0].Lines[0].SourceIDs; len(ids) != 1 || ids[0] != "s1" {
		t.Fatalf("unknown source ids should be stripped, got %v", ids)
	}
}

func TestSourcesFor(t *testing.T) {
	all := []rundown.Source{{ID: "s1"}, {ID: "s2"}, {ID: "s3"}}
	seg := ScriptSegment{Lines: []rundown.Line{{SourceIDs: []string{"s3"}}, {SourceIDs: []string{"s1"}}}}
	got := SourcesFor(seg, all)
	if len(got) != 2 || got[0].ID != "s1" || got[1].ID != "s3" {
		t.Fatalf("got %+v", got)
	}
}

func TestSegmentTypesAddWeatherOnlyWithAForecast(t *testing.T) {
	if got := segmentTypes(false); len(got) != 2 {
		t.Fatalf("got %v", got)
	}
	if got := segmentTypes(true); got[len(got)-1] != rundown.TypeWeather {
		t.Fatalf("got %v", got)
	}
}

func TestValidArt(t *testing.T) {
	if ValidArt("rocket") != "rocket" || ValidArt("dragon") != "" {
		t.Fatal("ValidArt should keep known icons only")
	}
}
