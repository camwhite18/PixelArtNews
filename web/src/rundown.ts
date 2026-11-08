import type { Line, Rundown, Segment } from './generated/rundown';

export type {
  Line, Rundown, Segment, Source, WeatherPlace,
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
  weather: 'Weather',
  idle: 'Off Air',
};

export const segmentLabel = (s: Segment) => SEGMENT_LABELS[s.type] ?? s.type;

export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Splits a line into caption chunks of at most `max` characters, breaking
 * between words into chunks of about equal length (no one-word stragglers),
 * so each fits a two-line caption box.
 */
export function captionChunks(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const target = Math.ceil(text.length / Math.ceil(text.length / max));
  const chunks: string[] = [];
  let current = '';
  words.forEach((word) => {
    const longer = current ? `${current} ${word}` : word;
    if (current && (longer.length > max || current.length >= target)) {
      chunks.push(current);
      current = word;
    } else {
      current = longer;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

/**
 * The caption chunk showing `offsetS` into a segment for line `index`: the
 * line's time is shared between its chunks by length, so long lines turn
 * over like broadcast captions instead of growing the box.
 */
export function captionAt(s: Segment, index: number, offsetS: number, max: number): string {
  const line = s.lines[index];
  if (!line) return '';
  const chunks = captionChunks(line.text, max);
  const start = line.startS ?? 0;
  const end = s.lines[index + 1]?.startS ?? s.durationS;
  const progress = end > start ? (offsetS - start) / (end - start) : 0;
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let seen = 0;
  const i = chunks.findIndex((c) => {
    seen += c.length;
    return progress < seen / total;
  });
  return chunks[i === -1 ? chunks.length - 1 : i] ?? '';
}
