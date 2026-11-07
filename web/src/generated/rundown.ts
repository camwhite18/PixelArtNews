// Generated from schema/rundown.schema.json by 'pnpm gen:types'. Do not edit.

/**
 * A channel's broadcast schedule. Segments carry absolute UTC start times so every viewer hears the same moment.
 */
export interface Rundown {
  /**
   * Channel id, e.g. "world".
   */
  channel: string;
  generatedAt: string;
  segments: Segment[];
}
export interface Segment {
  id: string;
  type: "headlines" | "story" | "link" | "recap" | "breaking" | "advert" | "idle";
  /**
   * Absolute UTC start time.
   */
  start: string;
  /**
   * Measured from the encoded audio, not estimated.
   */
  durationS: number;
  /**
   * Path under /media, e.g. "audio/world/seg_8f2a.mp3".
   */
  audio: string;
  /**
   * Lower-third tab, e.g. "TOP STORY".
   */
  kicker?: string;
  headline?: string;
  ticker?: string;
  /**
   * Ids of the presenters on set for this segment (the shift's team), in seat order.
   */
  presenters?: string[];
  /**
   * The show (presenter shift) this segment was made for, e.g. "breakfast"; studios dress their set for it.
   */
  show?: string;
  lines: Line[];
  sources: Source[];
}
export interface Line {
  /**
   * Presenter id; two-presenter channels alternate.
   */
  speaker: string;
  text: string;
  /**
   * Offset of this line within the segment audio.
   */
  startS?: number;
  /**
   * Every line must cite at least one supplied source, except links and idle segments.
   */
  sourceIds: string[];
}
export interface Source {
  id: string;
  outlet: string;
  url: string;
}
