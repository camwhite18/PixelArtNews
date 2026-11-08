// The F1 studio: a pit-wall set with a timing tower, a view onto the track,
// a tyre stack and a helmet on the desk, and how each show dresses the track.
import type { Board } from '../api';
import type {
  BoardGraphics, Rect, SceneData, Text,
} from './data';
import {
  bands, type Box, clip, disc, LIGHT, skyline, stars,
} from './draw';
import type { Show, ShowId } from './shows';

const RED = '#e3262f';
const PAPER = '#f4f1e6';
const INK = '#0b0b14';
const VIEW: Box = {
  x: 122, y: 12, w: 182, h: 80,
};
const SKY: Box = {
  x: 122, y: 12, w: 182, h: 30,
};
const TEAMS = [
  '#ff8a1f', '#2a5cff', RED, '#2fd6c8', '#2f8a3a',
  PAPER, '#ffd166', '#b48cff', '#ff6fcf', '#a9a6b8',
];

/** A side-on car facing right, its rear wing at (x, y). */
function car(x: number, y: number, colour: string): Rect[] {
  return [
    [x, y, 2, 4, INK], [x + 2, y + 2, 16, 3, colour], [x + 18, y + 3, 3, 2, colour],
    [x + 8, y, 3, 2, '#ffd166'], [x + 20, y + 5, 3, 1, INK],
    [x + 3, y + 4, 4, 3, INK], [x + 14, y + 4, 4, 3, INK],
    // speed lines
    [x - 12, y + 2, 8, 1, PAPER, 'blink', 0.6], [x - 16, y + 4, 10, 1, PAPER, 'blink2', 0.6],
  ];
}

function kerb(y: number): Rect[] {
  return Array.from({ length: 31 }, (_, i): Rect => [122 + i * 6, y, 6, 2, i % 2 ? PAPER : RED]);
}

/** The view from the pit wall: sky, grandstand, track and cars. */
function track(sky: Rect[], crowd: number, cars: Rect[], extra: Rect[] = []): Rect[] {
  const fans: Rect[] = [];
  for (let i = 0; i < crowd; i += 1) {
    fans.push([124 + ((i * 37) % 178), 46 + ((i * 5) % 3) * 3, 2, 2, TEAMS[i % TEAMS.length]]);
  }
  return clip([
    ...sky,
    ...extra,
    [122, 42, 182, 14, '#3a3a48'], [122, 42, 182, 2, '#5a5a6a'],
    ...fans,
    [122, 56, 182, 4, '#1a1a22'],
    ...Array.from({ length: 23 }, (_, i): Rect => [124 + i * 8, 56, 1, 4, '#5a5a6a']),
    [122, 60, 182, 22, '#3a3a44'],
    ...kerb(60), ...kerb(80),
    [122, 70, 182, 1, '#5a5a66'],
    [122, 82, 182, 10, '#2f8a3a'],
    ...cars,
  ], VIEW);
}

function timingTower(): Rect[] {
  const rects: Rect[] = [[10, 24, 52, 76, '#3a3a48'], [12, 26, 48, 72, INK], [12, 26, 48, 9, RED]];
  TEAMS.forEach((team, i) => {
    const y = 38 + i * 6;
    rects.push(
      [14, y, 4, 5, '#3a3a48'],
      [19, y, 2, 5, team],
      [23, y + 1, 20 + ((i * 5) % 7), 3, '#e9e6dc'],
      [48, y + 1, 10, 3, i === 3 ? '#b48cff' : '#5a5a6a'],
    );
  });
  return rects;
}

function tyres(): Rect[] {
  return [0, 1, 2].flatMap((i): Rect[] => {
    const y = 94 + i * 9;
    const band = i === 1 ? '#ffd166' : RED;
    return [[14, y, 28, 8, '#1a1a1e'], [14, y + 3, 28, 2, band], [16, y, 24, 1, '#3a3a44']];
  });
}

const DAY_SKY = bands(SKY, ['#3a8ae0', '#6ab0f4', '#a8d4f8']);

const TEAM_COLOURS: Record<string, string> = {
  mclaren: '#ff8a1f',
  red_bull: '#2a5cff',
  ferrari: RED,
  mercedes: '#2fd6c8',
  aston_martin: '#2f8a3a',
  alpine: '#ff6fcf',
  williams: '#4aa3ff',
  rb: '#6c8cff',
  sauber: '#a9a6b8',
  audi: '#a9a6b8',
  haas: PAPER,
  cadillac: '#ffd166',
};

