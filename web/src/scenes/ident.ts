// Channel idents and stings, drawn over the studio while the jingle at the
// start of a segment plays (`introS` in the rundown).
//
// - ident: a full-screen channel card with sliding stripes, opening a show.
// - sting: a band of the channel's colour sweeping across, between stories.
import type { Rect, Text } from './data';
import { clip } from './draw';

const INK = '#0b0b14';
const PAPER = '#f4f1e6';
const W = 320;
const H = 180;

export interface Intro {
  style: 'ident' | 'sting';
  /** 0 at the start of the jingle, 1 at its end. */
  progress: number;
  /** Channel name, e.g. "WORLD". */
  name: string;
  accent: string;
}

/** Eases in and out: the card wipes in, holds, and wipes out. */
function cover(progress: number): number {
  if (progress < 0.15) return progress / 0.15;
  if (progress > 0.85) return (1 - progress) / 0.15;
  return 1;
}

export function introGraphics({
  style, progress, name, accent,
}: Intro): { rects: Rect[]; texts: Text[] } {
  const p = Math.min(Math.max(progress, 0), 1);
  if (style === 'sting') {
    const x = Math.round(p * (W + 120)) - 120;
    const band: Rect[] = [
      [x, 0, 24, H, accent],
      [x + 28, 0, 12, H, PAPER],
      [x + 44, 0, 60, H, accent],
      [x + 104, 0, 16, H, accent, 'dither'],
    ];
    return {
      rects: clip(band, {
        x: 0, y: 0, w: W, h: H,
      }),
      texts: [],
    };
  }
  // Ident: the card closes in from both sides like shutters.
  const half = Math.round((W / 2) * cover(p));
  const rects: Rect[] = [
    [0, 0, half, H, accent],
    [W - half, 0, half, H, accent],
  ];
  const stripeShift = Math.floor(p * 64) % 16;
  for (let y = -16 + stripeShift; y < H; y += 16) {
    if (y + 4 > 0) {
      const top = Math.max(0, y);
      rects.push([0, top, half, y + 4 - top, INK, 'dither', 0.35]);
      rects.push([W - half, top, half, y + 4 - top, INK, 'dither', 0.35]);
    }
  }
  if (half < W / 2) return { rects, texts: [] };
  rects.push([88, 60, 144, 60, INK], [88, 60, 144, 3, PAPER], [88, 117, 144, 3, PAPER]);
  return {
    rects,
    texts: [
      [W / 2, 92, 16, PAPER, 'PXN', 'middle', 'display'],
      [W / 2, 110, 16, accent, name, 'middle'],
    ],
  };
}
