import { describe, expect, it } from 'vitest';
import type { Rundown, Segment } from './rundown';
import { lineAt, onAir, runningLow, upNext } from './rundown';

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
      { speaker: 'kofi', text: 'Two', startS: 4.5, sourceIds: ['s1'] },
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
