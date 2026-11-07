// Presenters as pixel sprites, built from each presenter's look (stored on the
// server, see migrations/00005_presenter_shifts.sql) so any team can sit at
// any studio desk. Coordinates are on the 320x180 studio canvas; `x` is the
// left edge of the head and every head sits at the same height.
import type { Rect } from './data';

export interface Look {
  skin: string;
  hair?: string;
  hairStyle?: 'long' | 'short' | 'side' | 'bushy' | 'afro' | 'bun' | 'buzz';
  outfit: string;
  shirt?: string;
  neck?: 'tie' | 'bowtie' | 'necklace' | 'zip' | 'strings' | 'badge';
  neckColour?: string;
  glasses?: boolean;
  mustache?: string;
  beard?: string;
  headset?: boolean;
  alien?: boolean;
}

/** Which way a presenter looks: towards their co-host, or at the camera. */
export type Facing = -1 | 0 | 1;

const INK = '#0b0b14';
const LENS = '#cfe8ff';
const LIP = '#7a2f2f';
const MOUTH = '#3a1010';
const HEAD_Y = 66;

/** Shown while a presenter's look hasn't loaded. */
export const DEFAULT_LOOK: Look = {
  skin: '#e8b48a', hair: '#2b1a10', hairStyle: 'short', outfit: '#3a3756', shirt: '#f4f1e6',
};

function hairBehind(x: number, l: Look): Rect[] {
  const c = l.hair ?? INK;
  switch (l.hairStyle) {
    case 'long':
      return [[x - 2, 64, 4, 30, c], [x + 20, 64, 4, 30, c]];
    case 'bushy':
      return [[x - 4, 62, 4, 12, c], [x + 22, 62, 4, 12, c]];
    case 'afro':
      return [[x - 6, 52, 34, 18, c], [x - 6, 60, 6, 20, c], [x + 22, 60, 6, 20, c]];
    case 'bun':
      return [[x + 7, 54, 8, 6, c]];
    default:
      return [];
  }
}

function hairOnTop(x: number, l: Look): Rect[] {
  const c = l.hair ?? INK;
  switch (l.hairStyle) {
    case 'long':
    case 'bushy':
      return [[x - 2, 58, 26, 10, c]];
    case 'afro':
      return [[x, 64, 22, 4, c]];
    case 'side':
      return [[x, 60, 22, 8, c], [x - 2, 64, 4, 8, c]];
    case 'buzz':
      return [[x, 62, 22, 5, c]];
    case 'short':
    case 'bun':
      return [[x, 60, 22, 8, c]];
    default:
      return [];
  }
}

function eyes(x: number, l: Look, facing: Facing): Rect[] {
  if (l.glasses) {
    const pupil = facing > 0 ? 2 : 0;
    return [
      [x + 3, 73, 6, 5, INK], [x + 4, 74, 4, 3, LENS], [x + 4 + pupil, 75, 2, 2, INK],
      [x + 13, 73, 6, 5, INK], [x + 14, 74, 4, 3, LENS], [x + 14 + pupil, 75, 2, 2, INK],
      [x + 9, 74, 4, 1, INK],
    ];
  }
  if (facing === 0) return [[x + 5, 74, 3, 3, INK], [x + 14, 74, 3, 3, INK]];
  const dx = facing > 0 ? 1 : 0;
  return [[x + 5 + dx, 74, 2, 3, INK], [x + 14 + dx, 74, 2, 3, INK]];
}

function neckwear(x: number, l: Look): Rect[] {
  const c = l.neckColour ?? INK;
  switch (l.neck) {
    case 'tie':
      return [[x + 9, 94, 4, 12, c]];
    case 'bowtie':
      return [[x + 5, 93, 12, 3, c]];
    case 'necklace':
      return [[x + 8, 98, 6, 2, c]];
    case 'zip':
      return [[x + 4, 92, 14, 3, c], [x + 10, 92, 2, 30, c]];
    case 'strings':
      return [
        [x - 2, 92, 26, 4, INK, undefined, 0.35], // hood
        [x + 7, 96, 1, 8, c],
        [x + 14, 96, 1, 8, c],
      ];
    case 'badge':
      return [[x + 10, 98, 6, 6, c]];
    default:
      return [];
  }
}

