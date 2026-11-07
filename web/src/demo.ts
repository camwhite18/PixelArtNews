// Demo data for `pnpm build:demo`: the real app, fed by sample broadcasts
// generated ahead of time (demo/script.json, demo/generate.py) instead of the
// server. Only imported when VITE_DEMO=1, so it is left out of normal builds.
import script from '../demo/script.json';
import timings from '../demo/out/segments.json';
import type { Channel } from './api';
import type { Rundown, Segment } from './rundown';

const audio = import.meta.glob<string>('../demo/out/audio/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const demoChannels: Channel[] = [
  {
    id: 'world',
    name: 'WORLD',
    accent: '#4aa3ff',
    scene: 'world',
    presenters: [{ id: 'margot', name: 'Margot Lane' }, { id: 'kofi', name: 'Kofi Mensah' }],
  },
  {
    id: 'tech',
    name: 'TECH',
    accent: '#3fe0b0',
    scene: 'tech',
    presenters: [{ id: 'ray', name: 'Ray Byte' }],
  },
  {
    id: 'science',
    name: 'SCIENCE',
    accent: '#b48cff',
    scene: 'science',
    presenters: [{ id: 'ada', name: 'Prof. Ada Quark' }],
  },
  {
    id: 'sport',
    name: 'SPORT',
    accent: '#ffb03b',
    scene: 'sport',
    presenters: [{ id: 'dee', name: 'Dee Striker' }, { id: 'gus', name: 'Gus Ginger' }],
  },
  {
    id: 'weird',
    name: 'WEIRD NEWS',
    accent: '#ff6fcf',
    scene: 'weird',
    presenters: [{ id: 'rex', name: 'Rex Fizz' }, { id: 'zorp', name: 'Zorp' }],
  },
];

interface Timing {
  durationS: number;
  lineStarts: number[];
}
const timed = timings as Record<string, Timing>;

// Every viewer's schedule is anchored to the same instant, so the demo, like
// the real channels, plays the same moment for everyone.
const EPOCH_MS = Date.UTC(2026, 0, 1);
const HORIZON_MS = 3 * 60 * 60 * 1000;

/** The demo schedule for a channel: its sample segments on a loop, around `now`. */
export function demoRundown(channelId: string, now: number): Rundown | null {
  const channel = script.channels.find((c) => c.id === channelId);
  if (!channel) return null;

  const loop = channel.segments.map((s): Omit<Segment, 'start'> => {
    const t = timed[s.id];
    return {
      id: s.id,
      type: s.type as Segment['type'],
      kicker: s.kicker,
      headline: s.headline,
      ticker: s.ticker,
      durationS: t.durationS,
      audio: audio[`../demo/out/audio/${s.id}.mp3`],
      lines: s.lines.map(([speaker, text], i) => ({
        speaker, text, startS: t.lineStarts[i], sourceIds: [],
      })),
      sources: [],
    };
  });
  const loopMs = loop.reduce((ms, s) => ms + s.durationS * 1000, 0);

  const segments: Segment[] = [];
  let start = EPOCH_MS + Math.floor((now - EPOCH_MS) / loopMs) * loopMs;
  for (let n = 0; start < now + HORIZON_MS; n += 1) {
    const s = loop[n % loop.length];
    segments.push({ ...s, id: `${s.id}-${n}`, start: new Date(start).toISOString() });
    start += s.durationS * 1000;
  }
  return { channel: channelId, generatedAt: new Date(now).toISOString(), segments };
}
