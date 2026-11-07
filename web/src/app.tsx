import { useEffect, useState } from 'preact/hooks';
import { type Channel, fetchChannels, syncClock } from './api';
import { Broadcast } from './pages/Broadcast';
import { Home } from './pages/Home';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Any click on the page counts as the gesture browsers need before audio.
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    void syncClock();
    fetchChannels()
      .then(setChannels)
      .catch((e: Error) => setError(e.message));
    const unlock = () => setUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  if (route.page === 'channel') {
    return (
      <Broadcast
        channels={channels}
        channelId={route.id}
        unlocked={unlocked}
        onUnlock={() => setUnlocked(true)}
      />
    );
  }
  return <Home channels={channels} error={error} />;
}
