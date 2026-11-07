// How each studio is dressed for each show (presenter shift): the view on
// its big screen or window, the sky, the lighting and any on-set text. A
// studio with no entry for a show uses its daytime look.
//
// Draw order (render.ts): bg, `under`, the studio's set, `tint` (which dims
// the set but not its lights), `back`, the presenters, the desk.
import type { Rect, Text } from './data';
import {
  bands, type Box, clip, disc, pine, rng, skyline, stars,
} from './draw';

export type ShowId = 'breakfast' | 'daytime' | 'evening' | 'overnight';
export const SHOW_IDS: ShowId[] = ['breakfast', 'daytime', 'evening', 'overnight'];

export interface Show {
  /** Drawn before the set, e.g. a sky the set stands in front of. */
  under?: Rect[];
  /** A wash of colour over the set, [colour, alpha]: warm for breakfast, dark overnight. */
  tint?: [string, number];
  /** The show's own backdrop art, drawn over the set after the tint. */
  back?: Rect[];
  /** Replaces the studio's on-set text. */
  texts?: Text[];
}

const MORNING: [string, number] = ['#ffb36b', 0.1];
const DUSK: [string, number] = ['#5a2a8a', 0.12];
const NIGHT: [string, number] = ['#02040c', 0.42];
const CANVAS: Box = {
  x: 0, y: 0, w: 320, h: 180,
};

const fade = (rects: Rect[], alpha: number): Rect[] => rects.map(
  ([x, y, w, h, c, fx]) => [x, y, w, h, c, fx, alpha],
);

// ---------- World: the big wall screen ----------

const WORLD_SCREEN: Box = {
  x: 18, y: 10, w: 216, h: 88,
};
const WORLD_GRID: Rect[] = [
  [18, 32, 216, 1, '#12305a'], [18, 56, 216, 1, '#12305a'], [18, 80, 216, 1, '#12305a'],
  [72, 10, 1, 88, '#12305a'], [126, 10, 1, 88, '#12305a'], [180, 10, 1, 88, '#12305a'],
];

function globe(cx: number, cy: number, r: number): Rect[] {
  const ocean = disc(cx, cy, r, '#1d4f8c');
  const night = ocean.map(([x, y, w]): Rect => {
    const shade = Math.round(w * 0.38);
    return [x + w - shade, y, shade, 1, '#0a1830', 'dither'];
  });
  const latitudes = ocean.filter(([, y]) => (y - cy) % 12 === 0)
    .map(([x, y, w]): Rect => [x, y, w, 1, '#2a6aa8']);
  const land: Rect[] = [
    [128, 30, 14, 8, '#3fae7a'], [124, 38, 16, 10, '#3fae7a'], [130, 48, 8, 10, '#3fae7a'],
    [134, 58, 6, 8, '#3fae7a'], [152, 28, 20, 8, '#3fae7a'], [150, 36, 12, 6, '#3fae7a'],
    [156, 44, 12, 14, '#3fae7a'], [160, 58, 6, 8, '#3fae7a'], [168, 32, 6, 6, '#3fae7a'],
    [141, 22, 12, 2, '#e9e6dc'],
  ];
  return [...disc(cx, cy, r + 2, '#4aa3ff'), ...ocean, ...latitudes, ...land, ...night];
}

const world: Partial<Record<ShowId, Show>> = {
  breakfast: {
    tint: MORNING,
    back: clip([
      ...bands(WORLD_SCREEN, ['#2b2a5c', '#5a3a72', '#a04a72', '#e0705e', '#ff9a5c', '#ffc27a']),
      ...disc(150, 64, 16, '#ffe39a'),
      ...disc(150, 64, 11, '#fff3c4'),
      ...skyline(WORLD_SCREEN, 88, 7, '#2a1c3a', '#ffd166', 0.15, 30),
      [18, 88, 216, 10, '#3a2a5a'],
      [128, 90, 44, 1, '#ffc27a'], [136, 93, 28, 1, '#ffc27a'], [143, 96, 14, 1, '#ffc27a'],
    ], WORLD_SCREEN),
  },
  evening: {
    tint: DUSK,
    back: clip([
      [18, 10, 216, 88, '#0a1830'],
      ...WORLD_GRID,
      ...stars(WORLD_SCREEN, 24, 3, '#a9c8ff'),
      ...globe(147, 52, 31),
      [188, 24, 1, 2, '#4aa3ff'], [189, 24, 4, 2, '#a9a6b8'], [193, 24, 1, 2, '#4aa3ff'],
      [190, 22, 2, 2, '#ff4d5e', 'blink'],
    ], WORLD_SCREEN),
  },
  overnight: {
    tint: NIGHT,
    back: clip([
      ...bands(WORLD_SCREEN, ['#04060f', '#070c1e', '#0c1430', '#142046']),
      ...stars({
        x: 18, y: 10, w: 216, h: 44,
      }, 30, 11),
      ...disc(206, 26, 9, '#f4f1e6'),
      ...disc(210, 24, 8, '#04060f'),
      ...skyline(WORLD_SCREEN, 98, 23, '#0e1424', '#ffd166', 0.35, 64),
    ], WORLD_SCREEN),
  },
};

