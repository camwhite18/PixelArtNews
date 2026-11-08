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
  type: "headlines" | "story" | "link" | "recap" | "breaking" | "advert" | "idle" | "weather";
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
  /**
   * A pixel icon for the story, shown on the studio's big screen while it airs.
   */
  art?:
    | "globe"
    | "ballot"
    | "gavel"
    | "money"
    | "chart"
    | "rocket"
    | "planet"
    | "flask"
    | "chip"
    | "phone"
    | "robot"
    | "gamepad"
    | "heart"
    | "leaf"
    | "storm"
    | "fire"
    | "trophy"
    | "ball"
    | "car"
    | "flag"
    | "ufo"
    | "ghost"
    | "film"
    | "music";
  /**
   * Seconds of channel ident or sting at the start of the audio, before the first line.
   */
  introS?: number;
  /**
   * Forecast shown on the weather map during a weather segment.
   */
  weather?: WeatherPlace[];
  lines: Line[];
  sources: Source[];
}
export interface WeatherPlace {
  /**
   * Place id, e.g. "london".
   */
  place: string;
  /**
   * WMO weather code for the day.
   */
  code: number;
  maxC: number;
  minC: number;
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
