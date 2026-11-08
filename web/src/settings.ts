import { useEffect, useState } from 'preact/hooks';

// Per-viewer on/off settings (subtitles, TV mode), remembered in this
// browser when storage is available and in memory otherwise.
const EVENT = 'pxn-setting';
const memory = new Map<string, boolean>();

export function readSetting(key: string, fallback = false): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v === 'on';
  } catch {
    // Storage blocked: fall through to memory.
  }
  return memory.get(key) ?? fallback;
}

export function writeSetting(key: string, on: boolean) {
  memory.set(key, on);
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // Not remembered across visits; still applies now.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** A setting shared by every component that uses the same key. */
export function useSetting(key: string, fallback = false): [boolean, (on: boolean) => void] {
  const [value, setValue] = useState(() => readSetting(key, fallback));
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(readSetting(key, fallback));
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [key, fallback]);
  return [value, (v: boolean) => writeSetting(key, v)];
}
