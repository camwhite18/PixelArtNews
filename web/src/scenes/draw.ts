// Small pixel-art helpers for building studio art out of rects.
import type { Rect } from './data';

export interface Box { x: number; y: number; w: number; h: number }

/** Cuts rects down to a box (a screen or window), dropping any left empty. */
export function clip(rects: Rect[], b: Box): Rect[] {
  return rects.flatMap(([x, y, w, h, ...rest]): Rect[] => {
    const x0 = Math.max(x, b.x);
    const y0 = Math.max(y, b.y);
    const x1 = Math.min(x + w, b.x + b.w);
    const y1 = Math.min(y + h, b.y + b.h);
    return x1 > x0 && y1 > y0 ? [[x0, y0, x1 - x0, y1 - y0, ...rest]] : [];
  });
}

/**
 * Horizontal bands of colour, top to bottom, with a dithered seam between
 * each pair: the classic pixel-art gradient.
 */
export function bands(b: Box, colours: string[]): Rect[] {
  const rects: Rect[] = [];
  const step = b.h / colours.length;
  colours.forEach((c, i) => {
    const y = b.y + Math.round(i * step);
    const next = b.y + Math.round((i + 1) * step);
    rects.push([b.x, y, b.w, next - y, c]);
    if (i > 0) rects.push([b.x, y - 2, b.w, 2, c, 'dither']);
  });
  return rects;
}

/** A filled pixel circle, one rect per row. */
export function disc(cx: number, cy: number, r: number, colour: string): Rect[] {
  const rects: Rect[] = [];
  for (let dy = -r; dy < r; dy += 1) {
    const half = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2));
    if (half > 0) rects.push([cx - half, cy + dy, half * 2, 1, colour]);
  }
  return rects;
}

/** Deterministic pseudo-random numbers, so a backdrop is the same every frame. */
export function rng(seed: number) {
  const m = 2 ** 32;
  let s = Math.abs(Math.floor(seed)) % m;
  return () => {
    s = (s * 1664525 + 1013904223) % m; // exact: stays below 2^53
    return s / m;
  };
}

/** A scatter of 1px and 2px stars; a few twinkle. */
export function stars(b: Box, n: number, seed: number, colour = '#f4f1e6'): Rect[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i): Rect => {
    const big = r() < 0.2;
    const x = b.x + Math.floor(r() * (b.w - 2));
    const y = b.y + Math.floor(r() * (b.h - 2));
    if (i % 5 === 0) return [x, y, big ? 2 : 1, big ? 2 : 1, colour, i % 2 ? 'blink' : 'blink2'];
    return [x, y, big ? 2 : 1, big ? 2 : 1, colour];
  });
}

/**
 * City buildings standing on `baseY` across a box, up to `maxH` tall, with a
 * grid of windows of which roughly `lit` (0..1) are on. Some lit windows
 * flicker.
 */
export function skyline(
  b: Box,
  baseY: number,
  seed: number,
  colour: string,
  window: string,
  lit: number,
  maxH = baseY - b.y - 4,
): Rect[] {
  const r = rng(seed);
  const rects: Rect[] = [];
  for (let x = b.x - 4; x < b.x + b.w;) {
    const w = 10 + Math.floor(r() * 14);
    const h = Math.min(maxH, 14 + Math.floor(r() * (maxH - 10)));
    const top = baseY - h;
    rects.push([x, top, w, h, colour]);
    if (r() < 0.3) rects.push([x + Math.floor(w / 2), top - 5, 1, 5, colour]); // mast
    for (let wy = top + 3; wy < baseY - 3; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const on = r() < lit;
        if (on) rects.push([wx, wy, 1, 2, window, r() < 0.06 ? 'blink2' : undefined]);
      }
    }
    x += w + Math.floor(r() * 3);
  }
  return clip(rects, b);
}

/** A stacked-rect pine tree with its trunk's foot at (cx, baseY). */
export function pine(cx: number, baseY: number, h: number, colour: string, trunk: string): Rect[] {
  const rects: Rect[] = [[cx - 1, baseY - 4, 3, 4, trunk]];
  const rows = Math.floor((h - 4) / 3);
  for (let i = 0; i < rows; i += 1) {
    const half = Math.max(1, Math.round(((i + 1) / rows) * (h / 3)));
    rects.push([cx - half, baseY - 4 - (rows - i) * 3, half * 2 + 1, 3, colour]);
  }
  return rects;
}
