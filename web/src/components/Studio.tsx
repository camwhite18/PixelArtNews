import { useEffect, useRef } from 'preact/hooks';
import type { Look } from '../scenes/presenters';
import {
  drawFrame, HEIGHT, idleTalk, WIDTH,
} from '../scenes/render';

interface Props {
  scene: string | null;
  /** The presenters on set, in seat order. */
  team: Look[];
  /** Seat of the presenter speaking, from the live line; undefined = idle animation. */
  talking?: number | null;
  /** Live loudness 0..1; when given, mouths follow the audio. */
  level?: () => number;
  /** performance.now() time until which to show TV static. */
  staticUntil?: number;
  label: string;
}

/** A channel's pixel studio, drawn at 320x180 and scaled up with crisp pixels. */
export function Studio({
  scene, team, talking, level, staticUntil = 0, label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({
    scene, team, talking, level, staticUntil,
  });
  // The animation loop reads the latest props without restarting.
  useEffect(() => {
    propsRef.current = {
      scene, team, talking, level, staticUntil,
    };
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
      drawFrame(ctx, p.scene, p.team, { time, ...state, static: time < p.staticUntil });
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