// ---------- Tech: the wall monitor ----------

const TECH_SCREEN: Box = {
  x: 173, y: 19, w: 94, h: 64,
};

function candles(): Rect[] {
  const closes = [64, 58, 60, 54, 56, 50, 46, 48, 40, 36, 30];
  return closes.flatMap((close, i): Rect[] => {
    const open = i === 0 ? 68 : closes[i - 1];
    const up = close < open;
    const colour = up ? '#3fe0b0' : '#ff4d5e';
    const top = Math.min(open, close);
    const h = Math.max(2, Math.abs(open - close));
    const x = 178 + i * 8;
    return [[x + 2, top - 3, 1, h + 6, colour], [x + 1, top, 3, h, colour]];
  });
}

function terminal(): Rect[] {
  const r = rng(42);
  const rects: Rect[] = [[173, 19, 94, 64, '#020806']];
  let y = 23;
  let end = 0;
  for (let i = 0; i < 9; i += 1, y += 6) {
    const w = 12 + Math.floor(r() * 60);
    rects.push([177, y, 2, 2, '#3fe0b0'], [181, y, w, 2, i % 3 ? '#146b5a' : '#3fe0b0']);
    end = 181 + w;
  }
  rects.push([end + 2, y - 7, 3, 4, '#3fe0b0', 'blink']);
  return rects;
}

const tech: Partial<Record<ShowId, Show>> = {
  breakfast: {
    tint: MORNING,
    back: [
      [173, 19, 94, 64, '#0e2a24'],
      [218, 22, 2, 6, '#a9a6b8', 'blink'], [224, 20, 2, 7, '#a9a6b8', 'blink2'],
      [230, 23, 2, 5, '#a9a6b8', 'blink'],
      [214, 30, 20, 20, '#f4f1e6'], [216, 30, 16, 3, '#6b3a1e'],
      [220, 38, 8, 8, '#3fe0b0'], [222, 40, 4, 4, '#146b5a'],
      [234, 34, 6, 2, '#f4f1e6'], [238, 34, 2, 10, '#f4f1e6'], [234, 42, 6, 2, '#f4f1e6'],
      [212, 50, 30, 2, '#06110f'],
      [180, 36, 28, 8, '#3fe0b0'], [181, 37, 26, 6, '#06110f'], [182, 38, 16, 4, '#3fe0b0'],
      [198, 38, 4, 4, '#3fe0b0', 'blink'],
    ],
    texts: [[181, 32, 8, '#3fe0b0', 'BOOT']],
  },
  evening: {
    tint: DUSK,
    back: [
      [173, 19, 94, 64, '#06110f'],
      [173, 35, 94, 1, '#0f2a24'], [173, 51, 94, 1, '#0f2a24'], [173, 67, 94, 1, '#0f2a24'],
      [205, 19, 1, 64, '#0f2a24'], [237, 19, 1, 64, '#0f2a24'],
      ...candles(),
    ],
    texts: [[238, 30, 8, '#3fe0b0', '+4.2%']],
  },
  overnight: { tint: NIGHT, back: clip(terminal(), TECH_SCREEN) },
};

// ---------- Science: the observatory window ----------

const SCIENCE_WINDOW: Box = {
  x: 180, y: 14, w: 96, h: 84,
};
const SCIENCE_BARS: Rect[] = [[227, 14, 2, 84, '#b48cff'], [180, 55, 96, 2, '#b48cff']];

