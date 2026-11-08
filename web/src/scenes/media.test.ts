import { describe, expect, it } from 'vitest';
import schema from '../../../schema/rundown.schema.json';
import { artRects, ICONS } from './art';
import { SCENES } from './data';
import { introGraphics } from './ident';
import {
  HEIGHT, sceneLayers, sceneTexts, WIDTH,
} from './render';
import type { Show } from './shows';
import { CITIES, symbolFor, weatherMap } from './weathermap';

const inside = ([x, y, w, h]: number[]) => x >= 0 && y >= 0 && x + w <= WIDTH && y + h <= HEIGHT;
const frame = { time: 0, talking: null, mouthOpen: false };
const look = { skin: '#e8b48a', outfit: '#333' };

describe('story art', () => {
  it('has an icon for every art id in the schema', () => {
    const ids = schema.$defs.segment.properties.art.enum;
    expect(Object.keys(ICONS).sort()).toEqual([...ids].sort());
  });

  it.each(Object.entries(ICONS))('%s is a 12x12 bitmap in the palette', (_, rows) => {
    expect(rows).toHaveLength(12);
    rows.forEach((r) => {
      expect(r).toHaveLength(12);
      expect(r).toMatch(/^[.kwsSbdgGtroypn]+$/);
    });
  });

  it.each(Object.entries(SCENES))('fits the %s screen', (_, scene) => {
    const layers = sceneLayers(scene, [look], frame, {}, { art: 'rocket', accent: '#4aa3ff' });
    layers.flat().forEach((r) => expect(inside(r as number[])).toBe(true));
    if (scene.screen) expect(artRects('rocket', scene.screen, '#fff').length).toBeGreaterThan(5);
  });
});

describe('weather map', () => {
  const places = Object.keys(CITIES).map((place, i) => ({
    place, code: [0, 2, 3, 61, 71, 95, 45, 80][i], maxC: 10 + i, minC: 3,
  }));

  it('maps every city inside the World screen', () => {
    const g = weatherMap(SCENES.world.screen!, places);
    g.rects.forEach((r) => expect(inside(r as number[])).toBe(true));
    expect(g.texts.filter(([, , , , t]) => t.endsWith('°'))).toHaveLength(places.length);
    const texts = sceneTexts(SCENES.world, {}, { weather: places });
    expect(texts.some(([, , , , t]) => t === 'DATA: OPEN-METEO')).toBe(true);
  });

  const codes: [number, string][] = [
    [0, 'sun'], [1, 'part'], [3, 'cloud'], [45, 'fog'], [63, 'rain'], [73, 'snow'], [96, 'storm'],
  ];
  it.each(codes)(
    'shows code %i as %s',
    (code, symbol) => expect(symbolFor(code)).toBe(symbol),
  );
});

describe('boards', () => {
  const board = {
    title: 'DRIVERS',
    credit: 'x',
    rows: Array.from({ length: 10 }, (_, i) => ({
      label: `D${i}`, value: `${400 - i * 20}`, team: 'mclaren',
    })),
  };

  it.each(['football', 'f1'])('draws real rows on the %s board, inside the canvas', (id) => {
    const scene = SCENES[id];
    sceneLayers(scene, [look], frame, {}, { board }).flat()
      .forEach((r) => expect(inside(r as number[])).toBe(true));
    const texts = sceneTexts(scene, {}, { board });
    expect(texts.filter(([, , , , t]) => t === 'D0')).toHaveLength(1);
  });

  it('hides screen text under story art', () => {
    const show: Show = { texts: [[165, 29, 8, '#fff', 'LIVE SCORES']] };
    const words = (art?: string) => sceneTexts(SCENES.football, show, { art }).map((t) => t[4]);
    expect(words()).toContain('LIVE SCORES');
    expect(words('ball')).not.toContain('LIVE SCORES');
  });

  it('replaces the timing tower header with the board title', () => {
    const texts = sceneTexts(SCENES.f1, { texts: [[14, 33, 8, '#fff', 'FP1']] }, { board });
    expect(texts.map(([, , , , t]) => t)).not.toContain('FP1');
    expect(texts.map(([, , , , t]) => t)).toContain('DRIVERS');
  });
});

describe('idents and stings', () => {
  it.each([0, 0.1, 0.5, 0.9, 1])('stay inside the canvas at %s', (progress) => {
    ['ident', 'sting'].forEach((style) => {
      const g = introGraphics({
        style: style as 'ident' | 'sting', progress, name: 'WORLD', accent: '#4aa3ff',
      });
      g.rects.forEach((r) => expect(inside(r as number[])).toBe(true));
    });
  });

  it('shows the channel name once the ident card is closed', () => {
    const g = introGraphics({
      style: 'ident', progress: 0.5, name: 'WORLD', accent: '#4aa3ff',
    });
    expect(g.texts.map(([, , , , t]) => t)).toEqual(['PXN', 'WORLD']);
  });
});
