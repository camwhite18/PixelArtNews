// Package rundown defines the broadcast schedule format shared with the web
// front end. The source of truth is schema/rundown.schema.json; a test keeps
// these structs in step with it.
package rundown

import "time"

type Rundown struct {
	Channel     string    `json:"channel"`
	GeneratedAt time.Time `json:"generatedAt"`
	Segments    []Segment `json:"segments"`
}

type Segment struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Start     time.Time `json:"start"`
	DurationS float64   `json:"durationS"`
	Audio     string    `json:"audio"`
	Kicker    string    `json:"kicker,omitempty"`
	Headline  string    `json:"headline,omitempty"`
	Ticker    string    `json:"ticker,omitempty"`
	// Presenters on set for this segment (the shift's team), in seat order.
	Presenters []string `json:"presenters,omitempty"`
	// Show is the shift this segment was made for; studios dress their set for it.
	Show string `json:"show,omitempty"`
	// Art is a pixel icon for the story (one of ArtIcons), shown on the big screen.
	Art string `json:"art,omitempty"`
	// IntroS is how long the channel ident or sting at the start of the audio runs.
	IntroS float64 `json:"introS,omitempty"`
	// Weather is the forecast for the map during a weather segment.
	Weather []WeatherPlace `json:"weather,omitempty"`
	Lines   []Line         `json:"lines"`
	Sources []Source       `json:"sources"`
}

// WeatherPlace is one place on the weather map.
type WeatherPlace struct {
	Place string  `json:"place"`
	Code  int     `json:"code"`
	MaxC  float64 `json:"maxC"`
	MinC  float64 `json:"minC"`
}

// ArtIcons are the story icons the studios can draw; the schema lists the same.
var ArtIcons = []string{
	"globe", "ballot", "gavel", "money", "chart", "rocket", "planet", "flask",
	"chip", "phone", "robot", "gamepad", "heart", "leaf", "storm", "fire",
	"trophy", "ball", "car", "flag", "ufo", "ghost", "film", "music",
}

// End is when the segment stops airing.
func (s Segment) End() time.Time {
	return s.Start.Add(time.Duration(s.DurationS * float64(time.Second)))
}

type Line struct {
	Speaker   string   `json:"speaker"`
	Text      string   `json:"text"`
	StartS    float64  `json:"startS,omitempty"`
	SourceIDs []string `json:"sourceIds"`
}

type Source struct {
	ID     string `json:"id"`
	Outlet string `json:"outlet"`
	URL    string `json:"url"`
}

// Segment types.
const (
	TypeHeadlines = "headlines"
	TypeStory     = "story"
	TypeLink      = "link"
	TypeRecap     = "recap"
	TypeBreaking  = "breaking"
	TypeAdvert    = "advert"
	TypeIdle      = "idle"
	TypeWeather   = "weather"
)
