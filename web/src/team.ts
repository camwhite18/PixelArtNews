// Who is on set: the presenters a segment lists, or, with nothing on air,
// the team whose shift it is now.
import type { Channel, Presenter } from './api';
import type { Segment } from './rundown';
import { DEFAULT_LOOK, type Look } from './scenes/presenters';

// The same timetable as the server (internal/shifts), in UK time.
const TIMETABLE: [string, number][] = [
  ['overnight', 0], ['breakfast', 6], ['daytime', 10], ['evening', 17], ['overnight', 23],
];

/** The shift on air at `now`, by the hour in London. */
export function shiftAt(now: number): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/London',
  }).format(now));
  return TIMETABLE.reduce((cur, [id, start]) => (hour >= start ? id : cur), 'overnight');
}

export function teamOnSet(
  channel: Channel,
  segment: Segment | null | undefined,
  now: number,
): Presenter[] {
  const byId = new Map(channel.presenters.map((p) => [p.id, p]));
  const listed = (segment?.presenters ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is Presenter => p !== undefined);
  if (listed.length > 0) return listed;
  const shift = shiftAt(now);
  const onShift = channel.presenters.filter((p) => p.shifts?.includes(shift));
  return onShift.length > 0 ? onShift : channel.presenters.slice(0, 2);
}

export const looksOf = (team: Presenter[]): Look[] => team.map((p) => p.look ?? DEFAULT_LOOK);

export const namesOf = (team: Presenter[]) => team.map((p) => p.name).join(' & ');
