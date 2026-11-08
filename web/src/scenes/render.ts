import type { Board } from '../api';
import type { WeatherPlace } from '../rundown';
import { artRects } from './art';
import {
  type Rect, SCENES, type SceneData, type Text,
} from './data';
import { type Intro, introGraphics } from './ident';
import { weatherMap } from './weathermap';
import {
  facingFor, handRects, type Look, presenterRects, seatsFor,
} from './presenters';
import {
  closeUpOrigin, type Shot, WIDE, ZOOM,
} from './camera';
import { clocksAt } from './clocks';
import { poppy, type Season, seasonAt } from './seasons';
import { type Show, showFor } from './shows';

export const WIDTH = 320;
export const HEIGHT = 180;

export interface FrameState {
  /** Milliseconds, drives blinking lights. */
  time: number;
  /** Seat of the presenter currently speaking, or null for nobody. */
  talking: number | null;
  /** Whether that presenter's mouth is open on this frame. */
  mouthOpen: boolean;
  /** While set, draw TV static instead of the studio (channel switching). */
  static?: boolean;
}

const blinkOn = (time: number, period: number, offset: number) => (
  (time + offset) % period < period * 0.6
);

/** Whether a rect with this animation tag is drawn on this frame. */
function visible(anim: string | undefined, f: FrameState): boolean {
  switch (anim) {
    case 'blink':
      return blinkOn(f.time, 1200, 0);
    case 'blink2':
      return blinkOn(f.time, 1700, 500);
    default:
      return true;
  }
}

const ditherCache = new Map<string, CanvasPattern | null>();

/** A checkerboard of one colour, anchored to the canvas so seams line up. */
function dither(ctx: CanvasRenderingContext2D, colour: string): CanvasPattern | string {
  if (!ditherCache.has(colour)) {
    const tile = document.createElement('canvas');
    tile.width = 2;
    tile.height = 2;
    const t = tile.getContext('2d');
    if (t) {
      t.fillStyle = colour;
      t.fillRect(0, 0, 1, 1);
      t.fillRect(1, 1, 1, 1);
    }
    ditherCache.set(colour, t ? ctx.createPattern(tile, 'repeat') : null);
  }
  return ditherCache.get(colour) ?? colour;
}

function drawRects(ctx: CanvasRenderingContext2D, rects: Rect[], f: FrameState) {
  rects.forEach(([x, y, w, h, colour, fx, alpha]) => {
    if (!visible(fx, f)) return;
    ctx.globalAlpha = alpha ?? 1;
    ctx.fillStyle = fx === 'dither' ? dither(ctx, colour) : colour;
    ctx.fillRect(x, y, w, h);
  });
  ctx.globalAlpha = 1;
}

const FONTS = { label: 'Tiny5', display: '"Press Start 2P"' } as const;
let fontsReady = false;
let fontsRequested = false;
const textCache = new Map<string, HTMLCanvasElement>();

/** Starts loading the bitmap fonts; text is drawn once they have arrived. */
function requestFonts() {
  if (fontsRequested || typeof document === 'undefined' || !document.fonts) return;
  fontsRequested = true;
  Promise.all([
    document.fonts.load(`8px ${FONTS.label}`),
    document.fonts.load(`8px ${FONTS.display}`),
  ]).catch(() => undefined).then(() => {
    fontsReady = true;
    textCache.clear();
  });
}

/**
 * Renders text once into a small canvas with every pixel either fully on or
 * off, so it sits on the studio's pixel grid instead of being anti-aliased.
 */
function bitmapText([, , size, colour, text, , font]: Text): HTMLCanvasElement {
  const key = `${size}|${colour}|${font ?? 'label'}|${text}`;
  const cached = textCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  const t = c.getContext('2d');
  if (!t) return c;
  const css = `${size}px ${FONTS[font ?? 'label']}`;
  t.font = css;
  c.width = Math.max(1, Math.ceil(t.measureText(text).width) + 2);
  c.height = size * 2;
  t.font = css;
  t.fillStyle = colour;
  t.textBaseline = 'alphabetic';
  t.fillText(text, 0, size * 1.5);
  const img = t.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 110 ? 255 : 0;
  t.putImageData(img, 0, 0);
  textCache.set(key, c);
  return c;
}

