// Story art: 12x12 pixel icons the script picks per story (the schema's
// `art` list), shown large on a studio's big screen while the story airs.
import type { Rect } from './data';
import type { Box } from './draw';

const PALETTE: Record<string, string> = {
  k: '#0b0b14',
  w: '#f4f1e6',
  s: '#a9a6b8',
  S: '#5a5a6a',
  b: '#4aa3ff',
  d: '#1d4f8c',
  g: '#3fae7a',
  G: '#1e5a32',
  t: '#3fe0b0',
  r: '#ff4d5e',
  o: '#ff8a1f',
  y: '#ffd166',
  p: '#b48cff',
  n: '#8d5a3b',
};

/** Each icon: 12 rows of 12 palette letters; "." is transparent. */
export const ICONS: Record<string, string[]> = {
  globe: [
    '....bbbb....', '..bbggbbbb..', '.bgggbbbggb.', '.bggbbbbggb.',
    'bbgbbbbbbgbb', 'bbbbbggbbbbb', 'bbbbgggbbbbb', 'bgbbbggbbbbb',
    '.bgbbbgbbbb.', '.bbbbbbbbbb.', '..bbbbbbbb..', '....bbbb....',
  ],
  ballot: [
    '....wwww....', '....wkkw....', '....wwww....', '.bbbwwwwbbb.',
    '.bkkkkkkkkb.', '.bbbbbbbbbb.', '.bbbbbbbbbb.', '.bbbwwwwbbb.',
    '.bbbwkkwbbb.', '.bbbwwwwbbb.', '.bbbbbbbbbb.', '............',
  ],
  gavel: [
    '.nnnnnnn....', '.nnnnnnn....', '.nnnnnnn....', '....nn......',
    '....nnn.....', '.....nnn....', '......nnn...', '.......nnn..',
    '........nn..', '............', '.ssssssss...', 'ssssssssss..',
  ],
  money: [
    '...yyyyyy...', '..yyyyyyyy..', '.yyyyykkyyy.', '.yyyykyyyyy.',
    'yyyyykyyyyyy', 'yyykkkkkyyyy', 'yyyyykyyyyyy', 'yyyyykyyyyyy',
    '.yyykkkkkyy.', '.yyyyyyyyyy.', '..yyyyyyyy..', '...yyyyyy...',
  ],
  chart: [
    '............', '.........gg.', '.........gg.', '......gg.gg.',
    '......gg.gg.', '...gg.gg.gg.', '...gg.gg.gg.', 'gg.gg.gg.gg.',
    'gg.gg.gg.gg.', 'gg.gg.gg.gg.', 'kkkkkkkkkkkk', '............',
  ],
  rocket: [
    '.....ww.....', '....wwww....', '....wbbw....', '....wbbw....',
    '....wwww....', '...rwwwwr...', '..rrwwwwrr..', '..r.wwww.r..',
    '....oyyo....', '.....yy.....', '....o..o....', '.....oo.....',
  ],
  planet: [
    '....oooo....', '..oooooooo..', '.oooyoooooo.', '.oooooooooo.',
    'pppppppppppp', 'oooooooooooo', '.pppppppppp.', '.oooooooooo.',
    '..oooooooo..', '....oooo....', '............', '............',
  ],
  flask: [
    '....wwww....', '.....ss.....', '.....ss.....', '.....ss.....',
    '....s..s....', '...s....s...', '..s.tttt.s..', '.s.tttttt.s.',
    's.tttttttt.s', 's.tttttttt.s', '.ssssssssss.', '............',
  ],
  chip: [
    '............', '.s.s.s.s.s..', '.SSSSSSSSS..', 'sSkkkkkkkSs.',
    '.SkttttkkS..', 'sSkttttkkSs.', '.SkkkkkkkS..', 'sSkkkkkkkSs.',
    '.SSSSSSSSS..', '.s.s.s.s.s..', '............', '............',
  ],
  phone: [
    '...SSSSSS...', '...SkkkkS...', '...SbbbbS...', '...SbbbbS...',
    '...SbbbbS...', '...SbbbbS...', '...SbbbbS...', '...SbbbbS...',
    '...SkkkkS...', '...SkwwkS...', '...SkkkkS...', '...SSSSSS...',
  ],
  robot: [
    '.....rr.....', '......s.....', '..ssssssss..', '..sttsstts..',
    '..sttsstts..', '..ssssssss..', '..sskkkkss..', '..ssssssss..',
    '...ssssss...', '.ssssssssss.', '.s.ssssss.s.', '...ss..ss...',
  ],
  gamepad: [
    '............', '............', '..SSSSSSSS..', '.SSSSSSSSSS.',
    'SSkSSSSSrSSS', 'SkkkSSSrSrSS', 'SSkSSSSSrSSS', 'SSSSSSSSSSSS',
    'SSS......SSS', '.S........S.', '............', '............',
  ],
  heart: [
    '............', '.rrr...rrr..', 'rrrrr.rrrrr.', 'rrwrrrrrrrr.',
    'rrrrrrrrrrr.', 'rrrrrrrrrrr.', '.rrrrrrrrr..', '..rrrrrrr...',
    '...rrrrr....', '....rrr.....', '.....r......', '............',
  ],
  leaf: [
    '........ggg.', '......gggggg', '....gggggGgg', '...ggggGgggg',
    '..gggGgggggg', '..ggGgggggg.', '.ggGgggggg..', '.gGggggg....',
    '.Gggggg.....', 'G...........', '............', '............',
  ],
  storm: [
    '...ssss.....', '..ssssss.ss.', '.sssssssssss', 'ssssssssssss',
    '.ssssssssss.', '.....yy.....', '....yy......', '...yyyyy....',
    '.....yy.....', '....yy......', '...yy.......', '............',
  ],
  fire: [
    '.....r......', '....rr...r..', '....rrr..rr.', '...rrrrrrrr.',
    '..rrrorrrrr.', '..rroooorrr.', '.rrooyyoorr.', '.rroyyyyorr.',
    '.rroyyyyorr.', '..rooyyoor..', '...rooooor..', '....rrrrr...',
  ],
  trophy: [
    '..yyyyyyyy..', 'yyyyyyyyyyyy', 'y.yyyyyyyy.y', 'y.yyyyyyyy.y',
    '.yyyyyyyyyy.', '...yyyyyy...', '....yyyy....', '.....yy.....',
    '.....yy.....', '...yyyyyy...', '...nnnnnn...', '..nnnnnnnn..',
  ],
  ball: [
    '....wwww....', '..wwkkwwww..', '.wwkkkkwwww.', '.wwwkkwwwkw.',
    'wwwwwwwwkkkw', 'wkwwwwwwwkww', 'wkkwwkkwwwww', 'wkwwkkkkwwww',
    '.wwwwkkwwwk.', '.wkwwwwwwkk.', '..wwwwwwww..', '....wwww....',
  ],
  car: [
    '............', '............', '....rrrr....', '...rwwwwr...',
    '..rrwwwwrrr.', '.rrrrrrrrrrr', 'rrrrrrrrrrrr', 'rrkkrrrrkkrr',
    '..kk....kk..', '............', '............', '............',
  ],
  flag: [
    'skkwwkkwwkk.', 'skkwwkkwwkk.', 'swwkkwwkkww.', 'swwkkwwkkww.',
    'skkwwkkwwkk.', 'skkwwkkwwkk.', 's...........', 's...........',
    's...........', 's...........', 's...........', 's...........',
  ],
  ufo: [
    '............', '....tttt....', '...tttttt...', '..ssssssss..',
    '.sryssssyrs.', 'ssssssssssss', '.ssssssssss.', '...y.y.y....',
    '..yyyyyyy...', '.yyyyyyyyy..', 'yyyyyyyyyyy.', '............',
  ],
  ghost: [
    '....wwww....', '..wwwwwwww..', '.wwwwwwwwww.', '.wwkkwwkkww.',
    '.wwkkwwkkww.', '.wwwwwwwwww.', '.wwwwkkwwww.', '.wwwwkkwwww.',
    '.wwwwwwwwww.', '.wwwwwwwwww.', '.ww.ww.ww.w.', '.w...w...w..',
  ],
  film: [
    '.kwkwkwkwkw.', 'kwkwkwkwkwk.', '............', 'kkkkkkkkkkkk',
    'kwkwkwkwkwkk', 'kkkkkkkkkkkk', 'kssssssssssk', 'kssssssssssk',
    'kssssssssssk', 'kssssssssssk', 'kssssssssssk', 'kkkkkkkkkkkk',
  ],
  music: [
    '....pppppppp', '....pppppppp', '....p......p', '....p......p',
    '....p......p', '....p......p', '....p......p', '..ppp....ppp',
    '.pppp...pppp', '.pppp...pppp', '..pp.....pp.', '............',
  ],
};

