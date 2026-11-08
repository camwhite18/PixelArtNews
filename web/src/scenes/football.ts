// The FOOTBALL studio: a tactics studio with a video wall, the league table
// and a club scarf, and how each show dresses the video wall.
import type { Board } from '../api';
import type {
  BoardGraphics, Rect, SceneData, Text,
} from './data';
import {
  type Box, clip, disc, LIGHT, stars,
} from './draw';
import type { Show, ShowId } from './shows';

const LIME = '#7ddc4a';
const PAPER = '#f4f1e6';
const WALL: Box = {
  x: 152, y: 12, w: 146, h: 86,
};

function leagueTable(): Rect[] {
  const points = [34, 30, 27, 24, 20, 17];
  const crests = ['#ff4d5e', '#4aa3ff', '#ffd166', LIME, '#b48cff', PAPER];
  const rects: Rect[] = [
    [10, 22, 80, 74, '#3a5a44'], [12, 24, 76, 70, '#0a1a10'], [12, 24, 76, 10, LIME],
  ];
  points.forEach((p, i) => {
    const y = 38 + i * 9;
    rects.push(
      [15, y, 6, 6, '#2a4a34'],
      [23, y, 3, 6, crests[i]],
      [29, y + 2, 28 + ((i * 7) % 12), 2, '#c9e8c0'],
      [84 - p / 2, y + 1, p / 2, 4, i === 0 ? '#ffd166' : '#5a8a64'],
    );
  });
  return rects;
}

function scarf(x: number): Rect[] {
  const rects: Rect[] = [];
  for (let y = 12; y < 52; y += 4) rects.push([x, y, 8, 4, (y / 4) % 2 ? LIME : PAPER]);
  // fringe
  rects.push([x, 52, 1, 3, LIME], [x + 2, 52, 1, 4, PAPER]);
  rects.push([x + 4, 52, 1, 3, LIME], [x + 7, 52, 1, 4, PAPER]);
  return rects;
}

/** The tactics board: a striped pitch with two teams and a run marked on it. */
function tactics(): Rect[] {
  const rects: Rect[] = [[152, 12, 146, 86, '#06140c'], [156, 16, 138, 78, '#2f8a3a']];
  for (let x = 156; x < 294; x += 24) rects.push([x, 16, 12, 78, '#3a9a45']);
  const line = (x: number, y: number, w: number, h: number): Rect => [x, y, w, h, PAPER];
  rects.push(
    line(158, 18, 134, 1),
    line(158, 91, 134, 1),
    line(158, 18, 1, 74),
    line(291, 18, 1, 74),
    line(224, 18, 1, 74),
    line(158, 40, 14, 1),
    line(158, 68, 14, 1),
    line(171, 40, 1, 29),
    line(278, 40, 14, 1),
    line(278, 68, 14, 1),
    line(278, 40, 1, 29),
    [156, 48, 2, 12, PAPER],
    [292, 48, 2, 12, PAPER],
  );
  // Centre circle as a ring.
  disc(224, 55, 9, PAPER).forEach(([x, y, w]) => {
    rects.push([x, y, 1, 1, PAPER], [x + w - 1, y, 1, 1, PAPER]);
  });
  type Spot = [number, number];
  const red: Spot[] = [[176, 30], [176, 54], [176, 76], [198, 40], [198, 68], [214, 54]];
  const blue: Spot[] = [[272, 30], [272, 54], [272, 76], [250, 40], [250, 68], [236, 54]];
  red.forEach(([x, y]) => rects.push([x, y, 3, 3, '#ff4d5e']));
  blue.forEach(([x, y]) => rects.push([x, y, 3, 3, '#4aa3ff']));
  const run: Spot[] = [[202, 44], [208, 40], [214, 36], [220, 32]];
  run.forEach(([x, y]) => rects.push([x, y, 3, 1, '#ffd166']));
  rects.push([224, 30, 3, 3, '#ffd166'], [215, 55, 2, 2, PAPER, 'blink']);
  return rects;
}

/** The real league table on the studio board: club codes and points. */
export function footballBoard(b: Board): BoardGraphics {
  const rects: Rect[] = [[12, 35, 76, 59, '#0a1a10']];
  const texts: Text[] = [];
  b.rows.slice(0, 6).forEach((row, i) => {
    const y = 38 + i * 9;
    rects.push([15, y, 6, 6, i === 0 ? '#ffd166' : '#2a4a34']);
    texts.push(
      [24, y + 6, 8, '#c9e8c0', row.label.slice(0, 4)],
      [79, y + 6, 8, i === 0 ? '#ffd166' : '#c9e8c0', row.value, 'middle'],
    );
  });
  return { rects, texts };
}

