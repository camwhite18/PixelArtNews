// PXN TEXT: a Ceefax-style teletext service built from the channels' own
// rundowns, studio boards and forecast. Pages are 40 columns by 25 rows:
// row 0 is the header (page number and clock) and row 24 the Fastext keys,
// so a page's content is 23 rows. Long pages split into subpages that the
// viewer cycles through, as on real teletext.
//
// Page numbers:
//   100       index
//   190       now and next on every channel
//   1C0       channel C's stories (C = 1 for the first channel, and so on)
//   1C1-1C9   one story
//   302       football table          360  F1 drivers' standings
//   400       UK weather
import type { Board, Channel } from '../api';
import {
  endMs, type Rundown, type Segment, startMs, type WeatherPlace,
} from '../rundown';

export type Colour = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';

export interface Span {
  text: string;
  fg?: Colour;
  bg?: Colour;
  /** Page this span links to. */
  link?: number;
}

export interface Row {
  spans: Span[];
  /** Double-height text: takes this row and the next. */
  double?: boolean;
}

export interface Page {
  num: number;
  subpages: Row[][];
  /** Fastext keys: red, green, yellow, cyan. */
  fastext: [number, string][];
}

export interface TextData {
  channels: Channel[];
  rundowns: Record<string, Rundown | null>;
  boards: Record<string, Board | null>;
  now: number;
}

export const COLS = 40;
export const CONTENT_ROWS = 23;
const WIDTH = COLS - 2; // a column of margin each side

export const INDEX = 100;
export const NOW_NEXT = 190;
export const FOOTBALL_TABLE = 302;
export const F1_STANDINGS = 360;
export const WEATHER = 400;

const text = (t: string, fg: Colour = 'white', extra: Partial<Span> = {}): Span => ({
  text: t,
  fg,
  ...extra,
});
const row = (...spans: Span[]): Row => ({ spans });
const blank = (): Row => row(text(''));

/** Wraps text into lines of at most `width` characters, breaking between words. */
export function wrap(s: string, width = WIDTH): string[] {
  const lines: string[] = [];
  let line = '';
  s.split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      let w = word;
      while (w.length > width) {
        if (line) lines.push(line);
        lines.push(w.slice(0, width));
        w = w.slice(width);
        line = '';
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line = `${line} ${w}`;
      else {
        lines.push(line);
        line = w;
      }
    });
  if (line) lines.push(line);
  return lines;
}

/** Teletext has no lower-case-only quirks to worry about, but does have a narrow set of glyphs. */
function plain(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
}

/** "Headline ............ 123": a dotted index line that links to a page. */
function indexLine(label: string, num: number, fg: Colour = 'white'): Row {
  const n = String(num);
  const room = WIDTH - n.length - 1;
  const l = plain(label).slice(0, room - 1);
  return row(
    text(`${l} ${'.'.repeat(Math.max(1, room - l.length - 1))}`, fg, { link: num }),
    text(` ${n}`, 'yellow', { link: num }),
  );
}

/** A coloured band across the page with a title, like a teletext section header. */
function band(title: string, bg: Colour, fg: Colour = 'white'): Row {
  return row(text(` ${plain(title).toUpperCase()}`.padEnd(COLS - 2), fg, { bg }));
}

/** Splits rows into subpages of the content height, repeating a page's top rows on each. */
function paginate(top: Row[], body: Row[]): Row[][] {
  const per = CONTENT_ROWS - top.length - 1;
  if (body.length <= per) return [[...top, ...body]];
  const pages: Row[][] = [];
  for (let i = 0; i < body.length; i += per) pages.push([...top, ...body.slice(i, i + per)]);
  return pages;
}

