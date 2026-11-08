// The breakfast weather map: a pixel map of the UK with each city's weather
// and high, drawn on the World studio's screen during a weather segment.
import type { WeatherPlace } from '../rundown';
import type { Rect, Text } from './data';
import type { Box } from './draw';

const SEA = '#1d4f8c';
const LAND = '#3fae7a';
const COAST = '#2f8a5a';
const SCALE = 2;

// The UK, north at the top, one character per map cell ("#" = land).
const MAP = [
  '........##..............',
  '.......####.###.........',
  '......#########.........',
  '.....##########.........',
  '......#########.........',
  '.....##########.........',
  '....###########.........',
  '.....##########.........',
  '......#########.........',
  '.....#########..........',
  '....##########..........',
  '.....##########.........',
  '......#########.........',
  '.......########.........',
  '........########........',
  '.........#######........',
  '##.......########.......',
  '###.......#######.......',
  '####......########......',
  '####.......#######......',
  '###........########.....',
  '.#.........########.....',
  '...........#########....',
  '..........##########....',
  '..........###########...',
  '..........###########...',
  '........#############...',
  '.......##############...',
  '.......###############..',
  '........##############..',
  '.......###############..',
  '........###############.',
  '.........##############.',
  '...........############.',
  '.......###############..',
  '.....##############.....',
  '...#############........',
  '..##########............',
  '.######.................',
];

/** Where each city sits on the map, in map cells. */
export const CITIES: Record<string, [number, number]> = {
  edinburgh: [11, 12],
  newcastle: [15, 17],
  belfast: [2, 18],
  manchester: [13, 25],
  cardiff: [9, 32],
  london: [19, 32],
  plymouth: [6, 36],
};

// 7x7 weather symbols.
const SYMBOLS: Record<string, string[]> = {
  sun: ['...y...', '.y.y.y.', '..yyy..', 'yyyyyyy', '..yyy..', '.y.y.y.', '...y...'],
  part: ['.y.....', 'yyy....', '.yww...', '.wwwww.', 'wwwwwww', '.wwwww.', '.......'],
  cloud: ['.......', '..www..', '.wwwww.', 'wwwwwww', 'wwwwwww', '.wwwww.', '.......'],
  rain: ['..sss..', '.sssss.', 'sssssss', '.......', '.b.b.b.', 'b.b.b..', '.......'],
  snow: ['..sss..', '.sssss.', 'sssssss', '.......', '.w.w.w.', '..w.w..', '.w.w.w.'],
  storm: ['..sss..', '.sssss.', 'sssssss', '...yy..', '..yy...', '.yyyy..', '...y...'],
  fog: ['.......', 'sssssss', '.......', 'sssssss', '.......', 'sssssss', '.......'],
};
const COLOURS: Record<string, string> = {
  y: '#ffd166', w: '#f4f1e6', s: '#a9a6b8', b: '#4aa3ff',
};

/** The symbol for a WMO weather code. */
export function symbolFor(code: number): string {
  if (code === 0) return 'sun';
  if (code <= 2) return 'part';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloud';
}

function symbolRects(name: string, x: number, y: number): Rect[] {
  return (SYMBOLS[name] ?? []).flatMap((row, ry) => [...row].flatMap((c, rx): Rect[] => (
    c === '.' ? [] : [[x + rx, y + ry, 1, 1, COLOURS[c]]]
  )));
}

/**
 * The map in a screen with each place's symbol and high. It sits a little
 * right of centre, in the gap between a pair of presenters' heads.
 */
export function weatherMap(screen: Box, places: WeatherPlace[]): { rects: Rect[]; texts: Text[] } {
  const w = MAP[0].length * SCALE;
  const h = MAP.length * SCALE;
  const x0 = Math.round(screen.x + (screen.w - w) / 2 + 16);
  const y0 = Math.round(screen.y + (screen.h - h) / 2);
  const rects: Rect[] = [[screen.x, screen.y, screen.w, screen.h, SEA]];
  MAP.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === '#') rects.push([x0 + rx * SCALE, y0 + ry * SCALE, SCALE, SCALE, LAND]);
    });
  });
  // A dithered shoreline on the land's lower edge, for depth.
  MAP.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === '#' && MAP[ry + 1]?.[rx] !== '#') {
        rects.push([x0 + rx * SCALE, y0 + ry * SCALE + 1, SCALE, 1, COAST]);
      }
    });
  });
  const texts: Text[] = [
    // Below the channel logo, above the presenters' heads.
    [screen.x + 6, screen.y + 20, 8, '#f4f1e6', 'UK WEATHER'],
    [screen.x + 6, screen.y + 30, 8, '#a9c8ff', 'DATA: OPEN-METEO'],
  ];
  places.forEach((p) => {
    const cell = CITIES[p.place];
    if (!cell) return;
    const cx = x0 + cell[0] * SCALE;
    const cy = y0 + cell[1] * SCALE;
    rects.push([cx - 4, cy - 4, 9, 9, '#0b0b14', undefined, 0.55]);
    rects.push(...symbolRects(symbolFor(p.code), cx - 3, cy - 3));
    texts.push([cx + 6, cy + 3, 8, '#f4f1e6', `${Math.round(p.maxC)}°`]);
  });
  return { rects, texts };
}
