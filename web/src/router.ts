import { useEffect, useState } from 'preact/hooks';

export type Route = { page: 'home' } | { page: 'channel'; id: string };

export function parse(path: string): Route {
  const m = path.match(/^\/ch\/([a-z0-9-]+)\/?$/);
  return m ? { page: 'channel', id: m[1] } : { page: 'home' };
}

/** Navigates without a page load, so the click that unlocked audio still counts. */
export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.pathname));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.pathname));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return route;
}
