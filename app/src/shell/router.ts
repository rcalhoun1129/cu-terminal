import { useSyncExternalStore } from 'react';

const sub = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
/** Current hash route, decoded, without the leading '#/'. Default 'home'. */
export function useHash(): string {
  return useSyncExternalStore(sub, () => { try { return decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'home'; } catch { return location.hash.replace(/^#\/?/, '') || 'home'; } });
}
export const go = (route: string) => { location.hash = route; };
