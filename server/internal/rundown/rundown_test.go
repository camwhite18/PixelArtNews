package rundown

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

func sample(now time.Time) Rundown {
	return Rundown{
		Channel:     "world",
		GeneratedAt: now,
		Segments: []Segment{{
			ID:         "seg_1",
			Type:       TypeHeadlines,
			Start:      now,
			DurationS:  42.5,
			Audio:      "audio/world/seg_1.mp3",
			Kicker:     "TOP STORY",
			Headline:   "Example headline",
			Ticker:     "Example ticker",
			Presenters: []string{"margot", "kofi"},
			Show:       "evening",
			Art:        "globe",
			IntroS:     1.6,
			Weather:    []WeatherPlace{{Place: "london", Code: 61, MaxC: 12, MinC: 7}},
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

func TestExtendBlocksHandsOverAtTheShiftChange(t *testing.T) {
	now := time.Date(2026, 11, 7, 16, 50, 0, 0, time.UTC)
	change := now.Add(10 * time.Minute)
	day := seg("day", 90)
	eve := seg("eve", 60)

	got := ExtendBlocks(nil, "world", []Block{
		{From: now, Segments: []Segment{day}},
		{From: change, Segments: []Segment{eve}},
	}, now, time.Hour)

	sawEvening := false
	for i, s := range got.Segments {
		if i > 0 && !s.Start.Equal(got.Segments[i-1].End()) {
			t.Fatalf("gap or overlap before segment %d", i)
		}
		switch s.ID {
		case "day":
			if sawEvening || !s.Start.Before(change) {
				t.Fatalf("daytime segment starts at %v, after the handover", s.Start)
			}
		case "eve":
			if !sawEvening {
				sawEvening = true
				// The daytime segment playing at the change finishes first.
				if s.Start.Before(change) || s.Start.After(change.Add(90*time.Second)) {
					t.Fatalf("evening team starts at %v, want just after %v", s.Start, change)
				}
			}
		}
	}
	if !sawEvening {
		t.Fatal("the evening team never comes on")
	}
	if got.Segments[len(got.Segments)-1].End().Before(now.Add(time.Hour)) {
		t.Fatal("schedule stops short of the horizon")
	}
}

func TestExtendBlocksBeyondTheHorizonIsIgnored(t *testing.T) {
	now := time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)
	got := ExtendBlocks(nil, "world", []Block{
		{From: now, Segments: []Segment{seg("day", 60)}},
		{From: now.Add(5 * time.Hour), Segments: []Segment{seg("eve", 60)}},
	}, now, time.Hour)
	for _, s := range got.Segments {
		if s.ID == "eve" {
			t.Fatal("a block after the horizon should not air")
		}
	}
}

// The story icons the script may choose must be the ones the schema (and so
// the web studios) know.
func TestArtIconsMatchSchema(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "schema", "rundown.schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Defs struct {
			Segment struct {
				Properties struct {
					Art struct {
						Enum []string `json:"enum"`
					} `json:"art"`
				} `json:"properties"`
			} `json:"segment"`
		} `json:"$defs"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	got := doc.Defs.Segment.Properties.Art.Enum
	if strings.Join(got, ",") != strings.Join(ArtIcons, ",") {
		t.Fatalf("schema art icons %v, Go ArtIcons %v", got, ArtIcons)
	}
}
