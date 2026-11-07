package shifts

import (
	"testing"
	"time"
)

func london(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func TestAtPicksTheShiftOnAir(t *testing.T) {
	loc := london(t)
	cases := []struct {
		at       string
		cur, nxt string
	}{
		{"2026-11-07 06:00", "breakfast", "daytime"},
		{"2026-11-07 09:59", "breakfast", "daytime"},
		{"2026-11-07 10:00", "daytime", "evening"},
		{"2026-11-07 21:30", "evening", "overnight"},
		{"2026-11-07 23:30", "overnight", "breakfast"},
		{"2026-11-08 02:00", "overnight", "breakfast"}, // after midnight, still last night's team
	}
	for _, c := range cases {
		tm, err := time.ParseInLocation("2006-01-02 15:04", c.at, loc)
		if err != nil {
			t.Fatal(err)
		}
		cur, nxt := At(tm, loc)
		if cur.ID != c.cur || nxt.ID != c.nxt {
			t.Errorf("%s: got %s then %s, want %s then %s", c.at, cur.ID, nxt.ID, c.cur, c.nxt)
		}
		if !cur.Until.Equal(nxt.From) {
			t.Errorf("%s: current shift should end when the next starts", c.at)
		}
	}
}

func TestOvernightSpansMidnight(t *testing.T) {
	loc := london(t)
	tm := time.Date(2026, 11, 8, 2, 0, 0, 0, loc)
	cur, _ := At(tm, loc)
	want := time.Date(2026, 11, 7, 23, 0, 0, 0, loc)
	if !cur.From.Equal(want) {
		t.Fatalf("overnight began %v, want %v", cur.From, want)
	}
	if got := cur.Until.Sub(cur.From); got != 7*time.Hour {
		t.Fatalf("overnight lasts %v, want 7h", got)
	}
}

func TestShiftsFollowTheClocksChanging(t *testing.T) {
	loc := london(t)
	// UK clocks went back at 02:00 BST on 25 October 2026: that night's
	// overnight shift lasts 8 hours of real time, but breakfast still starts
	// at 06:00 local.
	tm := time.Date(2026, 10, 25, 3, 0, 0, 0, loc)
	cur, nxt := At(tm, loc)
	if cur.ID != "overnight" || nxt.ID != "breakfast" {
		t.Fatalf("got %s then %s", cur.ID, nxt.ID)
	}
	if h := nxt.From.In(loc).Hour(); h != 6 {
		t.Fatalf("breakfast starts at %d:00 local, want 6:00", h)
	}
	if got := cur.Until.Sub(cur.From); got != 8*time.Hour {
		t.Fatalf("overnight lasted %v, want 8h", got)
	}
}
