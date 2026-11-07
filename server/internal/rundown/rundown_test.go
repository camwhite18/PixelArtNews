package rundown

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

func sample(now time.Time) Rundown {
	return Rundown{
		Channel:     "world",
		GeneratedAt: now,
		Segments: []Segment{{
			ID:        "seg_1",
			Type:      TypeHeadlines,
			Start:     now,
			DurationS: 42.5,
			Audio:     "audio/world/seg_1.mp3",
			Kicker:    "TOP STORY",
			Headline:  "Example headline",
			Ticker:    "Example ticker",
			Lines: []Line{
				{Speaker: "margot", Text: "Good afternoon.", SourceIDs: []string{"s1"}},
				{Speaker: "kofi", Text: "And here's why it matters.", StartS: 3.2, SourceIDs: []string{"s1"}},
			},
			Sources: []Source{{ID: "s1", Outlet: "Example", URL: "https://example.com/story"}},
		}},
	}
}

// The Go structs must produce JSON that satisfies the shared schema.
func TestRundownMatchesSchema(t *testing.T) {
	path := filepath.Join("..", "..", "..", "schema", "rundown.schema.json")
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	doc, err := jsonschema.UnmarshalJSON(f)
	if err != nil {
		t.Fatal(err)
	}
	c := jsonschema.NewCompiler()
	if err := c.AddResource("rundown.schema.json", doc); err != nil {
		t.Fatal(err)
	}
	sch, err := c.Compile("rundown.schema.json")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := json.Marshal(sample(time.Date(2026, 11, 7, 13, 0, 0, 0, time.UTC)))
	if err != nil {
		t.Fatal(err)
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatal(err)
	}
	if err := sch.Validate(v); err != nil {
		t.Fatalf("rundown JSON does not match schema: %v", err)
	}
}

func seg(id string, d float64) Segment {
	return Segment{ID: id, Type: TypeStory, DurationS: d, Audio: id + ".mp3"}
}

func TestExtendKeepsSegmentOnAir(t *testing.T) {
	now := time.Date(2026, 11, 7, 13, 0, 0, 0, time.UTC)
	airing := seg("old1", 60)
	airing.Start = now.Add(-20 * time.Second)
	queued := seg("old2", 60)
	queued.Start = airing.End()
	prev := &Rundown{Segments: []Segment{airing, queued}}

	got := Extend(prev, "world", []Segment{seg("new1", 30), seg("new2", 30)}, now, 5*time.Minute)

	if got.Segments[0].ID != "old1" || !got.Segments[0].Start.Equal(airing.Start) {
		t.Fatalf("segment on air was changed: %+v", got.Segments[0])
	}
	if got.Segments[1].ID != "new1" || !got.Segments[1].Start.Equal(airing.End()) {
		t.Fatalf("fresh content should start when the airing segment ends: %+v", got.Segments[1])
	}
	last := got.Segments[len(got.Segments)-1]
	if last.End().Before(now.Add(5 * time.Minute)) {
		t.Fatalf("schedule stops short of the horizon at %v", last.End())
	}
	for i := 1; i < len(got.Segments); i++ {
		if !got.Segments[i].Start.Equal(got.Segments[i-1].End()) {
			t.Fatalf("gap or overlap between segments %d and %d", i-1, i)
		}
	}
}

func TestExtendWithoutFreshKeepsSchedule(t *testing.T) {
	now := time.Date(2026, 11, 7, 13, 0, 0, 0, time.UTC)
	a := seg("a", 60)
	a.Start = now.Add(-10 * time.Second)
	b := seg("b", 60)
	b.Start = a.End()
	got := Extend(&Rundown{Segments: []Segment{a, b}}, "world", nil, now, time.Hour)
	if len(got.Segments) != 2 {
		t.Fatalf("expected the existing schedule to be kept, got %d segments", len(got.Segments))
	}
}

func TestOnAir(t *testing.T) {
	now := time.Date(2026, 11, 7, 13, 0, 0, 0, time.UTC)
	a := seg("a", 60)
	a.Start = now
	r := Rundown{Segments: []Segment{a}}
	s, off, ok := r.OnAir(now.Add(15 * time.Second))
	if !ok || s.ID != "a" || off != 15*time.Second {
		t.Fatalf("got %v %v %v", s.ID, off, ok)
	}
	if _, _, ok := r.OnAir(now.Add(2 * time.Minute)); ok {
		t.Fatal("nothing should be on air after the schedule ends")
	}
}
