package boards

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestFootballTable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") != "k" || r.URL.Path != "/v4/competitions/PL/standings" {
			t.Errorf("unexpected request %s token=%q", r.URL.Path, r.Header.Get("X-Auth-Token"))
		}
		if !strings.HasPrefix(r.Header.Get("User-Agent"), "PixelArtNews/") {
			t.Errorf("user agent %q", r.Header.Get("User-Agent"))
		}
		_, _ = w.Write([]byte(`{"standings":[
			{"type":"HOME","table":[{"position":1,"points":99,"team":{"tla":"XXX"}}]},
			{"type":"TOTAL","table":[
				{"position":1,"points":31,"team":{"tla":"ARS"}},
				{"position":2,"points":28,"team":{"tla":"MCI"}},
				{"position":3,"points":25,"team":{"tla":"","shortName":"Spurs"}}
			]}]}`))
	}))
	defer srv.Close()

	b, err := FootballTable(context.Background(), srv.Client(), srv.URL, "k", "PL")
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Rows) != 3 || b.Rows[0] != (Row{Label: "ARS", Value: "31"}) || b.Rows[2].Label != "Spurs" ||
		b.Credit != FootballCredit {
		t.Fatalf("got %+v", b)
	}
}

func TestF1DriversFallsBackToLastSeason(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/2027/") {
			_, _ = w.Write([]byte(`{"MRData":{"StandingsTable":{"StandingsLists":[]}}}`))
			return
		}
		_, _ = w.Write([]byte(`{"MRData":{"StandingsTable":{"StandingsLists":[{"DriverStandings":[
			{"points":"412","Driver":{"code":"NOR"},"Constructors":[{"constructorId":"mclaren"}]},
			{"points":"390","Driver":{"code":"","familyName":"Verstappen"},"Constructors":[{"constructorId":"red_bull"}]}
		]}]}}}`))
	}))
	defer srv.Close()

	b, err := F1Drivers(context.Background(), srv.Client(), srv.URL, 2027)
	if err != nil {
		t.Fatal(err)
	}
	want := []Row{{"NOR", "412", "mclaren"}, {"VER", "390", "red_bull"}}
	if len(b.Rows) != 2 || b.Rows[0] != want[0] || b.Rows[1] != want[1] {
		t.Fatalf("got %+v", b.Rows)
	}
}

func TestWriteAndFresh(t *testing.T) {
	dir := t.TempDir()
	if Fresh(dir, "f1", time.Hour) {
		t.Fatal("no board yet")
	}
	if err := Write(dir, "f1", Board{Title: "DRIVERS", Rows: []Row{{Label: "NOR", Value: "412"}}}); err != nil {
		t.Fatal(err)
	}
	if !Fresh(dir, "f1", time.Hour) {
		t.Fatal("board should be fresh")
	}
	raw, err := os.ReadFile(Path(dir, "f1"))
	if err != nil {
		t.Fatal(err)
	}
	var b Board
	if err := json.Unmarshal(raw, &b); err != nil || b.Rows[0].Label != "NOR" {
		t.Fatalf("read back %+v, %v", b, err)
	}
}