function aurora(): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i < 48; i += 1) {
    const x = 180 + i * 2;
    const y = 28 + Math.round(6 * Math.sin(i / 5));
    rects.push([x, y, 2, 14 + Math.round(4 * Math.sin(i / 3)), '#3fe0b0', undefined, 0.45]);
    rects.push([x, y + 12, 2, 8 + Math.round(3 * Math.cos(i / 4)), '#b48cff', undefined, 0.35]);
  }
  return rects;
}

const science: Partial<Record<ShowId, Show>> = {
  breakfast: {
    tint: MORNING,
    back: [
      ...clip([
        ...bands(SCIENCE_WINDOW, ['#3a3a7a', '#7a5a9a', '#d07a8a', '#ffb08a', '#ffd8a0']),
        ...disc(214, 86, 14, '#fff0b0'),
        ...disc(196, 96, 20, '#2f5a44'),
        ...disc(262, 94, 16, '#2f5a44'),
        [180, 88, 96, 10, '#2a4a3a'],
        ...disc(252, 80, 7, '#e9e6dc'),
        [245, 80, 14, 8, '#c9c6d6'], [251, 73, 2, 7, '#2a2440'],
        [200, 30, 2, 1, '#2a2440'], [202, 29, 2, 1, '#2a2440'], [204, 30, 2, 1, '#2a2440'],
        [210, 24, 2, 1, '#2a2440'], [212, 23, 2, 1, '#2a2440'], [214, 24, 2, 1, '#2a2440'],
      ], SCIENCE_WINDOW),
      ...SCIENCE_BARS,
    ],
  },
  evening: {
    tint: DUSK,
    back: [
      ...clip([
        ...bands(SCIENCE_WINDOW, ['#241a5a', '#5a2a6a', '#a83a5a', '#e0603a', '#ffb03b']),
        [180, 90, 96, 8, '#1a1030'],
        [244, 46, 3, 44, '#6b6880'],
        [247, 52, 6, 1, '#6b6880'], [247, 62, 6, 1, '#6b6880'], [247, 72, 6, 1, '#6b6880'],
        [254, 40, 8, 30, '#f4f1e6'], [255, 36, 6, 4, '#f4f1e6'], [256, 33, 4, 3, '#ff4d5e'],
        [251, 62, 3, 8, '#ff4d5e'], [262, 62, 3, 8, '#ff4d5e'],
        [256, 46, 4, 4, '#4aa3ff'], [254, 58, 8, 2, '#a9a6b8'],
        [255, 70, 6, 6, '#ffd166', 'blink'], [256, 76, 4, 5, '#ff6f3c', 'blink2'],
        [255, 70, 6, 4, '#ff4d5e', 'blink2'],
        ...fade(disc(246, 92, 6, '#e9e6dc'), 0.7),
        ...fade(disc(266, 93, 5, '#e9e6dc'), 0.7),
      ], SCIENCE_WINDOW),
      ...SCIENCE_BARS,
    ],
  },
  overnight: {
    tint: NIGHT,
    back: [
      ...clip([
        [180, 14, 96, 84, '#04061a'],
        ...stars(SCIENCE_WINDOW, 26, 5),
        ...aurora(),
        ...disc(200, 108, 24, '#0a0c20'),
        ...disc(252, 104, 20, '#0a0c20'),
        [180, 92, 96, 6, '#0a0c20'],
      ], SCIENCE_WINDOW),
      ...SCIENCE_BARS,
    ],
  },
};

// ---------- Sport: the stadium sky and scoreboard ----------

const SKY: Box = {
  x: 0, y: 0, w: 320, h: 54,
};
const scoreboard = (top: string, score: string): Text[] => [
  [160, 13, 8, '#a9a6b8', top, 'middle'],
  [160, 26, 8, '#ffb03b', score, 'middle', 'display'],
];
const HOME_AWAY = (score: string): Text[] => [
  [127, 13, 8, '#a9a6b8', 'HOME'],
  [175, 13, 8, '#a9a6b8', 'AWAY'],
  [160, 26, 8, '#ffb03b', score, 'middle', 'display'],
];