export const footballScene: SceneData = {
  bg: '#0f2418',
  back: [
    [0, 0, 320, 180, '#0f2418'],
    [0, 102, 320, 2, '#0b1c12', 'dither'],
    [0, 104, 320, 14, '#0b1c12'],
    ...leagueTable(),
    ...scarf(124),
    [150, 10, 150, 90, LIME],
    ...tactics(),
    [216, 100, 18, 4, '#2a4a34'],
  ],
  front: [
    [50, 118, 220, 62, '#14261a'],
    [50, 154, 220, 26, '#060e09', 'dither'],
    [50, 118, 220, 4, LIME],
    [50, 150, 220, 2, '#0b1c12'],
    [130, 132, 60, 10, LIME],
    [150, 110, 8, 8, PAPER], [152, 112, 2, 2, '#0b0b14'], [155, 114, 2, 2, '#0b0b14'],
    [151, 115, 2, 2, '#0b0b14'],
  ],
  texts: [[15, 32, 8, '#06140c', 'TABLE']],
  seats: { one: 138, two: [96, 186] },
  prop: 236,
  screen: WALL,
  board: footballBoard,
};

// ---------- Shows ----------

const { morning: MORNING, dusk: DUSK, night: NIGHT } = LIGHT;
const TABLE_TEXT: Text = [15, 32, 8, '#06140c', 'TABLE'];

const KITS = [
  ['#ff4d5e', '#4aa3ff'], ['#ffd166', PAPER], [LIME, '#b48cff'],
  ['#4aa3ff', '#ff6fcf'], [PAPER, '#ff4d5e'],
];

function fixtures(): { back: Rect[]; texts: Text[] } {
  const times = ['12:30', '15:00', '15:00', '17:30', '20:00'];
  const back: Rect[] = [[152, 12, 146, 86, '#0a2014'], [158, 32, 134, 1, LIME]];
  const texts: Text[] = [TABLE_TEXT, [160, 29, 8, LIME, 'MATCHDAY']];
  times.forEach((t, i) => {
    const y = 38 + i * 12;
    const [a, b] = KITS[i];
    back.push(
      [160, y, 6, 6, a],
      [168, y + 2, 26, 2, '#c9e8c0'],
      [198, y + 2, 4, 2, '#5a8a64'],
      [206, y, 6, 6, b],
      [214, y + 2, 26, 2, '#c9e8c0'],
    );
    texts.push([262, y + 6, 8, '#ffd166', t]);
  });
  return { back, texts };
}

function liveScores(): { back: Rect[]; texts: Text[] } {
  const scores = ['2-1', '0-0', '3-3', '1-0'];
  const back: Rect[] = [[152, 12, 146, 86, '#06140c'], [158, 24, 4, 4, '#ff4d5e', 'blink']];
  const texts: Text[] = [TABLE_TEXT, [165, 29, 8, PAPER, 'LIVE SCORES']];
  scores.forEach((s, i) => {
    const y = 44 + i * 14;
    const [a, b] = KITS[i + 1];
    back.push(
      [160, y - 6, 6, 6, a],
      [168, y - 4, 34, 2, '#c9e8c0'],
      [240, y - 4, 34, 2, '#c9e8c0'],
      [278, y - 6, 6, 6, b],
    );
    texts.push([221, y, 8, '#ffd166', s, 'middle']);
  });
  return { back, texts };
}

function goalReplay(): Rect[] {
  return clip([
    [152, 12, 146, 86, '#050c08'],
    ...stars({
      x: 152, y: 12, w: 146, h: 24,
    }, 12, 31),
    [152, 36, 146, 8, '#141c18'],
    ...Array.from({ length: 24 }, (_, i): Rect => [154 + i * 6, 38, 2, 2, KITS[i % 5][i % 2]]),
    [152, 78, 146, 20, '#1e5a28'], [152, 78, 146, 1, PAPER],
    [200, 40, 2, 40, PAPER], [260, 40, 2, 40, PAPER], [200, 40, 62, 2, PAPER],
    [202, 42, 58, 36, '#a9a6b8', 'dither', 0.5],
    ...disc(244, 70, 3, PAPER).map((r): Rect => [r[0], r[1], r[2], r[3], r[4], 'blink']),
  ], WALL);
}

export const footballShows: Partial<Record<ShowId, Show>> = {
  breakfast: { tint: MORNING, ...fixtures() },
  // Daytime: the studio's own tactics board.
  evening: { tint: DUSK, ...liveScores() },
  overnight: {
    tint: NIGHT,
    back: goalReplay(),
    texts: [TABLE_TEXT, [162, 30, 8, '#ffd166', 'GOAL!', 'left', 'display']],
  },
};
