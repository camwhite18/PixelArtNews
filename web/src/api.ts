import type { Rundown } from './rundown';
import type { Look } from './scenes/presenters';

// `pnpm build:demo` sets this: sample broadcasts bundled with the app instead
// of the server. Vite inlines the flag, so normal builds drop the demo code.
const DEMO = import.meta.env.VITE_DEMO === '1';

export interface Presenter {
  id: string;
  name: string;
  /** Shifts they work: breakfast, daytime, evening, overnight. */
  shifts: string[];
  look?: Look;
}

export interface Channel {
  id: string;
  name: string;
  accent: string;
  scene: string;
  presenters: Presenter[];
}

export async function fetchChannels(): Promise<Channel[]> {
  if (DEMO) return (await import('./demo')).demoChannels;
  const res = await fetch('/api/channels');
  if (!res.ok) throw new Error(`channels: ${res.status}`);
  return res.json();
}

/** A channel's current schedule, or null if it has never been published. */
export async function fetchRundown(channelId: string): Promise<Rundown | null> {
  if (DEMO) return (await import('./demo')).demoRundown(channelId, Date.now());
  const res = await fetch(`/media/rundowns/${encodeURIComponent(channelId)}/latest.json`, {
    cache: 'no-cache',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`rundown ${channelId}: ${res.status}`);
  return res.json();
}

export interface BoardRow {
  label: string;
  value: string;
  /** F1 constructor id, for the row's colour stripe. */
  team?: string;
}

/** Real data for a studio board: the football table, the F1 standings. */
export interface Board {
  title: string;
  rows: BoardRow[];
  /** Attribution the data's terms require, e.g. football-data.org's. */
  credit: string;
}

/** A channel's studio board, or null if it has none (or the demo). */
export async function fetchBoard(channelId: string): Promise<Board | null> {
  if (DEMO) return null;
  const url = `/media/boards/${encodeURIComponent(channelId)}.json`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) return null;
  return res.json();
}

// Demo segments already carry a bundled audio URL.
export const mediaUrl = (path: string) => (DEMO ? path : `/media/${path}`);

// --- Server clock ---------------------------------------------------------
// Every viewer must agree on "now" to hear the same moment, so device clocks
// are corrected against the server's.

let offsetMs = 0;

export async function syncClock(): Promise<void> {
  if (DEMO) return;
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    const t1 = Date.now();
    const { nowMs } = (await res.json()) as { nowMs: number };
    offsetMs = nowMs + (t1 - t0) / 2 - t1;
  } catch {
    offsetMs = 0; // fall back to the device clock
  }
}

export const serverNow = () => Date.now() + offsetMs;

// --- Live updates ---------------------------------------------------------

type Listener = (channelId: string) => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

/** Calls `fn` with a channel id whenever that channel publishes a new rundown. */
export function onRundownPublished(fn: Listener): () => void {
  listeners.add(fn);
  if (!source && !DEMO) {
    source = new EventSource('/api/events');
    source.addEventListener('rundown', (e) => {
      listeners.forEach((l) => l((e as MessageEvent<string>).data));
    });
  }
  return () => listeners.delete(fn);
}
