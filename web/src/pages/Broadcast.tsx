import {
  useEffect, useMemo, useRef, useState,
} from 'preact/hooks';
import { type Channel, serverNow } from '../api';
import { PixelIcon } from '../components/PixelIcon';
import { Studio } from '../components/Studio';
import { shotFor } from '../scenes/camera';
import {
  looksOf, namesOf, showOf, teamOnSet,
} from '../team';
import { type NowPlaying, Player } from '../player';
import { href, navigate } from '../router';
import {
  captionAt, clockTime, segmentLabel, startMs, upNext,
} from '../rundown';
import type { IntroTiming } from '../components/Studio';
import { useBoard } from '../useBoard';
import { useRundown } from '../useRundown';

const DEFAULT_TICKER = 'Pixel Art News · 24/7 AI news channels';
const CAPTIONS_KEY = 'pxn.captions';
/** Characters per caption chunk, name included: two lines of the caption box. */
const CAPTION_CHARS = 72;

/** Whether this viewer last left subtitles on; storage may be unavailable. */
function captionsWereOn(): boolean {
  try {
    return localStorage.getItem(CAPTIONS_KEY) === 'on';
  } catch {
    return false;
  }
}

function rememberCaptions(on: boolean) {
  try {
    localStorage.setItem(CAPTIONS_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered; subtitles still toggle for this visit.
  }
}

interface Props {
  channels: Channel[];
  channelId: string;
  /** True when a click on this page load already allowed audio. */
  unlocked: boolean;
  onUnlock: () => void;
}

export function Broadcast({
  channels, channelId, unlocked, onUnlock,
}: Props) {
  const index = channels.findIndex((c) => c.id === channelId);
  const channel = channels[index] ?? null;
  const rundown = useRundown(channelId);
  const board = useBoard(channelId);
  const [np, setNp] = useState<NowPlaying>({
    segment: null, line: null, offsetS: 0, speaker: null, blocked: false,
  });
  const [captions, setCaptions] = useState(captionsWereOn);
  const [showSources, setShowSources] = useState(false);
  const [staticUntil, setStaticUntil] = useState(0);
  const [now, setNow] = useState(serverNow());
  const touchYRef = useRef<number | null>(null);

  const player = useMemo(() => new Player(setNp), []);

  useEffect(() => {
    if (unlocked) player.unlock();
    player.start();
    const clock = setInterval(() => setNow(serverNow()), 1000);
    return () => {
      player.stop();
      clearInterval(clock);
    };
  }, [player, unlocked]);

  useEffect(() => player.setRundown(rundown), [player, rundown]);

  const toggleCaptions = () => {
    rememberCaptions(!captions);
    setCaptions(!captions);
  };

  const zap = (dir: 1 | -1) => {
    if (channels.length === 0) return;
    const next = channels[(Math.max(index, 0) + dir + channels.length) % channels.length];
    setStaticUntil(performance.now() + 350);
    setShowSources(false);
    navigate(`/ch/${next.id}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') zap(-1);
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') zap(1);
      else if (e.key === 'Escape') navigate('/');
      else if (e.key === 'c' || e.key === 'C') toggleCaptions();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!channel) {
    return (
      <main className="stage-wrap">
        <p className="error">
          Unknown channel.
          {' '}
          <a href={href('/')}>Back to the guide</a>
        </p>
      </main>
    );
  }

  const seg = np.segment;
  const next = upNext(rundown, now);
  const team = teamOnSet(channel, seg, now);
  const talking = seg ? team.findIndex((p) => p.id === np.speaker) : null;
  const hosts = namesOf(team);
  const seat = talking === null || talking < 0 ? null : talking;
  const line = seg && np.line !== null ? seg.lines[np.line] : null;
  // First name, skipping titles: "Prof. Ada Quark" is "Ada".
  const speakerName = channel.presenters
    .find((p) => p.id === line?.speaker)?.name.split(' ')
    .find((w) => !/^(Prof|Dr)\.?$/.test(w)) ?? '';
  // The jingle at the start of the segment: the show opens with the channel
  // ident, each story with a sting.
  const intro: IntroTiming | null = seg?.introS ? {
    style: seg.type === 'headlines' ? 'ident' : 'sting',
    startMs: startMs(seg),
    lengthMs: seg.introS * 1000,
    name: channel.name,
  } : null;
  const ticker = `${seg?.ticker || DEFAULT_TICKER}${board ? `  ·  ${board.credit}` : ''}`;
  const captionText = seg && np.line !== null
    ? captionAt(seg, np.line, np.offsetS, CAPTION_CHARS - speakerName.length - 2)
    : '';

  return (
    <main
      className="stage-wrap"
      style={{ '--accent': channel.accent }}
      onTouchStart={(e) => {
        touchYRef.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchYRef.current === null) return;
        const dy = e.changedTouches[0].clientY - touchYRef.current;
        touchYRef.current = null;
        if (Math.abs(dy) > 60) zap(dy < 0 ? 1 : -1);
      }}
    >
      <div className="stage">
        <Studio
          scene={seg ? channel.scene : null}
          show={showOf(seg, now)}
          team={looksOf(team)}
          talking={seat}
          level={() => player.level()}
          shot={shotFor(np.line, seat)}
          accent={channel.accent}
          art={seg?.type === 'story' ? seg.art : null}
          weather={seg?.type === 'weather' ? seg.weather : null}
          board={board}
          intro={intro}
          staticUntil={staticUntil}
          label={`${channel.name} studio`}
        />

        <div className="bug">
          <span className="bug-net">PXN</span>
          <span className="bug-ch">{channel.name}</span>
        </div>

        <div className="top-right">
          <div className="row">
            {seg && (
              <span className="badge-live">
                <span className="dot" aria-hidden="true" />
                LIVE
              </span>
            )}
            <span className="clock">{clockTime(now)}</span>
          </div>
          {next && (
            <span className="next">
              NEXT
              {' '}
              {clockTime(startMs(next))}
              {' '}
              ·
              {' '}
              {segmentLabel(next).toUpperCase()}
            </span>
          )}
        </div>

        {seg ? (
          <div className="lower-third">
            {captions && (
              <p className="captions" aria-hidden={!captionText}>
                {captionText && speakerName && (
                  <span className="caption-who">{`${speakerName}:`}</span>
                )}
                {captionText && ` ${captionText}`}
              </p>
            )}
            <div className="lt-tabs">
              <span className="kicker">{seg.kicker || segmentLabel(seg).toUpperCase()}</span>
              <span className="hosts">{hosts}</span>
            </div>
            {seg.headline && <div className="lt-headline">{seg.headline}</div>}
          </div>
        ) : (
          <div className="lower-third">
            <div className="lt-headline">Off air — the first broadcast is being prepared.</div>
          </div>
        )}

        <div className="controls">
          <button
            type="button"
            className="ctl"
            aria-pressed={captions}
            aria-label="Subtitles"
            title="Subtitles (C)"
            onClick={toggleCaptions}
          >
            CC
          </button>
          <a
            className="ctl"
            href={href('/')}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            <PixelIcon name="left" />
            GUIDE
          </a>
          <button type="button" className="ctl" aria-label="Channel up" onClick={() => zap(-1)}>
            CH
            <PixelIcon name="up" />
          </button>
          <button type="button" className="ctl" aria-label="Channel down" onClick={() => zap(1)}>
            CH
            <PixelIcon name="down" />
          </button>
          {seg && seg.sources.length > 0 && (
            <button
              type="button"
              className="ctl"
              aria-expanded={showSources}
              onClick={() => setShowSources(!showSources)}
            >
              SOURCES
            </button>
          )}
        </div>

        {showSources && seg && (
          <div className="sources" role="dialog" aria-label="Sources for this segment">
            <ul>
              {seg.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.outlet}
                    {' '}
                    <PixelIcon name="out" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="scanlines" aria-hidden="true" />

        <div className="ticker">
          <span className="ticker-ch">{channel.name}</span>
          <div className="ticker-track">
            <div className="ticker-run">
              <span>{ticker}</span>
              <span aria-hidden="true">{ticker}</span>
            </div>
          </div>
        </div>

        {seg && (!unlocked || np.blocked) && (
          <button
            type="button"
            className="power-on"
            onClick={() => {
              onUnlock();
              player.unlock();
            }}
          >
            <PixelIcon name="play" />
            SWITCH ON
          </button>
        )}
      </div>
    </main>
  );
}
