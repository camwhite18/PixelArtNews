import { useEffect, useRef } from 'preact/hooks';
import { drawFrame, HEIGHT, idleTalk, WIDTH } from '../scenes/render';

interface Props {
  scene: string | null;
  presenters: number;
  /** Index of the presenter speaking, from the live line; undefined = idle animation. */
  talking?: number | null;
  /** Live loudness 0..1; when given, mouths follow the audio. */
  level?: () => number;
  /** performance.now() time until which to show TV static. */
  staticUntil?: number;
  label: string;
}

/** A channel's pixel studio, drawn at 320x180 and scaled up with crisp pixels. */
export function Studio({ scene, presenters, talking, level, staticUntil = 0, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ scene, presenters, talking, level, staticUntil });
  props.current = { scene, presenters, talking, level, staticUntil };

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let lastMouth = 0;
    let mouthOpen = false;
    const frame = (time: number) => {
      const p = props.current;
      let state = idleTalk(time, p.presenters);
      if (p.talking !== undefined) {
        // Pixel mouths look best toggling at ~8fps rather than every frame.
        if (time - lastMouth > 120) {
          lastMouth = time;
          mouthOpen = p.level ? p.level() > 0.04 : !mouthOpen;
        }
        state = { talking: p.talking, mouthOpen: p.talking !== null && mouthOpen };
      }
      drawFrame(ctx, p.scene, { time, ...state, static: time < p.staticUntil });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} class="studio" width={WIDTH} height={HEIGHT} role="img" aria-label={label} />;
}
