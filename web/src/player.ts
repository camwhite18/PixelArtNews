import { mediaUrl, serverNow } from './api';
import { endMs, lineAt, onAir, type Rundown, type Segment, upNext } from './rundown';

export interface NowPlaying {
  segment: Segment | null;
  speaker: string | null;
  /** Audio should be playing but the browser is holding it until a click. */
  blocked: boolean;
}

/**
 * Plays a channel's rundown in sync with the server clock. Joining mid-segment
 * seeks into the audio, so every viewer hears the same moment.
 *
 * Browsers only allow audio after a user gesture, so call `unlock()` from a
 * click handler before (or after) `play()`.
 */
export class Player {
  private audio = new Audio();
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples = new Uint8Array(256);
  private rundown: Rundown | null = null;
  private currentId: string | null = null;
  private timer: number | undefined;
  private prefetched = new Set<string>();
  private rejected = false;

  constructor(private onChange: (np: NowPlaying) => void) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('playing', () => {
      this.rejected = false;
    });
    // Safari (including iPad) ignores a seek made before the new file's
    // metadata loads, so seek again once it has, to wherever "now" is by then.
    this.audio.addEventListener('loadedmetadata', () => {
      const air = onAir(this.rundown, serverNow());
      if (air && air.segment.id === this.currentId) this.audio.currentTime = air.offsetS;
    });
  }

  private tryPlay() {
    this.audio.play().catch((e: DOMException) => {
      if (e.name === 'NotAllowedError') this.rejected = true;
    });
  }

  /** Must run inside a user gesture: creates the audio graph for lip-sync. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      src.connect(this.analyser).connect(this.ctx.destination);
    } catch {
      this.ctx = null; // no Web Audio: audio still plays, mouths use idle animation
    }
    this.tryPlay();
  }

  setRundown(r: Rundown | null) {
    this.rundown = r;
    this.tick();
  }

  start() {
    this.stop();
    this.timer = window.setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop() {
    window.clearInterval(this.timer);
    this.audio.pause();
    this.currentId = null;
  }

  /** Loudness 0..1 of what is playing right now, for mouth animation. */
  level(): number {
    if (!this.analyser || this.audio.paused) return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    let sum = 0;
    for (const v of this.samples) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / this.samples.length);
  }

  private tick() {
    const now = serverNow();
    const air = onAir(this.rundown, now);
    if (!air) {
      if (this.currentId !== null) this.audio.pause();
      this.currentId = null;
      this.onChange({ segment: null, speaker: null, blocked: false });
      return;
    }
    const { segment, offsetS } = air;
    if (segment.id !== this.currentId) {
      this.currentId = segment.id;
      this.audio.src = mediaUrl(segment.audio);
      this.audio.currentTime = offsetS;
      this.tryPlay();
    } else if (!this.audio.paused && Math.abs(this.audio.currentTime - offsetS) > 1.5) {
      this.audio.currentTime = offsetS; // drifted (tab was asleep, network stall)
    }
    this.prefetchNext(now);
    this.onChange({
      segment,
      speaker: lineAt(segment, offsetS)?.speaker ?? null,
      blocked: this.rejected && this.audio.paused,
    });
  }

  /** Warm the browser cache with the next segment's audio a little early. */
  private prefetchNext(now: number) {
    const next = upNext(this.rundown, now);
    if (!next || this.prefetched.has(next.id)) return;
    const air = onAir(this.rundown, now);
    if (air && endMs(air.segment) - now > 20_000) return;
    this.prefetched.add(next.id);
    void fetch(mediaUrl(next.audio)).catch(() => {});
  }
}
