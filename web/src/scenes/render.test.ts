import { describe, expect, it } from 'vitest';
import { SCENES } from './data';
import { HEIGHT, idleTalk, WIDTH } from './render';

// Presenters per studio, matching the seeded channels.
const PRESENTERS: Record<string, number> = { world: 2, tech: 1, science: 1, sport: 2, weird: 2 };

describe('scene data', () => {
  it('has a studio for every channel', () => {
    expect(Object.keys(SCENES).sort()).toEqual(Object.keys(PRESENTERS).sort());
  });

  for (const [id, scene] of Object.entries(SCENES)) {
    it(`${id}: every rect sits inside the 320x180 canvas`, () => {
      for (const [x, y, w, h] of scene.rects) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(WIDTH);
        expect(y + h).toBeLessThanOrEqual(HEIGHT);
      }
    });

    it(`${id}: has an animated mouth for each presenter`, () => {
      const mouths = new Set(scene.rects.map((r) => r[5]).filter((a) => a?.startsWith('mouth')));
      expect(mouths.size).toBe(PRESENTERS[id]);
    });
  }
});

describe('idleTalk', () => {
  it('alternates speakers on two-presenter channels', () => {
    expect(idleTalk(0, 2).talking).toBe(0);
    expect(idleTalk(2500, 2).talking).toBe(1);
    expect(idleTalk(2500, 1).talking).toBe(0);
    expect(idleTalk(0, 0).talking).toBeNull();
  });
});
