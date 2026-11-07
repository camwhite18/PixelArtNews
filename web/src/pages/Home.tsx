import { useEffect, useState } from 'preact/hooks';
import { type Channel, serverNow } from '../api';
import { Studio } from '../components/Studio';
import { navigate } from '../router';
import { clockTime, onAir, segmentLabel, startMs, upNext } from '../rundown';
import { useRundown } from '../useRundown';

function useClock() {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ChannelCard({ channel, index, now }: { channel: Channel; index: number; now: number }) {
  const rundown = useRundown(channel.id);
  const air = onAir(rundown, now);
  const next = upNext(rundown, now);
  const hosts = channel.presenters.map((p) => p.name).join(' & ');

  const open = (e: MouseEvent) => {
    e.preventDefault();
    navigate(`/ch/${channel.id}`);
  };

  return (
    <a class="card" href={`/ch/${channel.id}`} onClick={open} style={{ '--accent': channel.accent }}>
      <div class="card-head">
        <h2>{channel.name}</h2>
        <span class="muted pixel-sm">CH {index + 1}</span>
      </div>
      <div class="card-frame">
        <Studio
          scene={channel.scene}
          presenters={channel.presenters.length}
          label={`${channel.name} studio`}
        />
        {air && (
          <>
            <span class="badge-live card-live">
              <span class="dot" aria-hidden="true" />
              LIVE
            </span>
            <div class="card-lower">
              <span class="kicker">{air.segment.kicker || segmentLabel(air.segment)}</span>
              {air.segment.headline && <span class="headline">{air.segment.headline}</span>}
            </div>
            {air.segment.ticker && <div class="card-ticker">{air.segment.ticker}</div>}
          </>
        )}
      </div>
      <div class="card-meta">
        {air ? (
          <div>
            <span class="accent">Now</span> {segmentLabel(air.segment)}
          </div>
        ) : (
          <div class="muted">Off air — first broadcast coming up</div>
        )}
        {hosts && <div class="muted">with {hosts}</div>}
        {next && (
          <div class="muted">
            Next {clockTime(startMs(next))} {segmentLabel(next)}
          </div>
        )}
      </div>
    </a>
  );
}

export function Home({ channels, error }: { channels: Channel[]; error: string | null }) {
  const now = useClock();
  return (
    <main class="home">
      <header class="home-head">
        <div>
          <div class="logo">
            <span class="logo-mark" aria-hidden="true" />
            <h1>PIXEL NEWS</h1>
          </div>
          <p class="muted">24/7 AI news channels. Pick a channel to tune in.</p>
        </div>
        <div class="home-status">
          <span class="badge-live">
            <span class="dot" aria-hidden="true" />
            ON AIR
          </span>
          <span>{clockTime(now)}</span>
        </div>
      </header>

      {error && <p class="error">Couldn't load channels: {error}</p>}

      <div class="grid">
        {channels.map((c, i) => (
          <ChannelCard key={c.id} channel={c} index={i} now={now} />
        ))}
      </div>

      <p class="muted disclaimer">
        Headlines are AI-generated summaries of reporting from the linked outlets. Pixel News is not a news
        organisation.
      </p>
    </main>
  );
}
