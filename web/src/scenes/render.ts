import {
  type Rect, SCENES, type SceneData, type Text,
} from './data';
import {
  facingFor, handRects, type Look, presenterRects, seatsFor,
} from './presenters';
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

/**
 * Every rect of a studio dressed for a show with this team at the desk, in
 * draw order: under the set, set, tint, the set's lights, the show's
 * backdrop, presenters, desk, hands.
 */
export function sceneLayers(
  scene: SceneData,
  team: Look[],
  f: FrameState,
  show: Show = {},
): Rect[][] {
  const seated = team.slice(0, 2);
  const xs = seatsFor(scene.seats, seated.length);
  const bodies = seated.flatMap((look, seat) => presenterRects(
    xs[seat],
    look,
    facingFor(seat, seated.length),
    f.talking === seat && f.mouthOpen,
  ));
  const hands = seated.flatMap((look, seat) => handRects(xs[seat], look));
  const tint: Rect[] = show.tint
    ? [[0, 0, WIDTH, HEIGHT, show.tint[0], undefined, show.tint[1]]]
    : [];
  const lights = show.tint ? scene.back.filter(isLight) : [];
  return [
    show.under ?? [], scene.back, tint, lights, show.back ?? [], bodies, scene.front, hands,
  ];
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  team: Look[],
  f: FrameState,
  show: Show,
) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  sceneLayers(scene, team, f, show).forEach((layer) => drawRects(ctx, layer, f));
  drawTexts(ctx, show.texts ?? scene.texts);
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
  showId?: string | null,
) {
  ctx.imageSmoothingEnabled = false;
  const scene = sceneId ? SCENES[sceneId] : undefined;
  if (f.static) {
    drawStatic(ctx);
  } else if (scene) {
    drawScene(ctx, scene, team, f, showFor(sceneId ?? '', showId));
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
