package rundown

import "time"

// Block is fresh content that airs on a loop from From until the next block
// starts (or the horizon). A shift change within the horizon is a second
// block: the next team's segments, from the moment their shift starts.
type Block struct {
	From     time.Time
	Segments []Segment
}

// Extend builds the next rundown from one block of fresh segments.
func Extend(prev *Rundown, channel string, fresh []Segment, now time.Time, horizon time.Duration) Rundown {
	var blocks []Block
	if len(fresh) > 0 {
		blocks = []Block{{From: now, Segments: fresh}}
	}
	return ExtendBlocks(prev, channel, blocks, now, horizon)
}

// ExtendBlocks builds the next rundown without disturbing what is on air.
//
// Segments from prev that have already started are kept as they are (the one
// airing now must not change under viewers). Each block's segments are then
// queued in rotation until the next block begins, and the last block's until
// the schedule reaches now+horizon. A segment that is playing when the next
// block begins finishes first, so a handover can start a few seconds late.
// If there are no blocks, prev's unstarted segments are kept instead so the
// channel never goes dark.
func ExtendBlocks(prev *Rundown, channel string, blocks []Block, now time.Time, horizon time.Duration) Rundown {
	out := Rundown{Channel: channel, GeneratedAt: now.UTC()}
	cursor := now.UTC()

	if prev != nil {
		for _, s := range prev.Segments {
			if !s.End().After(now) {
				continue // finished
			}
			if s.Start.After(now) && len(blocks) > 0 {
				break // not started yet: replaced by fresh content
			}
			out.Segments = append(out.Segments, s)
			cursor = s.End()
		}
	}

	end := now.Add(horizon)
	for i, b := range blocks {
		until := end
		if i+1 < len(blocks) && blocks[i+1].From.Before(end) {
			until = blocks[i+1].From
		}
		if b.From.After(cursor) {
			cursor = b.From // nothing may air before its block starts
		}
		for n := 0; cursor.Before(until) && len(b.Segments) > 0; n++ {
			s := b.Segments[n%len(b.Segments)]
			if s.DurationS <= 0 {
				break // guard against an infinite loop on bad input
			}
			s.Start = cursor
			out.Segments = append(out.Segments, s)
			cursor = s.End()
		}
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
