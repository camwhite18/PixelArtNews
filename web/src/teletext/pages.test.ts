import { describe, expect, it } from 'vitest';
import { demoChannels, demoRundown } from '../demo';
import { fromHash, parse, toHash } from '../router';
import {
  buildPage,
  COLS,
  CONTENT_ROWS,
  pageNumbers,
  storiesOf,
  type TextData,
  WEATHER,
  wrap,
} from './pages';

const now = Date.UTC(2026, 10, 8, 9, 0);
const data: TextData = {
  channels: demoChannels,
  rundowns: Object.fromEntries(demoChannels.map((c) => [c.id, demoRundown(c.id, now)])),
  boards: {
    football: {
      title: 'TABLE',
      credit: 'Football data provided by the Football-Data.org API',
      rows: [{ label: 'ARS', value: '31' }],
    },
    f1: null,
  },
  now,
};

describe('teletext pages', () => {
  const numbers = pageNumbers(data);

  it('has an index, a page per channel and its stories', () => {
    expect(numbers[0]).toBe(100);
    expect(numbers).toContain(110);
    expect(numbers).toContain(170);
    expect(numbers.filter((n) => n > 110 && n < 120).length).toBe(
      storiesOf(data.rundowns.world, now).length,
    );
  });

  it.each(pageNumbers(data))('page %i fits the screen and links to real pages', (num) => {
    const page = buildPage(num, data)!;
    expect(page).not.toBeNull();
    page.subpages.forEach((rows) => {
      expect(rows.length).toBeLessThanOrEqual(CONTENT_ROWS);
      rows.forEach((r) => {
        expect(r.spans.reduce((n, s) => n + s.text.length, 0)).toBeLessThanOrEqual(COLS);
        r.spans.forEach((s) => {
          if (s.link) expect(numbers).toContain(s.link);
        });
      });
    });
    page.fastext.forEach(([target]) => expect(numbers).toContain(target));
  });

  it('shows the latest forecast on page 400', () => {
    const text = buildPage(WEATHER, data)!
      .subpages.flat()
      .flatMap((r) => r.spans.map((s) => s.text))
      .join('|');
    expect(text).toContain('London');
    expect(text).toContain('Open-Meteo');
  });

  it('credits the football data on the table page', () => {
    const text = buildPage(302, data)!
      .subpages.flat()
      .flatMap((r) => r.spans.map((s) => s.text))
      .join(' ');
    expect(text).toContain('ARS');
    expect(text).toContain('Football-Data.org');
  });

  it('has no page for unknown numbers', () => {
    expect(buildPage(555, data)).toBeNull();
    expect(buildPage(119, data)).toBeNull();
  });

  it('wraps text between words', () => {
    expect(wrap('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
    expect(wrap('abcdefghijklmnop', 5)).toEqual(['abcde', 'fghij', 'klmno', 'p']);
  });
});

describe('text routes', () => {
  it('parses page numbers, with 100 by default', () => {
    expect(parse('/text')).toEqual({ page: 'text', num: 100 });
    expect(parse('/text/302')).toEqual({ page: 'text', num: 302 });
    expect(parse('/ch/world')).toEqual({ page: 'channel', id: 'world' });
  });

  it('round-trips through plain-name hashes for the demo', () => {
    expect(toHash('/text/400')).toBe('#text-400');
    expect(fromHash('#text-400')).toBe('/text/400');
    expect(fromHash('#tech')).toBe('/ch/tech');
  });
});
