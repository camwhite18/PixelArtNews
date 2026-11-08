// Seasonal set dressing, by the viewer's date: a pumpkin for Halloween,
// poppies for Remembrance, tinsel and a tree for Christmas.
import type { Rect } from './data';
import { pine } from './draw';

export interface Season {
  id: 'halloween' | 'remembrance' | 'christmas';
  /** Across the top of the set, after the show's backdrop. */
  back?: Rect[];
  /** A small prop standing on the desk, its left edge at `x`. */
  prop?: (x: number) => Rect[];
  /** Presenters wear a poppy. */
  poppy?: boolean;
}

const INK = '#0b0b14';

function tinsel(): Rect[] {
  const colours = ['#ff4d5e', '#ffd166', '#3fae7a', '#4aa3ff'];
  const rects: Rect[] = [];
  for (let x = 0; x < 320; x += 4) {
    const dip = Math.round(3 * Math.sin((x / 320) * Math.PI * 6) ** 2);
    rects.push([x, dip, 4, 2, colours[(x / 4) % 2 ? 1 : 0]]);
    if (x % 40 === 20) {
      const n = (x - 20) / 40;
      rects.push([x + 1, dip + 2, 3, 3, colours[n % 4], n % 2 ? 'blink' : 'blink2']);
    }
  }
  return rects;
}

function tree(x: number): Rect[] {
  return [
    ...pine(x + 6, 118, 18, '#1e7a3a', '#6b3a1e'),
    [x + 5, 99, 3, 2, '#ffd166'],
    [x + 3, 106, 2, 2, '#ff4d5e', 'blink'], [x + 8, 109, 2, 2, '#4aa3ff', 'blink2'],
    [x + 4, 112, 2, 2, '#ffd166', 'blink2'],
  ];
}

function pumpkin(x: number): Rect[] {
  return [
    [x + 5, 105, 2, 3, '#3a8a3a'],
    [x + 1, 108, 10, 10, '#ff8a1f'], [x, 110, 12, 6, '#ff8a1f'],
    [x + 4, 108, 1, 10, '#d9661a'], [x + 7, 108, 1, 10, '#d9661a'],
    [x + 2, 111, 2, 2, INK], [x + 8, 111, 2, 2, INK], [x + 3, 115, 6, 1, INK],
  ];
}

/** A paper poppy on the lapel of a presenter whose head starts at `x`. */
export function poppy(x: number): Rect[] {
  return [[x - 9, 97, 4, 4, '#e3262f'], [x - 8, 98, 2, 2, INK], [x - 7, 101, 1, 3, '#2f6a2a']];
}

/** The season on a date, if any. */
export function seasonAt(date: Date): Season | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === 10 && d >= 25) return { id: 'halloween', prop: pumpkin };
  if (m === 11 && d <= 11) return { id: 'remembrance', poppy: true };
  if (m === 12 || (m === 1 && d <= 5)) return { id: 'christmas', back: tinsel(), prop: tree };
  return null;
}
