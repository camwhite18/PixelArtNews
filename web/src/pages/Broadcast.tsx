import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Channel, serverNow } from '../api';
import { Studio } from '../components/Studio';
import { type NowPlaying, Player } from '../player';
import { navigate } from '../router';
import { clockTime, segmentLabel, startMs, upNext } from '../rundown';
import { useRundown } from '../useRundown';

interface Props {
  channels: Channel[];
  channelId: string;
  /** True when a click on this page load already allowed audio. */
  unlocked: boolean;
  onUnlock: () => void;
}

export function Broadcast({ channels, channelId, unlocked, onUnlock }: Props) {
  const index = channels.findIndex((c) => c.id === channelId);
  const channel = channels[index] ?? null;
  const rundown = useRundown(channelId);
  const [np, setNp] = useState<NowPlaying>({ segment: null, speaker: null, blocked: false });
  const [showSources, setShowSources] = useState(false);
  const [staticUntil, setStaticUntil] = useState(0);
  const [now, setNow] = useState(serverNow());
  const touchY = useRef<number | null>(null);

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
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!channel) {
    return (
      <main class="stage-wrap">
        <p class="error">
          Unknown channel. <a href="/">Back to the guide</a>
        </p>
      </main>
    );
  }

  const seg = np.segment;
  const next = upNext(rundown, now);
  const talking = seg ? channel.presenters.findIndex((p) => p.id === np.speaker) : null;
  const hosts = channel.presenters.map((p) => p.name).join(' & ');

  return (
    <main
      class="stage-wrap"
      style={{ '--accent': channel.accent }}
      onTouchStart={(e) => {
        touchY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchY.current === null) return;
        const dy = e.changedTouches[0].clientY - touchY.current;
        touchY.current = null;
        if (Math.abs(dy) > 60) zap(dy < 0 ? 1 : -1);
      }}
    >
      <div class="stage">
        <Studio
          scene={seg ? channel.scene : null}
          presenters={channel.presenters.length}
          talking={talking === null || talking < 0 ? null : talking}
          level={() => player.level()}
          staticUntil={staticUntil}
          label={`${channel.name} studio`}
        />

        <div class="bug">
          <span class="bug-net">PXN</span>
          <span class="bug-ch">{channel.name}</span>
        </div>

        <div class="top-right">
          <div class="row">
            {seg && (
              <span class="badge-live">
                <span class="dot" aria-hidden="true" />
                LIVE
              </span>
            )}
            <span class="clock">{clockTime(now)}</span>
          </div>
          {next && (
            <span class="next">
              NEXT {clockTime(startMs(next))} · {segmentLabel(next).toUpperCase()}
            </span>
          )}
        </div>

        {seg ? (
          <div class="lower-third">
            <div class="lt-tabs">
              <span class="kicker">{seg.kicker || segmentLabel(seg).toUpperCase()}</span>
              <span class="hosts">{hosts}</span>
            </div>
            {seg.headline && <div class="lt-headline">{seg.headline}</div>}
          </div>
        ) : (
          <div class="lower-third">
            <div class="lt-headline">Off air — the first broadcast is being prepared.</div>
          </div>
        )}

        <div class="controls">
          <a
            class="ctl"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            ◂ GUIDE
          </a>
          <button type="button" class="ctl" aria-label="Channel up" onClick={() => zap(-1)}>
            CH ▲
          </button>
          <button type="button" class="ctl" aria-label="Channel down" onClick={() => zap(1)}>
            CH ▼
          </button>
          {seg && seg.sources.length > 0 && (
            <button
              type="button"
              class="ctl"
              aria-expanded={showSources}
              onClick={() => setShowSources(!showSources)}
            >
              SOURCES
            </button>
          )}
        </div>

        {showSources && seg && (
          <div class="sources" role="dialog" aria-label="Sources for this segment">
            <ul>
              {seg.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.outlet} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div class="ticker">
          <span class="ticker-ch">{channel.name}</span>
          <div class="ticker-track">
            <div class="ticker-run">
              <span>{seg?.ticker || 'Pixel Art News · 24/7 AI news channels'}</span>
              <span aria-hidden="true">{seg?.ticker || 'Pixel Art News · 24/7 AI news channels'}</span>
            </div>
          </div>
        </div>

        {seg && (!unlocked || np.blocked) && (
          <button
            type="button"
            class="power-on"
            onClick={() => {
              onUnlock();
              player.unlock();
            }}
          >
            ▶ SWITCH ON
          </button>
        )}
      </div>
    </main>
  );
}
