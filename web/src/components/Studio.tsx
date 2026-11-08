import { useEffect, useRef } from 'preact/hooks';
import { type Board, serverNow } from '../api';
import type { WeatherPlace } from '../rundown';
import type { Shot } from '../scenes/camera';
import type { Look } from '../scenes/presenters';
import {
  drawFrame, HEIGHT, idleTalk, WIDTH,
} from '../scenes/render';

/** A jingle playing at the start of a segment. */
export interface IntroTiming {
  style: 'ident' | 'sting';
  /** Server time (epoch ms) the segment, and so the jingle, starts. */
  startMs: number;
  lengthMs: number;
  name: string;
}

interface Props {
  scene: string | null;
  /** The show the set is dressed for (a shift id, e.g. "breakfast"). */
  show?: string | null;
  /** The presenters on set, in seat order. */
  team: Look[];
  /** Seat of the presenter speaking, from the live line; undefined = idle animation. */
  talking?: number | null;
  /** Live loudness 0..1; when given, mouths follow the audio. */
  level?: () => number;
  /** Camera shot: wide (the default) or a close-up of one seat. */
  shot?: Shot;
  /** Channel colour, for story art and idents. */
  accent?: string;
  /** Story icon for the studio's big screen. */
  art?: string | null;
  /** Forecast for the weather map. */
  weather?: WeatherPlace[] | null;
  /** Real data for the studio board. */
  board?: Board | null;
  intro?: IntroTiming | null;
  /** performance.now() time until which to show TV static. */
  staticUntil?: number;
  label: string;
}

/** A channel's pixel studio, drawn at 320x180 and scaled up with crisp pixels. */
export function Studio({
  scene, show, team, talking, level, shot, accent, art, weather, board, intro,
  staticUntil = 0, label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = {
    scene, show, team, talking, level, shot, accent, art, weather, board, intro, staticUntil,
  };
  const propsRef = useRef(latest);
  // The animation loop reads the latest props without restarting.
  useEffect(() => {
    propsRef.current = latest;
  });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let lastMouth = 0;
    let mouthOpen = false;
    const frame = (time: number) => {
      const p = propsRef.current;
      let state = idleTalk(time, p.team.length);
      if (p.talking !== undefined) {
        // Pixel mouths look best toggling at ~8fps rather than every frame.
        if (time - lastMouth > 120) {
          lastMouth = time;
          mouthOpen = p.level ? p.level() > 0.04 : !mouthOpen;
        }
        state = { talking: p.talking, mouthOpen: p.talking !== null && mouthOpen };
      }
      const i = p.intro;
      const into = i ? serverNow() - i.startMs : -1;
      const introOn = i && into >= 0 && into < i.lengthMs;
      drawFrame(ctx, p.scene, p.team, { time, ...state, static: time < p.staticUntil }, {
        show: p.show,
        shot: p.shot,
        accent: p.accent,
        art: p.art,
        weather: p.weather,
        board: p.board,
        intro: introOn ? {
          style: i.style,
          progress: into / i.lengthMs,
          name: i.name,
          accent: p.accent ?? '#f4f1e6',
        } : null,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={canvasRef} className="studio" width={WIDTH} height={HEIGHT} aria-label={label}>
      {label}
    </canvas>
  );
}
