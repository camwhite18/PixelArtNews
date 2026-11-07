package rundown

import "time"

// Extend builds the next rundown without disturbing what is on air.
//
// Segments from prev that have already started are kept as they are (the one
// airing now must not change under viewers). The fresh segments are queued
// from the end of the last kept segment and repeated in rotation until the
// schedule reaches now+horizon. If fresh is empty, prev's unstarted segments
// are kept instead so the channel never goes dark.
func Extend(prev *Rundown, channel string, fresh []Segment, now time.Time, horizon time.Duration) Rundown {
	out := Rundown{Channel: channel, GeneratedAt: now.UTC()}
	cursor := now.UTC()

	if prev != nil {
		for _, s := range prev.Segments {
			if s.End().Before(now) || s.End().Equal(now) {
				continue // finished
			}
			if s.Start.After(now) && len(fresh) > 0 {
				break // not started yet: replaced by fresh content
			}
			out.Segments = append(out.Segments, s)
			cursor = s.End()
		}
	}

	if len(fresh) == 0 {
		return out
	}

	end := now.Add(horizon)
	for i := 0; cursor.Before(end); i++ {
		s := fresh[i%len(fresh)]
		if s.DurationS <= 0 {
			break // guard against an infinite loop on bad input
		}
		s.Start = cursor
		out.Segments = append(out.Segments, s)
		cursor = s.End()
	}
	return out
}

// OnAir returns the segment airing at t and the offset into it, if any.
func (r Rundown) OnAir(t time.Time) (Segment, time.Duration, bool) {
	for _, s := range r.Segments {
		if !t.Before(s.Start) && t.Before(s.End()) {
			return s, t.Sub(s.Start), true
		}
	}
	return Segment{}, 0, false
}
