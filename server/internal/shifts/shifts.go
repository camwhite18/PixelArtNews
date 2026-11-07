// Package shifts is the presenters' daily timetable: like a real news channel,
// each channel has a breakfast, daytime, evening and overnight team.
package shifts

import "time"

// Shift is one block of the day, starting at a local wall-clock time.
type Shift struct {
	ID    string
	Name  string
	Start time.Duration // since local midnight
}

// Timetable is the same for every channel, in order through the day.
var Timetable = []Shift{
	{ID: "breakfast", Name: "Breakfast", Start: 6 * time.Hour},
	{ID: "daytime", Name: "Daytime", Start: 10 * time.Hour},
	{ID: "evening", Name: "Evening", Start: 17 * time.Hour},
	{ID: "overnight", Name: "Overnight", Start: 23 * time.Hour},
}

// Slot is a shift on a particular day.
type Slot struct {
	Shift
	From  time.Time
	Until time.Time
}

// At returns the shift on air at t, in loc, and the one after it.
func At(t time.Time, loc *time.Location) (current, next Slot) {
	local := t.In(loc)
	midnight := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)

	// Every shift start from yesterday to tomorrow, in order. Built from the
	// calendar date (not midnight + duration) so clock changes are handled.
	var starts []Slot
	for day := -1; day <= 1; day++ {
		d := midnight.AddDate(0, 0, day)
		for _, s := range Timetable {
			h, m := int(s.Start/time.Hour), int(s.Start%time.Hour/time.Minute)
			from := time.Date(d.Year(), d.Month(), d.Day(), h, m, 0, 0, loc)
			starts = append(starts, Slot{Shift: s, From: from})
		}
	}
	for i := range starts[:len(starts)-1] {
		starts[i].Until = starts[i+1].From
	}
	for i := 0; i < len(starts)-1; i++ {
		if !t.Before(starts[i].From) && t.Before(starts[i].Until) {
			return starts[i], starts[i+1]
		}
	}
	// Unreachable for a sane timetable; fall back to the first slot.
	return starts[0], starts[1]
}
