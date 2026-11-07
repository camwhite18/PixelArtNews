import { useEffect, useState } from 'preact/hooks';
import { type Channel, serverNow } from '../api';
import { Studio } from '../components/Studio';
import { href, navigate } from '../router';
import {
  clockTime, onAir, segmentLabel, startMs, upNext,
} from '../rundown';
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
    <a
      className="card"
      href={href(`/ch/${channel.id}`)}
      onClick={open}
      style={{ '--accent': channel.accent }}
    >
      <div className="card-head">
        <h2>{channel.name}</h2>
        <span className="muted pixel-sm">
          {`CH ${index + 1}`}
        </span>
      </div>
      <div className="card-frame">
        <Studio
          scene={channel.scene}
          presenters={channel.presenters.length}
          label={`${channel.name} studio`}
        />
        {air && (
          <>
            <span className="badge-live card-live">
              <span className="dot" aria-hidden="true" />
              LIVE
            </span>
            <div className="card-lower">
              <span className="kicker">{air.segment.kicker || segmentLabel(air.segment)}</span>
              {air.segment.headline && <span className="headline">{air.segment.headline}</span>}
            </div>
            {air.segment.ticker && <div className="card-ticker">{air.segment.ticker}</div>}
          </>
        )}
      </div>
      <div className="card-meta">
        {air ? (
          <div>
            <span className="accent">Now</span>
            {' '}
            {segmentLabel(air.segment)}
          </div>
        ) : (
          <div className="muted">Off air — first broadcast coming up</div>
        )}
        {hosts && <div className="muted">{`with ${hosts}`}</div>}
        {next && (
          <div className="muted">
            Next
            {' '}
            {clockTime(startMs(next))}
            {' '}
            {segmentLabel(next)}
          </div>
        )}
      </div>
    </a>
  );
}

export function Home({ channels, error }: { channels: Channel[]; error: string | null }) {
  const now = useClock();
  return (
    <main className="home">
      <header className="home-head">
        <div>
          <div className="logo">
            <span className="logo-mark" aria-hidden="true" />
            <h1>PIXEL NEWS</h1>
          </div>
          <p className="muted">24/7 AI news channels. Pick a channel to tune in.</p>
        </div>
        <div className="home-status">
          <span className="badge-live">
            <span className="dot" aria-hidden="true" />
            ON AIR
          </span>
          <span>{clockTime(now)}</span>
        </div>
      </header>

      {error && (
      <p className="error">
        {`Couldn't load channels: ${error}`}
      </p>
      )}

      <div className="grid">
        {channels.map((c, i) => (
          <ChannelCard key={c.id} channel={c} index={i} now={now} />
        ))}
      </div>

      <p className="muted disclaimer">
        Headlines are AI-generated summaries of reporting from the linked outlets.
        Pixel News is not a news organisation.
      </p>
    </main>
  );
}
