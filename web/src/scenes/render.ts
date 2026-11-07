import { type Rect, SCENES, type SceneData } from './data';
import {
  facingFor, handRects, type Look, presenterRects, seatsFor,
} from './presenters';

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

function drawRects(ctx: CanvasRenderingContext2D, rects: Rect[], f: FrameState) {
  rects.forEach(([x, y, w, h, colour, anim, alpha]) => {
    if (!visible(anim, f)) return;
    ctx.globalAlpha = alpha ?? 1;
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  });
  ctx.globalAlpha = 1;
}

/** Every rect of a studio with this team at the desk: set, presenters, desk, hands. */
export function sceneLayers(scene: SceneData, team: Look[], f: FrameState): Rect[][] {
  const seated = team.slice(0, 2);
  const xs = seatsFor(scene.seats, seated.length);
  const bodies = seated.flatMap((look, seat) => presenterRects(
    xs[seat],
    look,
    facingFor(seat, seated.length),
    f.talking === seat && f.mouthOpen,
  ));
  const hands = seated.flatMap((look, seat) => handRects(xs[seat], look));
  return [scene.back, bodies, scene.front, hands];
}

function drawScene(ctx: CanvasRenderingContext2D, scene: SceneData, team: Look[], f: FrameState) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  sceneLayers(scene, team, f).forEach((layer) => drawRects(ctx, layer, f));
  scene.texts.forEach(([x, y, size, colour, text, anchor]) => {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.fillStyle = colour;
    ctx.textAlign = anchor === 'middle' ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  });
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
  ctx.fillStyle = blinkOn(f.time, 1200, 0) ? '#f4f1e6' : '#a9a6b8';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLEASE STAND BY', WIDTH / 2, 116);
}

/**
 * Draws one frame of a channel's studio with the given team (in seat order)
 * at the desk. Unknown or missing scenes show the test card.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sceneId: string | null,
  team: Look[],
  f: FrameState,
) {
  ctx.imageSmoothingEnabled = false;
  const scene = sceneId ? SCENES[sceneId] : undefined;
  if (f.static) {
    drawStatic(ctx);
  } else if (scene) {
    drawScene(ctx, scene, team, f);
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
