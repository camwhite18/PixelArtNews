import { describe, expect, it } from 'vitest';
import { SCENES } from './data';
import {
  DEFAULT_LOOK, type Look, presenterRects, seatsFor,
} from './presenters';
import {
  HEIGHT, idleTalk, sceneLayers, WIDTH,
} from './render';
import { SHOW_IDS, showFor } from './shows';

const human: Look = {
  skin: '#e8b48a',
  hair: '#2b1a10',
  hairStyle: 'afro',
  outfit: '#b03a48',
  shirt: '#f4f1e6',
  neck: 'tie',
  glasses: true,
  beard: '#2b1a10',
  headset: true,
};
const alien: Look = {
  skin: '#7be05a', alien: true, outfit: '#a9a6b8', neck: 'badge',
};
const frame = { time: 0, talking: 0, mouthOpen: true };

const inside = ([x, y, w, h]: number[]) => x >= 0 && y >= 0 && x + w <= WIDTH && y + h <= HEIGHT;

describe('studios', () => {
  it('has a studio for every channel', () => {
    expect(Object.keys(SCENES).sort()).toEqual(['science', 'sport', 'tech', 'weird', 'world']);
  });

  describe.each(Object.entries(SCENES))('%s', (_, scene) => {
    // `_` is the scene id.
    it.each([
      ['a solo host', [human]],
      ['a pair', [human, alien]],
      ['an alien pair', [alien, DEFAULT_LOOK]],
    ])('keeps %s inside the canvas', (_label, team) => {
      sceneLayers(scene, team, frame).flat().forEach((r) => {
        expect(inside(r as number[]), `rect ${r.slice(0, 4).join(',')}`).toBe(true);
      });
    });

    it.each(SHOW_IDS)('keeps the %s set inside the canvas', (showId) => {
      const show = showFor(_, showId);
      (show.texts ?? []).forEach(([x, y, , , text]) => {
        expect(inside([x, y - 8, 1, 8]), text).toBe(true);
      });
      sceneLayers(scene, [human, alien], frame, show).flat().forEach((r) => {
        expect(inside(r as number[]), `rect ${r.slice(0, 4).join(',')}`).toBe(true);
      });
    });

    it('dresses the set differently for every show', () => {
      const looks = SHOW_IDS.map((id) => JSON.stringify(showFor(_, id)));
      expect(new Set(looks).size).toBe(SHOW_IDS.length);
    });

    it('seats a pair without overlapping heads', () => {
      const [a, b] = seatsFor(scene.seats, 2);
      expect(b - a).toBeGreaterThanOrEqual(40);
    });
  });
});

describe('presenter sprites', () => {
  it('opens only the speaking presenter\'s mouth', () => {
    const scene = SCENES.world;
    const f = { time: 0, talking: 1, mouthOpen: true };
    const BODIES = 5; // under, set, tint, lights, show backdrop, then presenters
    const bodies = sceneLayers(scene, [human, DEFAULT_LOOK], f)[BODIES];
    const [x0, x1] = seatsFor(scene.seats, 2);
    const open = bodies.filter(([, y, w, h]) => y === 81 && h === 4 && w === 6);
    expect(open.map(([x]) => x)).toEqual([x1 + 8]);
    expect(open.map(([x]) => x)).not.toContain(x0 + 8);
  });

  it('draws different looks differently', () => {
    const a = presenterRects(100, human, 0, false);
    expect(a).not.toEqual(presenterRects(100, DEFAULT_LOOK, 0, false));
    expect(presenterRects(100, alien, 0, false).some(([, y]) => y < 55)).toBe(true); // antennae
  });
});

describe('shows', () => {
  it('falls back to the daytime look for unknown or missing shows', () => {
    expect(showFor('world', 'teatime')).toEqual(showFor('world', 'daytime'));
    expect(showFor('world', undefined)).toEqual(showFor('world', 'daytime'));
    expect(showFor('nowhere', 'breakfast')).toEqual({});
  });

  it('dims the set overnight but keeps its lights on', () => {
    const scene = SCENES.tech;
    const layers = sceneLayers(scene, [], frame, showFor('tech', 'overnight'));
    const [, , tint, lights] = layers;
    expect(tint).toHaveLength(1);
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.every(([, , , , , fx]) => fx === 'blink' || fx === 'blink2')).toBe(true);
  });
});

describe('idleTalk', () => {
  it('alternates speakers on two-presenter teams', () => {
    expect(idleTalk(0, 2).talking).toBe(0);
    expect(idleTalk(2500, 2).talking).toBe(1);
    expect(idleTalk(2500, 1).talking).toBe(0);
    expect(idleTalk(0, 0).talking).toBeNull();
  });
});
