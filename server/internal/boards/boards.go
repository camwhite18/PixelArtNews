// Package boards fetches the real data shown on studio boards: the Premier
// League table for FOOTBALL and the drivers' championship for F1. The web
// app reads each board from /media/boards/<channel>.json.
//
// Sources and their conditions:
//   - football-data.org (free tier, needs an API key): its terms require the
//     credit "Football data provided by the Football-Data.org API".
//   - Jolpica-F1 (free, no key): asks for a custom User-Agent and gentle use;
//     boards refresh every few hours at most.
package boards

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	FootballDataURL = "https://api.football-data.org"
	JolpicaURL      = "https://api.jolpi.ca"
	UserAgent       = "PixelArtNews/1.0 (personal, non-commercial; github.com/camwhite18/PixelArtNews)"

	FootballAttribution = "Football data provided by the Football-Data.org API"
	F1Attribution       = "F1 standings from the Jolpica-F1 API"

	// Rows that fit each studio's board.
	FootballRows = 6
	F1Rows       = 8
)

// Row is one line of a board, e.g. {"ARS", "31"}.
type Row struct {
	Label string `json:"label"`
	Value string `json:"value"`
	// Team is a constructor id (F1) for the row's colour stripe.
	Team string `json:"team,omitempty"`
}

// Board is what a studio board shows.
type Board struct {
	Title     string    `json:"title"`
	Rows      []Row     `json:"rows"`
	Credit    string    `json:"credit"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func get(ctx context.Context, client *http.Client, url string, header map[string]string, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", UserAgent)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: %s", url, resp.Status)
	}
	return json.Unmarshal(body, into)
}

// FootballTable is the top of a competition's league table (e.g. "PL").
func FootballTable(ctx context.Context, client *http.Client, base, key, competition string) (Board, error) {
	var res struct {
		Standings []struct {
			Type  string `json:"type"`
			Table []struct {
				Position int `json:"position"`
				Points   int `json:"points"`
				Team     struct {
					TLA       string `json:"tla"`
					ShortName string `json:"shortName"`
				} `json:"team"`
			} `json:"table"`
		} `json:"standings"`
	}
	url := fmt.Sprintf("%s/v4/competitions/%s/standings", base, competition)
	if err := get(ctx, client, url, map[string]string{"X-Auth-Token": key}, &res); err != nil {
		return Board{}, fmt.Errorf("football-data: %w", err)
	}
	b := Board{Title: "TABLE", Credit: FootballAttribution, UpdatedAt: time.Now().UTC()}
	for _, s := range res.Standings {
		if s.Type != "TOTAL" {
			continue
		}
		for _, r := range s.Table {
			if len(b.Rows) == FootballRows {
				break
			}
			label := r.Team.TLA
			if label == "" {
				label = r.Team.ShortName
			}
			b.Rows = append(b.Rows, Row{Label: label, Value: strconv.Itoa(r.Points)})
		}
	}
	if len(b.Rows) == 0 {
		return Board{}, fmt.Errorf("football-data: no table for %s", competition)
	}
	return b, nil
}

// F1Drivers is the top of the drivers' championship for the latest season
// with results: this year's, or last year's before the first race.
func F1Drivers(ctx context.Context, client *http.Client, base string, year int) (Board, error) {
	for _, season := range []int{year, year - 1} {
		var res struct {
			MRData struct {
				StandingsTable struct {
					StandingsLists []struct {
						DriverStandings []struct {
							Points string `json:"points"`
							Driver struct {
								Code       string `json:"code"`
								FamilyName string `json:"familyName"`
							} `json:"Driver"`
							Constructors []struct {
								ConstructorID string `json:"constructorId"`
							} `json:"Constructors"`
						} `json:"DriverStandings"`
					} `json:"StandingsLists"`
				} `json:"StandingsTable"`
			} `json:"MRData"`
		}
		url := fmt.Sprintf("%s/ergast/f1/%d/driverstandings/", base, season)
		if err := get(ctx, client, url, nil, &res); err != nil {
			return Board{}, fmt.Errorf("jolpica: %w", err)
		}
		lists := res.MRData.StandingsTable.StandingsLists
		if len(lists) == 0 || len(lists[0].DriverStandings) == 0 {
			continue
		}
		b := Board{Title: "DRIVERS", Credit: F1Attribution, UpdatedAt: time.Now().UTC()}
		for _, d := range lists[0].DriverStandings {
			if len(b.Rows) == F1Rows {
				break
			}
			label := d.Driver.Code
			if label == "" && len(d.Driver.FamilyName) >= 3 {
				label = strings.ToUpper(d.Driver.FamilyName[:3])
			}
			team := ""
			if len(d.Constructors) > 0 {
				team = d.Constructors[0].ConstructorID
			}
			b.Rows = append(b.Rows, Row{Label: label, Value: d.Points, Team: team})
		}
		return b, nil
	}
	return Board{}, fmt.Errorf("jolpica: no standings for %d or %d", year, year-1)
}

// Path is where a channel's board lives under the media directory.
func Path(mediaDir, channel string) string {
	return filepath.Join(mediaDir, "boards", channel+".json")
}

// Fresh reports whether a channel's board was written within maxAge.
func Fresh(mediaDir, channel string, maxAge time.Duration) bool {
	info, err := os.Stat(Path(mediaDir, channel))
	return err == nil && time.Since(info.ModTime()) < maxAge
}

// Write saves a board atomically, so the web app never reads half a file.
func Write(mediaDir, channel string, b Board) error {
	path := Path(mediaDir, channel)
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	data, err := json.Marshal(b)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".board-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }() // no-op once renamed
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
