import { useEffect, useState } from 'preact/hooks';
import { type Board, fetchBoard } from './api';

/** A channel's studio board, refreshed every ten minutes. */
export function useBoard(channelId: string | null): Board | null {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    if (!channelId) return undefined;
    let alive = true;
    const load = () => fetchBoard(channelId)
      .then((b) => alive && setBoard(b))
      .catch(() => {});
    setBoard(null);
    load();
    const timer = setInterval(load, 10 * 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [channelId]);
  return board;
}
