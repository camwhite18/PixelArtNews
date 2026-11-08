package weather

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestFetchReadsEachPlace(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("latitude"); got != "55.95,51.51" {
			t.Errorf("latitude = %q", got)
		}
		_, _ = w.Write([]byte(`[
			{"daily":{"weather_code":[61],"temperature_2m_max":[11.6],"temperature_2m_min":[6.2]}},
			{"daily":{"weather_code":[1],"temperature_2m_max":[14.2],"temperature_2m_min":[8.9]}}
		]`))
	}))
	defer srv.Close()

	places := []Place{UK[0], UK[5]}
	days, err := Fetch(context.Background(), srv.Client(), srv.URL, places, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 2 || days[0].Code != 61 || days[1].MaxC != 14.2 || days[1].Place.ID != "london" {
		t.Fatalf("got %+v", days)
	}
	s := Summary(days)
	if !strings.Contains(s, "Edinburgh: rain, high 12°C, low 6°C") || !strings.Contains(s, "London: sunny spells") {
		t.Fatalf("summary:\n%s", s)
	}
}

func TestFetchRejectsMismatchedResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"daily":{"weather_code":[3],"temperature_2m_max":[9],"temperature_2m_min":[4]}}`))
	}))
	defer srv.Close()
	if _, err := Fetch(context.Background(), srv.Client(), srv.URL, UK[:2], time.UTC); err == nil {
		t.Fatal("expected an error for one forecast for two places")
	}
}

func TestDescribe(t *testing.T) {
	for code, want := range map[int]string{0: "clear and sunny", 3: "cloudy", 63: "rain", 81: "showers", 95: "thunderstorms"} {
		if got := Describe(code); got != want {
			t.Errorf("Describe(%d) = %q, want %q", code, got, want)
		}
	}
}