function drawTexts(ctx: CanvasRenderingContext2D, texts: Text[]) {
  requestFonts();
  if (!fontsReady) return;
  texts.forEach((text) => {
    const [x, y, size, , , anchor] = text;
    const img = bitmapText(text);
    const left = anchor === 'middle' ? Math.round(x - (img.width - 2) / 2) : x;
    ctx.drawImage(img, left, y - size * 1.5);
  });
}

const isLight = ([, , , , , fx]: Rect) => fx === 'blink' || fx === 'blink2';

export interface Extras {
  season?: Season | null;
  /** Wall-clock time, for the studio clocks. */
  date?: Date;
  /** Channel colour, for story art. */
  accent?: string;
  /** Story icon to show on the studio screen. */
  art?: string | null;
  /** Forecast to map on the studio screen (takes the place of story art). */
  weather?: WeatherPlace[] | null;
  /** Real data for the studio board. */
  board?: Board | null;
}

/** What the studio screen shows instead of the show's own backdrop, if anything. */
function screenGraphics(scene: SceneData, { art, weather, accent }: Extras) {
  if (!scene.screen) return { rects: [], texts: [] };
  if (weather?.length) return weatherMap(scene.screen, weather);
  if (art) return { rects: artRects(art, scene.screen, accent ?? '#f4f1e6'), texts: [] };
  return { rects: [], texts: [] };
}

/**
 * Every rect of a studio dressed for a show with this team at the desk, in
 * draw order: under the set, set (with clock hands and board data), tint,
 * the set's lights, the show's backdrop, seasonal dressing, the screen
 * (story art or weather), presenters, desk (with any seasonal prop), hands.
 */
export function sceneLayers(
  scene: SceneData,
  team: Look[],
  f: FrameState,
  show: Show = {},
  extras: Extras = {},
): Rect[][] {
  const { season, date, board } = extras;
  const seated = team.slice(0, 2);
  const xs = seatsFor(scene.seats, seated.length);
  const bodies = seated.flatMap((look, seat) => presenterRects(
    xs[seat],
    look,
    facingFor(seat, seated.length),
    f.talking === seat && f.mouthOpen,
  ));
  if (season?.poppy) {
    seated.forEach((look, seat) => {
      if (!look.alien) bodies.push(...poppy(xs[seat]));
    });
  }
  const hands = seated.flatMap((look, seat) => handRects(xs[seat], look));
  const tint: Rect[] = show.tint
    ? [[0, 0, WIDTH, HEIGHT, show.tint[0], undefined, show.tint[1]]]
    : [];
  const lights = show.tint ? scene.back.filter(isLight) : [];
  const back = [
    ...scene.back,
    ...(scene.clocks && date ? clocksAt(scene.clocks, date) : []),
    ...(scene.board && board ? scene.board(board).rects : []),
  ];
  const front = season?.prop ? [...scene.front, ...season.prop(scene.prop)] : scene.front;
  return [
    show.under ?? [], back, tint, lights, show.back ?? [], season?.back ?? [],
    screenGraphics(scene, extras).rects, bodies, front, hands,
  ];
}

/**
 * The on-set text: the show's (or studio's), with board data and the
 * screen's. Text on the screen is hidden while story art or the weather
 * covers it.
 */
