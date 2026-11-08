// Package weather fetches today's UK forecast from Open-Meteo for the
// breakfast weather segment.
//
// Open-Meteo is free for non-commercial use; its data is CC BY 4.0, so the
// segment credits it as a source (see Source).
package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultURL is Open-Meteo's forecast endpoint.
const DefaultURL = "https://api.open-meteo.com/v1/forecast"

// Place is a city on the weather map. The web app positions it by ID.
type Place struct {
	ID   string
	Name string
	Lat  float64
	Lon  float64
}

// UK is the map's cities, north to south.
var UK = []Place{
	{"edinburgh", "Edinburgh", 55.95, -3.19},
	{"newcastle", "Newcastle", 54.98, -1.61},
	{"belfast", "Belfast", 54.60, -5.93},
	{"manchester", "Manchester", 53.48, -2.24},
	{"birmingham", "Birmingham", 52.49, -1.89},
	{"cardiff", "Cardiff", 51.48, -3.18},
	{"london", "London", 51.51, -0.13},
	{"plymouth", "Plymouth", 50.38, -4.14},
}

// Day is one place's forecast for today.
type Day struct {
	Place Place
	Code  int // WMO weather code
	MaxC  float64
	MinC  float64
}

// Fetch gets today's forecast for each place in one request.
func Fetch(ctx context.Context, client *http.Client, base string, places []Place, loc *time.Location) ([]Day, error) {
	lats := make([]string, len(places))
	lons := make([]string, len(places))
	for i, p := range places {
		lats[i] = fmt.Sprintf("%.2f", p.Lat)
		lons[i] = fmt.Sprintf("%.2f", p.Lon)
	}
	q := url.Values{
		"latitude":      {strings.Join(lats, ",")},
		"longitude":     {strings.Join(lons, ",")},
		"daily":         {"weather_code,temperature_2m_max,temperature_2m_min"},
		"timezone":      {loc.String()},
		"forecast_days": {"1"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("open-meteo: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("open-meteo: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("open-meteo: %s", resp.Status)
	}

	type forecast struct {
		Daily struct {
			Code []int     `json:"weather_code"`
			Max  []float64 `json:"temperature_2m_max"`
			Min  []float64 `json:"temperature_2m_min"`
		} `json:"daily"`
	}
	// Several places come back as an array; a single place as one object.
	var all []forecast
	if err := json.Unmarshal(body, &all); err != nil {
		var one forecast
		if err2 := json.Unmarshal(body, &one); err2 != nil {
			return nil, fmt.Errorf("open-meteo: bad response: %w", err)
		}
		all = []forecast{one}
	}
	if len(all) != len(places) {
		return nil, fmt.Errorf("open-meteo: %d forecasts for %d places", len(all), len(places))
	}
	days := make([]Day, 0, len(places))
	for i, f := range all {
		d := f.Daily
		if len(d.Code) == 0 || len(d.Max) == 0 || len(d.Min) == 0 {
			return nil, fmt.Errorf("open-meteo: no forecast for %s", places[i].Name)
		}
		days = append(days, Day{Place: places[i], Code: d.Code[0], MaxC: d.Max[0], MinC: d.Min[0]})
	}
	return days, nil
}

// Describe is a WMO weather code in plain words, for the script.
func Describe(code int) string {
	switch {
	case code == 0:
		return "clear and sunny"
	case code <= 2:
		return "sunny spells"
	case code == 3:
		return "cloudy"
	case code == 45 || code == 48:
		return "foggy"
	case code >= 51 && code <= 57:
		return "drizzle"
	case code >= 61 && code <= 67:
		return "rain"
	case code >= 71 && code <= 77:
		return "snow"
	case code >= 80 && code <= 82:
		return "showers"
	case code == 85 || code == 86:
		return "snow showers"
	case code >= 95:
		return "thunderstorms"
	default:
		return "mixed weather"
	}
}

// Summary is the forecast as source text for the script, one place a line.
func Summary(days []Day) string {
	var b strings.Builder
	for _, d := range days {
		fmt.Fprintf(&b, "%s: %s, high %.0f°C, low %.0f°C\n", d.Place.Name, Describe(d.Code), d.MaxC, d.MinC)
	}
	return b.String()
}
