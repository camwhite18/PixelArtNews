// Camera cuts: a wide shot of the studio, or a close-up of one presenter.
// A close-up is the studio drawn at 2x around that presenter's seat, so its
// pixels are twice the size, as when a sprite game zooms in.

export type Shot = { kind: 'wide' } | { kind: 'close'; seat: number };

export const WIDE: Shot = { kind: 'wide' };
export const ZOOM = 2;

/**
 * The shot for a line of a segment: each segment opens wide, then cuts to
 * whoever is speaking, going back to wide every third line so viewers keep
 * seeing the whole set.
 */
export function shotFor(line: number | null, seat: number | null): Shot {
  if (line === null || seat === null || seat < 0 || line === 0) return WIDE;
  return line % 3 === 2 ? WIDE : { kind: 'close', seat };
}

/**
 * Top-left corner of a close-up on a presenter whose head starts at `headX`,
 * on a 320x180 studio: head centred, desk top in the lower third of frame.
 */
export function closeUpOrigin(headX: number): [number, number] {
  const w = 320 / ZOOM;
  const x = Math.min(Math.max(Math.round(headX + 11 - w / 2), 0), 320 - w);
  return [x, 46];
}