/** A jacket 50px wide with dithered shading down its sides. */
function torso(left: number, colour: string): Rect[] {
  return [
    [left, 92, 50, 30, colour],
    [left, 94, 4, 28, INK, 'dither', 0.55],
    [left + 46, 94, 4, 28, INK, 'dither', 0.55],
    [left + 4, 112, 42, 6, INK, 'dither', 0.3],
  ];
}

function alien(x: number, l: Look, facing: Facing, mouthOpen: boolean): Rect[] {
  const shine = facing < 0 ? 1 : 3;
  const tip = l.neckColour ?? '#ff6fcf';
  return [
    [x + 6, 52, 2, 10, l.skin], [x + 18, 52, 2, 10, l.skin],
    [x + 5, 49, 4, 3, tip, 'blink'], [x + 17, 49, 4, 3, tip, 'blink2'],
    [x, 62, 26, 26, l.skin],
    [x + 4, 70, 7, 8, INK], [x + 15, 70, 7, 8, INK],
    [x + 4 + shine, 71, 2, 2, '#f4f1e6'],
    [x + 15 + shine, 71, 2, 2, '#f4f1e6'],
    mouthOpen ? [x + 9, 81, 8, 4, INK] : [x + 9, 82, 8, 2, '#1e5a12'],
    [x + 9, 88, 8, 4, l.skin],
    ...torso(x - 12, l.outfit),
    [x, 92, 26, 3, INK, undefined, 0.3],
    ...neckwear(x, l),
  ];
}

/** The presenter's head and body, drawn between the set and the desk. */
export function presenterRects(x: number, l: Look, facing: Facing, mouthOpen: boolean): Rect[] {
  if (l.alien) return alien(x, l, facing, mouthOpen);
  const rects: Rect[] = [
    ...hairBehind(x, l),
    [x, HEAD_Y, 22, 22, l.skin],
    [x + 20, HEAD_Y + 4, 2, 18, INK, 'dither', 0.18], // cheek shade
    ...hairOnTop(x, l),
    ...eyes(x, l, facing),
  ];
  if (l.beard) rects.push([x, 80, 22, 8, l.beard]);
  if (l.mustache) rects.push([x + 7, 80, 10, 2, l.mustache]);
  rects.push(mouthOpen ? [x + 8, 81, 6, 4, MOUTH] : [x + 8, 82, 6, 2, LIP]);
  if (l.headset) {
    rects.push([x - 4, 70, 4, 10, INK], [x, 80, 7, 1, INK], [x + 6, 80, 2, 2, '#3fe0b0']);
  }
  rects.push([x + 7, 88, 8, 4, l.skin], [x + 7, 88, 8, 1, INK, undefined, 0.25]);
  rects.push(...torso(x - 14, l.outfit));
  if (l.shirt) rects.push([x + 6, 92, 10, 9, l.shirt]);
  rects.push(...neckwear(x, l));
  return rects;
}

/** Hands resting on the desk, drawn in front of it. */
export function handRects(x: number, l: Look): Rect[] {
  const [left, right] = l.alien ? [x - 8, x + 24] : [x - 10, x + 22];
  return [[left, 114, 10, 6, l.skin], [right, 114, 10, 6, l.skin]];
}

/** Seat positions for a team of `n` (1 or 2) at a studio's desk. */
export function seatsFor(
  seats: { one: number; two: [number, number] },
  n: number,
): number[] {
  return n >= 2 ? seats.two : [seats.one];
}

/** Pairs face each other; a solo host faces the camera. */
export const facingFor = (seat: number, n: number): Facing => {
  if (n < 2) return 0;
  return seat === 0 ? 1 : -1;
};