function floodlights(): Rect[] {
  const glow = [22, 298].flatMap((cx) => [
    ...fade(disc(cx, 6, 18, '#fff3b0'), 0.12),
    ...fade(disc(cx, 6, 11, '#fff3b0'), 0.2),
  ]);
  return clip([
    ...glow,
    [12, 2, 20, 8, '#fff6d0'], [288, 2, 20, 8, '#fff6d0'],
    [10, 10, 24, 3, '#ffe9a0'], [286, 10, 24, 3, '#ffe9a0'],
    [0, 80, 320, 2, '#fff3b0', 'dither', 0.18],
    [0, 82, 320, 22, '#fff3b0', undefined, 0.12],
  ], CANVAS);
}

const sport: Partial<Record<ShowId, Show>> = {
  breakfast: {
    tint: MORNING,
    under: clip([
      ...bands(SKY, ['#7ab8e8', '#a8d4f4', '#ffe4c4', '#ffc890']),
      ...disc(60, 52, 10, '#fff0b0'),
    ], SKY),
    texts: HOME_AWAY('0-0'),
  },
  daytime: {
    under: [
      ...bands(SKY, ['#3a8ae0', '#5aa4f0', '#7abcf8']),
      [40, 14, 20, 4, '#f4f1e6'], [44, 10, 12, 4, '#f4f1e6'],
      [236, 20, 24, 4, '#f4f1e6'], [240, 16, 14, 4, '#f4f1e6'],
      [70, 32, 16, 3, '#f4f1e6'], [258, 6, 12, 3, '#f4f1e6'],
    ],
    texts: HOME_AWAY('1-1'),
  },
  evening: {
    tint: DUSK,
    under: [
      [0, 0, 320, 20, '#2a1a4a'], [0, 20, 320, 14, '#5a2a5a'],
      [0, 34, 320, 12, '#c2502a'], [0, 46, 320, 8, '#ffb03b'],
      [0, 18, 320, 2, '#5a2a5a', 'dither'], [0, 32, 320, 2, '#c2502a', 'dither'],
      [0, 44, 320, 2, '#ffb03b', 'dither'],
    ],
    texts: HOME_AWAY('2-1'),
  },
  overnight: {
    tint: NIGHT,
    under: [
      ...bands(SKY, ['#03050f', '#070b1e', '#0d1430']),
      ...stars(SKY, 30, 9),
    ],
    back: floodlights(),
    texts: scoreboard('FULL TIME', '3-2'),
  },
};

// ---------- Weird News: the window on the strange outdoors ----------

const WEIRD_WINDOW: Box = {
  x: 171, y: 11, w: 130, h: 88,
};
const WEIRD_TEXT: Text = [58, 46, 16, '#ff6fcf', '?!', 'left', 'display'];

function nessie(): Rect[] {
  const water: Box = {
    x: 171, y: 11, w: 130, h: 59,
  };
  return [
    ...bands(WEIRD_WINDOW, ['#c86a9a', '#f09ab0', '#ffc8b0', '#ffe8c0']),
    ...disc(272, 62, 9, '#fff4d0'),
    ...disc(200, 74, 22, '#7a4a7a'),
    ...disc(262, 76, 26, '#6a3a6a'),
    [171, 70, 130, 29, '#3a6aa8'],
    [180, 76, 20, 1, '#7fb0e0'], [228, 82, 30, 1, '#7fb0e0'], [262, 73, 24, 1, '#ffc8b0'],
    [196, 90, 26, 1, '#7fb0e0'], [250, 92, 20, 1, '#7fb0e0'],
    ...clip(disc(228, 72, 5, '#2f8a3a'), water),
    ...clip(disc(240, 72, 5, '#2f8a3a'), water),
    [250, 52, 4, 18, '#2f8a3a'], [251, 54, 1, 14, '#3fae7a'],
    [250, 48, 10, 5, '#2f8a3a'], [256, 49, 1, 1, '#0b0b14'],
    [246, 70, 12, 1, '#7fb0e0'],
  ];
}

