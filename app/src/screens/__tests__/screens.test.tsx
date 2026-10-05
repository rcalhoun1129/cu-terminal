// @vitest-environment jsdom
/* Smoke test: every route renders on the synthetic sample dataset without a screen error. */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { generateSample } from '../../data/sample/generate';
import { store } from '../../state/store';
import { NAV } from '../../shell/nav';
import { parseRoute, ROUTES } from '../../shell/routes';
import { ScreenBoundary } from '../../shell/Shell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tabs = ['PRICE', 'CAPITAL', 'TENURE', 'CHURN', 'ACQUISITION', 'RETENTION', 'REPLACEMENT'];
const routes = [...NAV.flatMap((n) => n[2].map((s) => s[1])), ...tabs.map((t) => 'pos/CUQB/' + t), ...tabs.map((t) => 'pos/CUSEC/' + t),
  'room/QB', 'historical/2025/QB', 'maturity/90', 'tape/BUY/2026', 'dq/VERIFIED', 'underwrite/QB', 'retrep/SN', 'concentration/2025', 'search/a', 'unknown-route',
  'osrecord/S001', 'osrecord/missing', 'osroster/blank', 'osroster/inv1', 'osdecisions/overdue', 'osdecisions/hc', 'ostriggers/S002'];

describe('screens render on sample data', () => {
  beforeAll(() => { store.set({ data: generateSample(), source: 'sample', sourceLabel: 'sample' }); });
  const players = () => generateSample().players.slice(0, 2).map((p) => p.id);
  it.each(routes)('%s', (r) => { expectRenders(r); });
  it('player, replace and comps routes', () => { for (const id of players()) for (const p of ['player/', 'replace/', 'icomps/']) expectRenders(p + id); });
});

function expectRenders(h: string) {
  const { name, args } = parseRoute(h); const Screen = ROUTES[name];
  const el = document.createElement('div'); const root = createRoot(el);
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  act(() => { root.render(<ScreenBoundary><Screen args={args} /></ScreenBoundary>); });
  const txt = el.textContent || ''; spy.mockRestore(); act(() => root.unmount());
  expect(txt, h).not.toMatch(/Screen error/);
  expect(txt.length, h).toBeGreaterThan(30);
}
