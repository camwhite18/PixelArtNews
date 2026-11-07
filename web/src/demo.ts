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
    presenters: [
      {
        id: 'margot',
        name: 'Margot Lane',
        shifts: ['evening', 'daytime'],
        look: {
          skin: '#e8b48a',
          hair: '#2b1a10',
          hairStyle: 'long',
          outfit: '#b03a48',
          shirt: '#f4f1e6',
          neck: 'necklace',
          neckColour: '#ffd166',
        },
      },
      {
        id: 'kofi',
        name: 'Kofi Mensah',
        shifts: ['evening', 'breakfast'],
        look: {
          skin: '#8d5a3b',
          hair: '#141414',
          hairStyle: 'short',
          outfit: '#1d2b4a',
          shirt: '#f4f1e6',
          neck: 'tie',
          neckColour: '#4aa3ff',
          glasses: true,
        },
      },
      {
        id: 'tom',
        name: 'Tom Hale',
        shifts: ['breakfast', 'daytime', 'overnight'],
        look: {
          skin: '#f0c8a0',
          hair: '#7a4a22',
          hairStyle: 'short',
          outfit: '#2b3e5c',
          shirt: '#f4f1e6',
          neck: 'tie',
          neckColour: '#b03a48',
        },
      },
    ],
  },
  {
    id: 'tech',
    name: 'TECH',
    accent: '#3fe0b0',
    scene: 'tech',
    presenters: [
      {
        id: 'ray',
        name: 'Ray Byte',
        shifts: ['evening', 'daytime'],
        look: {
          skin: '#c68a5e',
          hair: '#8a5cf5',
          hairStyle: 'side',
          outfit: '#26323d',
          neck: 'strings',
          neckColour: '#f4f1e6',
          headset: true,
        },
      },
      {
        id: 'nina',
        name: 'Nina Patch',
        shifts: ['evening', 'breakfast'],
        look: {
          skin: '#6b4226',
          hair: '#141414',
          hairStyle: 'bun',
          outfit: '#5a3f8c',
          shirt: '#f4f1e6',
        },
      },
      {
        id: 'leo',
        name: 'Leo Kernel',
        shifts: ['breakfast', 'daytime', 'overnight'],
        look: {
          skin: '#e8b48a',
          hair: '#e0c060',
          hairStyle: 'short',
          outfit: '#3a3756',
          neck: 'strings',
          neckColour: '#3fe0b0',
          glasses: true,
        },
      },
    ],
  },
  {
    id: 'science',
    name: 'SCIENCE',
    accent: '#b48cff',
    scene: 'science',
    presenters: [
      {
        id: 'ada',
        name: 'Prof. Ada Quark',
        shifts: ['evening', 'daytime'],
        look: {
          skin: '#f0c8a0',
          hair: '#c9c9c9',
          hairStyle: 'bushy',
          outfit: '#e9e6dc',
          shirt: '#4aa3ff',
          neck: 'bowtie',
          neckColour: '#ff4d5e',
          glasses: true,
          mustache: '#c9c9c9',
        },
      },
      {
        id: 'mina',
        name: 'Mina Fields',
        shifts: ['evening', 'breakfast'],
        look: {
          skin: '#c68a5e',
          hair: '#3b2416',
          hairStyle: 'long',
          outfit: '#3fae7a',
          shirt: '#f4f1e6',
          neck: 'necklace',
          neckColour: '#b48cff',
        },
      },
      {
        id: 'sam',
        name: 'Dr Sam Orbit',
        shifts: ['breakfast', 'daytime', 'overnight'],
        look: {
          skin: '#8d5a3b',
          hair: '#141414',
          hairStyle: 'buzz',
          outfit: '#1d2b4a',
          shirt: '#4aa3ff',
          glasses: true,
        },
      },
    ],
  },
  {
    id: 'sport',
    name: 'SPORT',
    accent: '#ffb03b',
    scene: 'sport',
    presenters: [
      {
        id: 'dee',
        name: 'Dee Striker',
        shifts: ['evening', 'daytime'],
        look: {
          skin: '#8d5a3b',
          hair: '#141414',
          hairStyle: 'short',
          outfit: '#ffb03b',
          neck: 'zip',
          neckColour: '#0b0b14',
        },
      },
      {
        id: 'gus',
        name: 'Gus Ginger',
        shifts: ['evening', 'breakfast'],
        look: {
          skin: '#f2c29a',
          hair: '#c4622d',
          hairStyle: 'short',
          outfit: '#1f1f1f',
          shirt: '#f4f1e6',
          neck: 'tie',
          neckColour: '#ffb03b',
          beard: '#c4622d',
        },
      },
      {
        id: 'jas',
        name: 'Jas Kaur',
        shifts: ['breakfast', 'daytime', 'overnight'],
        look: {
          skin: '#c68a5e',
          hair: '#141414',
          hairStyle: 'bun',
          outfit: '#2a4a8c',
          shirt: '#f4f1e6',
        },
      },
    ],
  },
  {
    id: 'weird',
    name: 'WEIRD NEWS',
    accent: '#ff6fcf',
    scene: 'weird',
    presenters: [
      {
        id: 'rex',
        name: 'Rex Fizz',
        shifts: ['evening', 'daytime'],
        look: {
          skin: '#f2c29a',
          hair: '#ff9a2e',
          hairStyle: 'afro',
          outfit: '#2f8a3a',
          shirt: '#ff6fcf',
          neck: 'bowtie',
          neckColour: '#ffd166',
        },
      },
      {
        id: 'zorp',
        name: 'Zorp',
        shifts: ['evening', 'breakfast'],
        look: {
          skin: '#7be05a',
          alien: true,
          outfit: '#a9a6b8',
          neck: 'badge',
          neckColour: '#ff6fcf',
        },
      },
      {
        id: 'mags',
        name: 'Mags Moth',
        shifts: ['breakfast', 'daytime', 'overnight'],
        look: {
          skin: '#f0c8a0',
          hair: '#b48cff',
          hairStyle: 'long',
          outfit: '#3a0e32',
          neck: 'necklace',
          neckColour: '#ffd166',
          glasses: true,
        },
      },
    ],
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
      presenters: s.presenters,
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