export function sceneTexts(scene: SceneData, show: Show, extras: Extras = {}): Text[] {
  const boardGfx = scene.board && extras.board ? scene.board(extras.board) : null;
  const replaced = new Set((boardGfx?.replaces ?? []).map(([x, y]) => `${x},${y}`));
  const screen = screenGraphics(scene, extras);
  const s = scene.screen;
  const covered = ([x, y]: Text) => screen.rects.length > 0 && !!s
    && x >= s.x && x < s.x + s.w && y >= s.y && y <= s.y + s.h;
  return [
    ...(show.texts ?? scene.texts).filter((t) => !replaced.has(`${t[0]},${t[1]}`) && !covered(t)),
    ...(boardGfx?.texts ?? []),
    ...screen.texts,
  ];
}

let seasonDay = '';
let season: Season | null = null;

/** Today's season, worked out once a day rather than every frame. */
function todaysSeason(date: Date): Season | null {
  const day = date.toDateString();
  if (day !== seasonDay) {
    seasonDay = day;
    season = seasonAt(date);
  }
  return season;
}

export interface FrameOptions extends Omit<Extras, 'season' | 'date'> {
  /** The show the set is dressed for (a shift id). */
  show?: string | null;
  shot?: Shot;
  /** A channel ident or sting playing over the studio. */
  intro?: Intro | null;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  team: Look[],
  f: FrameState,
  show: Show,
  { shot = WIDE, intro, ...extras }: FrameOptions,
) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const seats = seatsFor(scene.seats, Math.min(team.length, 2));
  const head = shot.kind === 'close' ? seats[shot.seat] : undefined;
  if (head !== undefined) {
    const [ox, oy] = closeUpOrigin(head);
    ctx.setTransform(ZOOM, 0, 0, ZOOM, -ox * ZOOM, -oy * ZOOM);
  }
  const date = new Date();
  const all: Extras = { ...extras, season: todaysSeason(date), date };
  sceneLayers(scene, team, f, show, all).forEach((layer) => drawRects(ctx, layer, f));
  drawTexts(ctx, sceneTexts(scene, show, all));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (intro) {
    const g = introGraphics(intro);
    drawRects(ctx, g.rects, f);
    drawTexts(ctx, g.texts);
  }
}

function drawStatic(ctx: CanvasRenderingContext2D) {
  const img = ctx.createImageData(WIDTH, HEIGHT);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const BARS = ['#f4f1e6', '#ffd166', '#3fe0b0', '#3fae7a', '#ff6fcf', '#ff4d5e', '#4aa3ff'];

/** SMPTE-style colour bars, shown when a channel has nothing scheduled. */
function drawTestCard(ctx: CanvasRenderingContext2D, f: FrameState) {
  const w = WIDTH / BARS.length;
  BARS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(i * w), 0, Math.ceil(w), 96);
  });
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 96, WIDTH, 84);
  // Kept above y=128, where the broadcast's lower-third begins.
  const colour = blinkOn(f.time, 1200, 0) ? '#f4f1e6' : '#a9a6b8';
  drawTexts(ctx, [[WIDTH / 2, 116, 8, colour, 'PLEASE STAND BY', 'middle', 'display']]);
}

/**
 * Draws one frame of a channel's studio, dressed for a show, with the given
 * team (in seat order) at the desk. Unknown or missing scenes show the test
 * card.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sceneId: string | null,
  team: Look[],
  f: FrameState,
  opts: FrameOptions = {},
) {
  ctx.imageSmoothingEnabled = false;
  const scene = sceneId ? SCENES[sceneId] : undefined;
  if (f.static) {
    drawStatic(ctx);
  } else if (scene) {
    drawScene(ctx, scene, team, f, showFor(sceneId ?? '', opts.show), opts);
  } else {
    drawTestCard(ctx, f);
  }
}

/** Time-based talking for previews, where there is no audio to follow. */
export function idleTalk(
  time: number,
  presenters: number,
): Pick<FrameState, 'talking' | 'mouthOpen'> {
  if (presenters === 0) return { talking: null, mouthOpen: false };
  const talking = presenters > 1 ? Math.floor(time / 2000) % 2 : 0;
  return { talking, mouthOpen: Math.floor(time / 180) % 2 === 0 };
}
