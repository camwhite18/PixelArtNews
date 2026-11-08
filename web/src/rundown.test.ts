import { describe, expect, it } from 'vitest';
import type { Rundown, Segment } from './rundown';
import {
  captionAt, captionChunks, lineAt, onAir, runningLow, upNext,
} from './rundown';

const T0 = Date.parse('2026-11-07T13:00:00Z');

function seg(id: string, startOffsetS: number, durationS: number): Segment {
  return {
    id,
    type: 'story',
    start: new Date(T0 + startOffsetS * 1000).toISOString(),
    durationS,
    audio: `audio/world/${id}.mp3`,
    lines: [
      { speaker: 'margot', text: 'One', sourceIds: ['s1'] },
      {
        speaker: 'kofi', text: 'Two', startS: 4.5, sourceIds: ['s1'],
      },
    ],
    sources: [{ id: 's1', outlet: 'Example', url: 'https://example.com' }],
  };
}

const rundown: Rundown = {
  channel: 'world',
  generatedAt: new Date(T0).toISOString(),
  segments: [seg('a', 0, 60), seg('b', 60, 30)],
};

describe('onAir', () => {
  it('finds the segment and offset at a moment', () => {
    const r = onAir(rundown, T0 + 70_000);
    expect(r?.segment.id).toBe('b');
    expect(r?.offsetS).toBeCloseTo(10);
  });

  it('returns null outside the schedule', () => {
    expect(onAir(rundown, T0 - 1)).toBeNull();
    expect(onAir(rundown, T0 + 90_000)).toBeNull();
    expect(onAir(null, T0)).toBeNull();
  });
});

describe('upNext', () => {
  it('returns the next segment to start', () => {
    expect(upNext(rundown, T0 + 10_000)?.id).toBe('b');
    expect(upNext(rundown, T0 + 70_000)).toBeNull();
  });
});

describe('lineAt', () => {
  it('switches speaker at each line start', () => {
    const s = rundown.segments[0];
    expect(lineAt(s, 1)?.speaker).toBe('margot');
    expect(lineAt(s, 5)?.speaker).toBe('kofi');
  });
});

describe('runningLow', () => {
  it('flags schedules about to run out', () => {
    expect(runningLow(rundown, T0 + 80_000, 60_000)).toBe(true);
    expect(runningLow(rundown, T0, 60_000)).toBe(false);
    expect(runningLow(null, T0, 60_000)).toBe(true);
  });
});

describe('captions', () => {
  it('splits long lines between words, within the limit', () => {
    const text = 'The leader has been out front since the start, which in this demo is a record.';
    const chunks = captionChunks(text, 30);
    expect(chunks.join(' ')).toBe(text);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(30));
  });

  it('splits into even chunks rather than leaving a straggler', () => {
    const chunks = captionChunks(
      'Morning, Tess. Just one car out on track so far. Nice and quiet on the radio.',
      70,
    );
    expect(chunks).toHaveLength(2);
    expect(Math.min(...chunks.map((c) => c.length))).toBeGreaterThan(25);
  });

  it('keeps a short line whole', () => {
    expect(captionChunks('Give me time.', 30)).toEqual(['Give me time.']);
  });

  it('turns chunks over during the line, by length', () => {
    const s = seg('a', 0, 20);
    s.lines[0].text = 'aaaa bbbb cccc dddd'; // two chunks of 9 at max 9
    s.lines[0].startS = 0;
    s.lines[1].startS = 10;
    expect(captionAt(s, 0, 1, 9)).toBe('aaaa bbbb');
    expect(captionAt(s, 0, 7, 9)).toBe('cccc dddd');
    expect(captionAt(s, 1, 15, 9)).toBe('Two');
    expect(captionAt(s, 5, 15, 9)).toBe('');
  });
});
