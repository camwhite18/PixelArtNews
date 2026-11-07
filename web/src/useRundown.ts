import { useEffect, useState } from 'preact/hooks';
import { fetchRundown, onRundownPublished, serverNow } from './api';
import { type Rundown, runningLow } from './rundown';

/** Keeps a channel's rundown fresh: on publish events, and when it runs low. */
export function useRundown(channelId: string | null): Rundown | null {
  const [rundown, setRundown] = useState<Rundown | null>(null);

  useEffect(() => {
    if (!channelId) return;
    let alive = true;
    let current: Rundown | null = null;
    const load = () =>
      fetchRundown(channelId)
        .then((r) => {
          if (alive) {
            current = r;
            setRundown(r);
          }
        })
        .catch(() => {});

    setRundown(null);
    load();
    const off = onRundownPublished((id) => id === channelId && load());
    const timer = setInterval(() => {
      if (runningLow(current, serverNow(), 10 * 60_000)) load();
    }, 60_000);
    return () => {
      alive = false;
      off();
      clearInterval(timer);
    };
  }, [channelId]);

  return rundown;
}
