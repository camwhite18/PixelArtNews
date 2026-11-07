// Studio wall clocks that tell the real time in their city.
import type { Rect } from './data';

export interface Clock {
  /** Centre of the face. */
  x: number;
  y: number;
  /** IANA time zone, e.g. "Europe/London". */
  zone: string;
}

const INK = '#0b0b14';
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Hours (0-23) and minutes in a time zone. */
export function timeIn(zone: string, date: Date): [number, number] {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  const parts = f.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return [get('hour'), get('minute')];
}

/** A 2px-thick pixel line from the centre out at `angle` (radians, 0 = 12 o'clock). */
function hand(x: number, y: number, angle: number, length: number): Rect[] {
  const rects: Rect[] = [];
  const seen = new Set<string>();
  for (let i = 0; i <= length; i += 1) {
    const px = Math.round(x + Math.sin(angle) * i);
    const py = Math.round(y - Math.cos(angle) * i);
    const key = `${px},${py}`;
    if (!seen.has(key)) {
      seen.add(key);
      rects.push([px - 1, py - 1, 2, 2, INK]);
    }
  }
  return rects;
}

/** The hands of a clock showing hours and minutes. */
export function clockHands(c: Clock, hours: number, minutes: number): Rect[] {
  const minuteAngle = (minutes / 60) * 2 * Math.PI;
  const hourAngle = (((hours % 12) + minutes / 60) / 12) * 2 * Math.PI;
  return [...hand(c.x, c.y, hourAngle, 5), ...hand(c.x, c.y, minuteAngle, 7)];
}

const handsCache = new Map<string, Rect[]>();

/** Every clock's hands for this moment, worked out once a minute. */
export function clocksAt(clocks: Clock[], date: Date): Rect[] {
  return clocks.flatMap((c) => {
    const [h, m] = timeIn(c.zone, date);
    const key = `${c.x},${c.y},${h}:${m}`;
    let rects = handsCache.get(key);
    if (!rects) {
      if (handsCache.size > 64) handsCache.clear();
      rects = clockHands(c, h, m);
      handsCache.set(key, rects);
    }
    return rects;
  });
}