// Big block letters for the index banner, 3 cells wide and 5 tall.
const BLOCK: Record<string, string[]> = {
  P: ['###', '#.#', '###', '#..', '#..'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  ' ': ['...', '...', '...', '...', '...'],
};

function banner(word: string, colours: Colour[]): Row[] {
  return [0, 1, 2, 3, 4].map((r) => row(
    text(' '),
    ...[...word].flatMap((ch, i) => [
      ...[...BLOCK[ch][r]].map((c): Span => {
        const bg = colours[i % colours.length];
        return c === '#' ? text(' ', 'white', { bg }) : text(' ');
      }),
      text(' '),
    ]),
  ));
}

const channelPage = (index: number) => 100 + (index + 1) * 10;

/** A Fastext label: the first word, at most nine characters. */
const short = (name: string) => name.split(' ')[0].slice(0, 9);

/** A channel's stories still to air or airing: unique headlines in schedule order. */
export function storiesOf(r: Rundown | null, now: number): Segment[] {
  if (!r) return [];
  const seen = new Set<string>();
  return r.segments
    .filter((s) => endMs(s) > now && s.type === 'story' && s.headline)
    .filter((s) => {
      const key = (s.headline ?? '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 9);
}

const onAir = (r: Rundown | null, now: number) => (
  r?.segments.find((s) => startMs(s) <= now && endMs(s) > now) ?? null
);

const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

function indexPage(d: TextData): Page {
  const rows: Row[] = [
    ...banner('PXN TEXT', ['blue', 'red', 'green', 'blue', 'blue', 'yellow', 'magenta', 'cyan']),
    blank(),
    band('Channels', 'blue'),
    ...d.channels.map((c, i) => indexLine(c.name, channelPage(i), 'cyan')),
    blank(),
    indexLine('Now and next', NOW_NEXT),
    indexLine('Football table', FOOTBALL_TABLE),
    indexLine('F1 standings', F1_STANDINGS),
    indexLine('UK weather', WEATHER),
  ];
  return {
    num: INDEX,
    subpages: [rows.slice(0, CONTENT_ROWS)],
    fastext: [
      [NOW_NEXT, 'Now'],
      [channelPage(0), short(d.channels[0]?.name ?? 'News')],
      [FOOTBALL_TABLE, 'Sport'],
      [WEATHER, 'Weather'],
    ],
  };
}

function nowNextPage(d: TextData): Page {
  const body: Row[] = d.channels.flatMap((c, i) => {
    const r = d.rundowns[c.id] ?? null;
    const now = onAir(r, d.now);
    const next = r?.segments.find((s) => startMs(s) > d.now) ?? null;
    return [
      row(
        text(c.name, 'cyan', { link: channelPage(i) }),
        text(` ${channelPage(i)}`, 'yellow', { link: channelPage(i) }),
      ),
      row(text('NOW ', 'green'), text(plain(now?.headline ?? 'Off air').slice(0, WIDTH - 4))),
      row(
        text(next ? `${clock(startMs(next))} ` : '', 'green'),
        text(plain(next?.headline ?? '').slice(0, WIDTH - 6), 'white'),
      ),
    ];
  });
  return {
    num: NOW_NEXT,
    subpages: paginate([band('Now and next', 'red'), blank()], body),
    fastext: [
      [INDEX, 'Index'],
      [channelPage(0), short(d.channels[0]?.name ?? 'News')],
      [FOOTBALL_TABLE, 'Sport'],
      [WEATHER, 'Weather'],
    ],
  };
}

function channelIndexPage(d: TextData, i: number): Page {
  const c = d.channels[i];
  const r = d.rundowns[c.id] ?? null;
  const stories = storiesOf(r, d.now);
  const now = onAir(r, d.now);
  const base = channelPage(i);
  const rows: Row[] = [
    row(text(` PXN ${c.name}`, 'yellow'), text('  stories', 'white')),
    { spans: [text(` ${c.name}`, 'cyan')], double: true },
    blank(),
    band('On air now', 'blue'),
    ...wrap(plain(now?.headline ?? 'Off air: the first broadcast is being prepared.'))
      .slice(0, 2)
      .map((l) => row(text(l))),
    blank(),
    band('Stories', 'magenta'),
    ...(stories.length
      ? stories.map((s, n) => indexLine(s.headline ?? '', base + n + 1))
      : [row(text('No stories yet.', 'white'))]),
  ];
  const next = channelPage((i + 1) % d.channels.length);
  return {
    num: base,
    subpages: [rows.slice(0, CONTENT_ROWS)],
    fastext: [
      [INDEX, 'Index'],
      [base + 1, 'Top story'],
      [next, short(d.channels[(i + 1) % d.channels.length].name)],
      [WEATHER, 'Weather'],
    ],
  };
}

function storyPage(d: TextData, i: number, n: number): Page | null {
  const c = d.channels[i];
  const s = storiesOf(d.rundowns[c.id] ?? null, d.now)[n - 1];
  if (!s) return null;
  const base = channelPage(i);
  const top: Row[] = [
    row(text(` PXN ${c.name}`, 'yellow'), text(`  story ${n}`, 'white')),
    ...wrap(plain(s.headline ?? ''), WIDTH)
      .slice(0, 2)
      .map((l) => row(text(l, 'cyan'))),
    blank(),
  ];
  const body: Row[] = [];
  s.lines.forEach((l) => {
    wrap(plain(l.text)).forEach((w) => body.push(row(text(w))));
  });
  body.push(blank());
  const outlets = [...new Set(s.sources.map((src) => src.outlet))].join(', ');
  if (outlets) wrap(`Sources: ${plain(outlets)}`).forEach((w) => body.push(row(text(w, 'green'))));
  wrap('AI-written from the sources listed.').forEach((w) => body.push(row(text(w, 'magenta'))));
  const total = storiesOf(d.rundowns[c.id] ?? null, d.now).length;
  return {
    num: base + n,
    subpages: paginate(top, body),
    fastext: [
      [INDEX, 'Index'],
      [base, 'Stories'],
      [n < total ? base + n + 1 : base, n < total ? 'Next' : 'Back'],
      [WEATHER, 'Weather'],
    ],
  };
}

function tablePage(
  num: number,
  title: string,
  b: Board | null,
  bg: Colour,
  unavailable: string,
): Page {
  const body: Row[] = b?.rows.length
    ? [
      row(text(' Pos  Name'.padEnd(WIDTH - 4), 'yellow'), text(' Pts', 'yellow')),
      ...b.rows.map((r, i) => row(
        text(
          `${String(i + 1).padStart(4)}  ${plain(r.label)}`.padEnd(WIDTH - 4),
          i === 0 ? 'cyan' : 'white',
        ),
        text(r.value.padStart(4), i === 0 ? 'cyan' : 'white'),
      )),
      blank(),
      ...wrap(plain(b.credit)).map((w) => row(text(w, 'green'))),
    ]
    : wrap(unavailable).map((w) => row(text(w)));
  return {
    num,
    subpages: paginate([band(title, bg), blank()], body),
    fastext: [
      [INDEX, 'Index'],
      [FOOTBALL_TABLE, 'Football'],
      [F1_STANDINGS, 'F1'],
      [WEATHER, 'Weather'],
    ],
  };
}

const WEATHER_WORDS: [(c: number) => boolean, string][] = [
  [(c) => c === 0, 'Sunny'],
  [(c) => c <= 2, 'Sunny spells'],
  [(c) => c === 3, 'Cloudy'],
  [(c) => c === 45 || c === 48, 'Fog'],
  [(c) => (c >= 71 && c <= 77) || c === 85 || c === 86, 'Snow'],
  [(c) => c >= 95, 'Thunder'],
  [(c) => c >= 80, 'Showers'],
  [(c) => c >= 51, 'Rain'],
];
const weatherWord = (code: number) => WEATHER_WORDS.find(([test]) => test(code))?.[1] ?? 'Mixed';
const tempColour = (c: number): Colour => {
  if (c <= 4) return 'cyan';
  if (c <= 12) return 'green';
  if (c <= 20) return 'yellow';
  return 'red';
};

const PLACE_NAMES: Record<string, string> = {
  edinburgh: 'Edinburgh',
  newcastle: 'Newcastle',
  belfast: 'Belfast',
  manchester: 'Manchester',
  birmingham: 'Birmingham',
  cardiff: 'Cardiff',
  london: 'London',
  plymouth: 'Plymouth',
};

/** The most recent forecast any channel has aired. */
export function latestForecast(d: TextData): WeatherPlace[] | null {
  const forecasts = Object.values(d.rundowns)
    .flatMap((r) => r?.segments ?? [])
    .filter((s) => s.type === 'weather' && s.weather?.length)
    .sort((a, b) => startMs(b) - startMs(a));
  return forecasts[0]?.weather ?? null;
}

function weatherPage(d: TextData): Page {
  const wx = latestForecast(d);
  const body: Row[] = wx
    ? [
      row(
        text(' Place'.padEnd(16), 'yellow'),
        text('Weather'.padEnd(14), 'yellow'),
        text('Hi Lo', 'yellow'),
      ),
      ...wx.map((p) => row(
        text(` ${PLACE_NAMES[p.place] ?? p.place}`.padEnd(16), 'white'),
        text(weatherWord(p.code).padEnd(14), 'cyan'),
        text(String(Math.round(p.maxC)).padStart(2), tempColour(p.maxC)),
        text(String(Math.round(p.minC)).padStart(3), tempColour(p.minC)),
      )),
      blank(),
      row(text('Temperatures in degrees Celsius.', 'white')),
      row(text('Weather data by Open-Meteo.com', 'green')),
    ]
    : wrap('No forecast yet. The weather is updated with the breakfast news each morning.').map(
      (w) => row(text(w)),
    );
  return {
    num: WEATHER,
    subpages: paginate([band('UK weather', 'blue'), blank()], body),
    fastext: [
      [INDEX, 'Index'],
      [NOW_NEXT, 'Now'],
      [FOOTBALL_TABLE, 'Sport'],
      [channelPage(0), short(d.channels[0]?.name ?? 'News')],
    ],
  };
}

/** Builds a page, or null if there is no such page. */
export function buildPage(num: number, d: TextData): Page | null {
  if (num === INDEX) return indexPage(d);
  if (num === NOW_NEXT) return nowNextPage(d);
  if (num === FOOTBALL_TABLE) {
    return tablePage(
      num,
      'Football: league table',
      d.boards.football ?? null,
      'green',
      'The table is not available at the moment.',
    );
  }
  if (num === F1_STANDINGS) {
    return tablePage(
      num,
      'F1: drivers',
      d.boards.f1 ?? null,
      'red',
      'The standings are not available at the moment.',
    );
  }
  if (num === WEATHER) return weatherPage(d);
  const i = Math.floor((num - 100) / 10) - 1;
  if (num > 100 && num < 200 && i >= 0 && i < d.channels.length) {
    const n = num % 10;
    return n === 0 ? channelIndexPage(d, i) : storyPage(d, i, n);
  }
  return null;
}

/** Every page number that exists right now, in order, for page up and down. */
export function pageNumbers(d: TextData): number[] {
  const nums = [INDEX];
  d.channels.forEach((c, i) => {
    nums.push(channelPage(i));
    storiesOf(d.rundowns[c.id] ?? null, d.now).forEach((_, n) => nums.push(channelPage(i) + n + 1));
  });
  nums.push(NOW_NEXT, FOOTBALL_TABLE, F1_STANDINGS, WEATHER);
  return nums.sort((a, b) => a - b);
}

/** The text page for a channel. */
export const pageForChannel = (channels: Channel[], id: string) => {
  const i = channels.findIndex((c) => c.id === id);
  return i < 0 ? INDEX : channelPage(i);
};