/** An icon as rects at a scale, its top-left at (x, y). */
export function iconRects(name: string, x: number, y: number, scale: number): Rect[] {
  const rows = ICONS[name] ?? [];
  const rects: Rect[] = [];
  rows.forEach((row, ry) => {
    let rx = 0;
    while (rx < row.length) {
      const c = row[rx];
      let run = 1;
      while (rx + run < row.length && row[rx + run] === c) run += 1;
      if (c !== '.') rects.push([x + rx * scale, y + ry * scale, run * scale, scale, PALETTE[c]]);
      rx += run;
    }
  });
  return rects;
}

/**
 * The story card on a studio screen: a dark panel with the channel's colour
 * in a dithered glow, and the icon as large as fits.
 */
export function artRects(name: string, screen: Box, accent: string): Rect[] {
  if (!ICONS[name]) return [];
  const scale = Math.max(1, Math.floor((Math.min(screen.w, screen.h) * 0.62) / 12));
  const size = 12 * scale;
  const x = Math.round(screen.x + (screen.w - size) / 2);
  const y = Math.round(screen.y + (screen.h - size) / 2);
  const pad = Math.max(2, scale * 2);
  return [
    [screen.x, screen.y, screen.w, screen.h, '#0b0b14'],
    [screen.x, screen.y, screen.w, screen.h, accent, 'dither', 0.18],
    [x - pad, y - pad, size + pad * 2, size + pad * 2, '#0b0b14'],
    [x - pad, y - pad, size + pad * 2, size + pad * 2, accent, 'dither', 0.35],
    ...iconRects(name, x, y, scale),
  ];
}