function bigfoot(): Rect[] {
  const fur = '#6b3a1e';
  return [
    ...bands(WEIRD_WINDOW, ['#5ab8f0', '#7fd0ff', '#a8e0ff']),
    ...disc(200, 24, 7, '#ffd166'),
    ...disc(190, 96, 30, '#5a9a5a'),
    ...disc(270, 100, 34, '#5a9a5a'),
    [171, 84, 130, 2, '#3a8a3a', 'dither'], [171, 86, 130, 13, '#3a8a3a'],
    ...pine(176, 88, 26, '#1e5a32', '#5a3a1e'),
    ...pine(222, 88, 30, '#1e5a32', '#5a3a1e'),
    ...pine(284, 88, 36, '#1e5a32', '#5a3a1e'),
    ...pine(298, 88, 24, '#1e5a32', '#5a3a1e'),
    [250, 78, 4, 8, '#5a3a1e'], [258, 78, 4, 8, '#5a3a1e'],
    [248, 58, 16, 22, fur], [250, 50, 12, 10, fur],
    [252, 53, 8, 6, '#c68a5e'], [253, 54, 1, 1, '#0b0b14'], [258, 54, 1, 1, '#0b0b14'],
    [244, 60, 4, 14, fur], [264, 50, 4, 12, fur], [264, 47, 4, 3, '#c68a5e'],
    [176, 16, 3, 3, '#ff4d5e', 'blink'],
  ];
}

function hauntedHouse(): Rect[] {
  const ink = '#120814';
  const ghost = (r: Rect): Rect => [r[0], r[1], r[2], r[3], r[4], 'blink2', r[6]];
  return [
    ...bands(WEIRD_WINDOW, ['#2a1048', '#5a2066', '#8a3a6a', '#c0607a']),
    ...disc(236, 40, 16, '#ffe0a0'),
    ...disc(250, 112, 40, '#140818'),
    [171, 88, 130, 11, '#140818'],
    [256, 56, 30, 32, ink],
    [254, 54, 34, 2, ink], [258, 50, 26, 4, ink], [262, 46, 18, 4, ink], [266, 42, 10, 4, ink],
    [280, 36, 8, 22, ink], [279, 34, 10, 2, ink], [281, 30, 6, 4, ink], [283, 26, 2, 4, ink],
    [262, 62, 4, 5, '#ffd166'], [274, 62, 4, 5, '#ffd166', 'blink2'],
    [262, 74, 4, 5, '#ffd166', 'blink'], [283, 42, 2, 4, '#ffd166'],
    [270, 78, 6, 10, '#2a1028'],
    [180, 60, 2, 28, ink], [176, 64, 4, 1, ink], [182, 58, 5, 1, ink], [174, 62, 2, 2, ink],
    ...([
      [228, 62, 12, 14, '#f4f1e6', undefined, 0.85],
      [228, 76, 3, 2, '#f4f1e6', undefined, 0.85], [233, 76, 3, 2, '#f4f1e6', undefined, 0.85],
      [238, 76, 2, 2, '#f4f1e6', undefined, 0.85],
      [231, 66, 2, 3, '#0b0b14'], [236, 66, 2, 3, '#0b0b14'], [233, 71, 3, 3, '#0b0b14'],
    ] as Rect[]).map(ghost),
    [200, 30, 5, 1, ink], [202, 29, 1, 2, ink], [214, 22, 5, 1, ink], [216, 21, 1, 2, ink],
  ];
}

const weird: Partial<Record<ShowId, Show>> = {
  breakfast: { tint: MORNING, back: clip(nessie(), WEIRD_WINDOW) },
  daytime: {
    back: clip(bigfoot(), WEIRD_WINDOW),
    texts: [WEIRD_TEXT, [181, 19, 8, '#f4f1e6', 'REC']],
  },
  evening: { tint: DUSK, back: clip(hauntedHouse(), WEIRD_WINDOW) },
  // Overnight keeps the studio's own view: a UFO at work in the dark.
  overnight: {
    tint: NIGHT,
    back: [...disc(284, 24, 6, '#f4f1e6'), ...disc(287, 22, 6, '#0a0618')],
  },
};

const SHOWS: Record<string, Partial<Record<ShowId, Show>>> = {
  world, tech, science, sport, weird,
};

/** How a studio is dressed for a show; unknown shows get the daytime look. */
export function showFor(sceneId: string, showId: string | null | undefined): Show {
  const shows = SHOWS[sceneId] ?? {};
  return shows[showId as ShowId] ?? shows.daytime ?? {};
}
