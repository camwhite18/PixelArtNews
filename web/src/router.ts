import { useEffect, useState } from 'preact/hooks';

export type Route = { page: 'home' } | { page: 'channel'; id: string };

export function parse(path: string): Route {
  const m = path.match(/^\/ch\/([a-z0-9-]+)\/?$/);
  return m ? { page: 'channel', id: m[1] } : { page: 'home' };
}

// The demo build is served as static files from an arbitrary path, so it
// routes on the URL hash instead: #tech for /ch/tech, no hash for the guide.
// Plain names, because some hosts (claude.ai artifacts) only keep those.
const HASH_ROUTES = import.meta.env.VITE_DEMO === '1';

const toHash = (path: string) => {
  const route = parse(path);
  return route.page === 'channel' ? `#${route.id}` : '#';
};
const fromHash = (hash: string) => (hash.length > 1 ? `/ch/${hash.slice(1)}` : '/');

const currentPath = () => (
  HASH_ROUTES ? fromHash(window.location.hash) : window.location.pathname
);

/** The link target for an app path. */
export const href = (path: string) => (HASH_ROUTES ? toHash(path) : path);

/** Navigates without a page load, so the click that unlocked audio still counts. */
export function navigate(path: string) {
  if (path === currentPath()) return;
  if (HASH_ROUTES) {
    window.location.hash = toHash(path); // fires hashchange
    return;
  }
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(currentPath()));
  useEffect(() => {
    const event = HASH_ROUTES ? 'hashchange' : 'popstate';
    const on = () => setRoute(parse(currentPath()));
    window.addEventListener(event, on);
    return () => window.removeEventListener(event, on);
  }, []);
  return route;
}
