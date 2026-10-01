/* Engine parity: the TypeScript engine must reproduce the reference engine number-for-number.
   Needs the local, gitignored reference HTML (../reference/cu-buyside-capital-manager.html or $CU_REFERENCE_HTML);
   skipped when absent (e.g. CI on the public repo). */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — untyped Node helper
import { deriveDqNotes, hasReference, readReference, runOriginal } from '../../../scripts/reference-engine.mjs';
import { buildModel } from '../model';
import { DEFAULT_ENGINE, type EngineSettings } from '../settings';
import { GROUPS, SEASONS, TICKERS } from '../constants';
import type { CuData } from '../../data/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const ids = (hs: Any[]) => hs.map((h) => h.pid);
const num = (v: unknown) => (typeof v === 'number' ? (Number.isNaN(v) ? 'NaN' : Number.isFinite(v) ? +v.toPrecision(12) : String(v)) : v);
const clean = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'number' ? num(v) : v instanceof Map ? Object.fromEntries(v) : v)));
const statKeys = ['n', 'total', 'mean', 'median', 'p10', 'p25', 'p40', 'p50', 'p60', 'p75', 'p90', 'max', 'min'];
const pick = (o: Any, ks: string[]) => Object.fromEntries(ks.map((k) => [k, o[k]]));

/** Shape-identical snapshot of either engine. `fx` exposes the band/quote helpers. */
function snapshot(M: Any, fx: { bands: Any; bandOf: Any; quote: Any; bandPool: Any }) {
  const A = M.A;
  const hold = (h: Any) => pick(h, ['pid', 'pos', 'bs', 'acq', 'early', 'inSeason', 'onNext', 'onPrev', 'capital', 'eps', 'monthMap', 'face', 'term', 'conf', 'statusRaw', 'months', 'perMonth', 'm12']);
  const flow = (f: Any) => ({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Array.isArray(v) && k !== 'premList' ? ids(v as Any[]) : v])) });
  return clean({
    committed: M.committed, fy2728: M.fy2728, caps: M.caps,
    holdings: Object.fromEntries(SEASONS.map((s) => [s, [...M.h[s].values()].map(hold)])),
    pMonths: [...M.pMonths.entries()],
    market: Object.fromEntries(TICKERS.map((T) => [T.g, Object.fromEntries(SEASONS.map((s) => { const m = A.market[T.g][s];
      return [s, { ...pick(m, [...statKeys, 'roomCapital', 'roomCount', 'paid', 'paidAll']), obs: m.obs.map((x: Any) => [x.h.pid, x.v]), room: ids(m.room) }]; }))])),
    index: A.index, cubsmi: A.cubsmi,
    life: { cohorts: A.life.cohorts, presence: [...A.life.presence.entries()], km: [A.life.km(), A.life.km(undefined, true)] },
    flow: Object.fromEntries(Object.entries(A.flow).map(([b, F]: Any) => [b, Object.fromEntries(Object.entries(F).map(([g, f]) => [g, flow(f)]))])),
    heat: A.heat,
    conc: Object.fromEntries(SEASONS.map((s) => { const c = A.conc[s]; return [s, { ...c, hs: ids(c.hs), byPos: Object.fromEntries(Object.entries(c.byPos).map(([g, p]: Any) => [g, { ...p, lead: p.lead?.pid ?? null }])) }]; })),
    maturity: { rows: A.maturity.rows.map((r: Any) => ({ ...r, h: r.h.pid })), wall: A.maturity.wall.map((w: Any) => ({ ...w, rows: w.rows.map((r: Any) => r.h.pid) })), cash: A.maturity.cash },
    tape: A.tape, alerts: A.alerts,
    dq: A.dq.map((d: Any) => ({ ...d, detail: String(d.detail).replace(/[A-Z][a-z]+ F26 buyout/, 'F26 buyout') })),
    bands: Object.fromEntries([...GROUPS, 'SEC'].map((g) => { const b = fx.bands(g); return [g, { n: b.n, rows: b.rows, st: pick(b.st, statKeys), q: fx.quote(g), pool: fx.bandPool(g),
      of: [1000, 25000, 100000, 400000, 1200000].map((v) => fx.bandOf(g, v)) }]; })),
  });
}

const CASES: { name: string; s: Partial<EngineSettings> }[] = [
  { name: 'defaults', s: {} },
  { name: 'threshold 25K', s: { threshold: 25000 } },
  { name: '12-month metric', s: { metric: '12m' } },
  { name: 'per-month metric, institutional bands', s: { metric: 'month', band: 'inst' } },
  { name: 'all-paid view, early enrollees', s: { view: 'all', includeEarly: true } },
  { name: 'minN/lowN changed, 2025 bands', s: { minN: 4, lowN: 8, band: '2025' } },
  { name: 'management anchors + thresholds', s: { assume: { bid: 40, target: 50, auth: 75, walk: 90, reserve: 2000000, top5: 20, roomShare: 15, maturityDays: 30, yoyAlert: 5 } } },
];

describe.skipIf(!hasReference())('engine parity with the reference app', () => {
  const ref = hasReference() ? readReference() : null;
  const data = (ref ? { ...ref.data, dqNotes: deriveDqNotes(ref) } : null) as CuData;
  for (const c of CASES) {
    it(c.name, () => {
      const settings: EngineSettings = { ...DEFAULT_ENGINE, ...c.s, assume: { ...DEFAULT_ENGINE.assume, ...(c.s.assume || {}) } };
      const orig = runOriginal(ref, settings);
      const tsM = buildModel(data, settings);
      const a = snapshot(orig.M, orig.fx);
      const b = snapshot(tsM, { bands: (g: string) => tsM.bands(g), bandOf: (g: string, v: number) => tsM.bandOf(g, v), quote: (g: string) => tsM.quote(g), bandPool: (g: string) => tsM.bandPool(g) });
      for (const k of Object.keys(a as object)) expect((b as Any)[k], k).toEqual((a as Any)[k]);
    });
  }
});
