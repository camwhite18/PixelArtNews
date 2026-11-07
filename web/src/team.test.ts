import { describe, expect, it } from 'vitest';
import type { Channel } from './api';
import { shiftAt, teamOnSet } from './team';

const channel: Channel = {
  id: 'world',
  name: 'WORLD',
  accent: '#4aa3ff',
  scene: 'world',
  presenters: [
    { id: 'margot', name: 'Margot Lane', shifts: ['evening', 'daytime'] },
    { id: 'kofi', name: 'Kofi Mensah', shifts: ['evening', 'breakfast'] },
    { id: 'tom', name: 'Tom Hale', shifts: ['breakfast', 'daytime', 'overnight'] },
  ],
};

const london = (iso: string) => Date.parse(iso); // ISO strings with an offset

describe('shiftAt', () => {
  it('follows the UK timetable', () => {
    expect(shiftAt(london('2026-11-07T07:00:00Z'))).toBe('breakfast'); // GMT
    expect(shiftAt(london('2026-11-07T12:00:00Z'))).toBe('daytime');
    expect(shiftAt(london('2026-11-07T18:00:00Z'))).toBe('evening');
    expect(shiftAt(london('2026-11-07T23:30:00Z'))).toBe('overnight');
    expect(shiftAt(london('2026-11-08T03:00:00Z'))).toBe('overnight');
    expect(shiftAt(london('2026-07-07T05:30:00Z'))).toBe('breakfast'); // 06:30 BST
  });
});

describe('teamOnSet', () => {
  it('uses the presenters a segment lists', () => {
    const team = teamOnSet(channel, { presenters: ['kofi', 'tom'] } as never, 0);
    expect(team.map((p) => p.id)).toEqual(['kofi', 'tom']);
  });

  it('falls back to the shift on air', () => {
    const team = teamOnSet(channel, null, london('2026-11-07T23:30:00Z'));
    expect(team.map((p) => p.id)).toEqual(['tom']);
  });
});
