import type { Line, Rundown, Segment } from './generated/rundown';

export type {
  Line, Rundown, Segment, Source,
} from './generated/rundown';

export const startMs = (s: Segment) => Date.parse(s.start);
export const endMs = (s: Segment) => startMs(s) + s.durationS * 1000;

export interface OnAir {
  segment: Segment;
  offsetS: number;
}

/** The segment airing at `now` (ms since epoch) and the offset into it in seconds. */
export function onAir(r: Rundown | null, now: number): OnAir | null {
  const segment = r?.segments.find((s) => now >= startMs(s) && now < endMs(s));
  return segment ? { segment, offsetS: (now - startMs(segment)) / 1000 } : null;
}

/** The first segment starting after `now`. */
export function upNext(r: Rundown | null, now: number): Segment | null {
  return r?.segments.find((s) => startMs(s) > now) ?? null;
}

/** The line being spoken `offsetS` seconds into a segment. */
/** Index of the line being spoken `offsetS` into a segment, or -1 before the first. */
export function lineIndexAt(s: Segment, offsetS: number): number {
  // Lines are in speaking order; the current one is the last to have started.
  const firstUnstarted = s.lines.findIndex((l) => (l.startS ?? 0) > offsetS);
  return (firstUnstarted === -1 ? s.lines.length : firstUnstarted) - 1;
}

export function lineAt(s: Segment, offsetS: number): Line | null {
  return s.lines[lineIndexAt(s, offsetS)] ?? null;
}

/** True when the schedule ends within `withinMs`, so it is worth refetching. */
export function runningLow(r: Rundown | null, now: number, withinMs: number): boolean {
  if (!r || r.segments.length === 0) return true;
  return endMs(r.segments[r.segments.length - 1]) - now < withinMs;
}

const SEGMENT_LABELS: Record<Segment['type'], string> = {
  headlines: 'Headlines',
  story: 'Top Story',
  link: 'Coming Up',
  recap: 'Recap',
  breaking: 'Breaking News',
  advert: 'Break',
  idle: 'Off Air',
};

export const segmentLabel = (s: Segment) => SEGMENT_LABELS[s.type] ?? s.type;

export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});