/** The real drivers' championship on the timing tower: codes and points. */
export function f1Board(b: Board): BoardGraphics {
  const rects: Rect[] = [[12, 36, 48, 62, INK]];
  const texts: Text[] = [[14, 33, 8, PAPER, b.title.slice(0, 8)]];
  b.rows.slice(0, 8).forEach((row, i) => {
    const y = 37 + i * 7;
    rects.push([14, y, 2, 6, TEAM_COLOURS[row.team ?? ''] ?? '#5a5a6a']);
    texts.push(
      [18, y + 6, 8, '#e9e6dc', row.label.slice(0, 3)],
      [51, y + 6, 8, i === 0 ? '#ffd166' : '#a9a6b8', row.value, 'middle'],
    );
  });
  return { rects, texts, replaces: [[14, 33]] };
}

export const f1Scene: SceneData = {
  bg: '#1a1a22',
  back: [
    [0, 0, 320, 180, '#1a1a22'],
    [0, 0, 320, 102, '#22222c', 'dither'],
    [0, 102, 320, 2, '#121218', 'dither'],
    [0, 104, 320, 14, '#121218'],
    ...timingTower(),
    [72, 30, 40, 2, RED], [72, 34, 30, 1, '#3a3a48'],
    [120, 10, 186, 84, RED],
    ...track(DAY_SKY, 60, [...car(150, 63, TEAMS[0]), ...car(214, 72, TEAMS[1])]),
  ],
  front: [
    ...tyres(),
    [48, 118, 224, 62, '#16161e'],
    [48, 154, 224, 26, '#08080c', 'dither'],
    [48, 118, 224, 4, RED],
    [48, 150, 224, 2, '#0e0e14'],
    ...Array.from({ length: 8 }, (_, i): Rect => [128 + i * 8, 132, 4, 4, PAPER]),
    ...Array.from({ length: 8 }, (_, i): Rect => [132 + i * 8, 136, 4, 4, PAPER]),
    // helmet
    [226, 106, 12, 12, PAPER], [230, 108, 8, 4, INK],
    [226, 113, 12, 2, RED], [226, 116, 12, 2, '#c9c6d6'],
  ],
  texts: [[14, 33, 8, PAPER, 'LAP 42']],
  seats: { one: 138, two: [92, 180] },
  prop: 248,
  screen: VIEW,
  board: f1Board,
};

// ---------- Shows ----------

const tower = (label: string): Text[] => [[14, 33, 8, PAPER, label]];

function nightRace(): Rect[] {
  const lights = Array.from({ length: 6 }, (_, i): Rect[] => {
    const x = 134 + i * 32;
    const glow = disc(x, 29, 6, '#fff3b0')
      .map((r): Rect => [r[0], r[1], r[2], r[3], r[4], undefined, 0.15]);
    return [[x, 30, 1, 12, '#5a5a6a'], [x - 2, 28, 5, 2, '#fff6d0'], ...glow];
  }).flat();
  return track(
    [...bands(SKY, ['#04060f', '#0a1030', '#1a1440']), ...stars(SKY, 18, 77)],
    70,
    [...car(160, 63, TEAMS[2]), ...car(230, 72, TEAMS[3])],
    [...skyline(SKY, 42, 9, '#10101c', '#ffd166', 0.3, 22), ...lights],
  ).concat([[122, 60, 182, 22, '#fff3b0', undefined, 0.08]]);
}

export const f1Shows: Partial<Record<ShowId, Show>> = {
  breakfast: {
    tint: LIGHT.morning,
    back: track(
      [...bands(SKY, ['#5a6ab0', '#e08a8a', '#ffc89a']), ...disc(270, 42, 8, '#fff0b0')],
      12,
      car(196, 72, TEAMS[5]).slice(0, 7),
    ),
    texts: tower('FP1'),
  },
  // Daytime: the studio's own view, mid-race.
  evening: {
    tint: LIGHT.dusk,
    back: track(
      [...bands(SKY, ['#2a1a5a', '#a83a5a', '#ffb03b']), ...disc(150, 42, 9, '#ffd8a0')],
      50,
      car(206, 63, TEAMS[1]),
    ),
    texts: tower('QUALI'),
  },
  overnight: { tint: LIGHT.night, back: nightRace(), texts: tower('RACE') },
};
