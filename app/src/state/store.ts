/* Application state: one external store (useSyncExternalStore), persisted slices in localStorage
   under the same key and shape as the reference app ({assume, scenarios, compare}). */
import { useSyncExternalStore } from 'react';
import type { CuData, ImportedBook } from '../data/types';
import type { DataSource } from '../data/load';
import { buildModel, type Model } from '../engine/model';
import { DEFAULT_ASSUME, DEFAULT_FILTERS, type Assumptions, type BandBasis, type EngineSettings, type Filters, type Metric } from '../engine/settings';

import type { Scenario } from '../engine/scenarios';
export type { Scenario, ScenarioOp } from '../engine/scenarios';
export interface AuditEntry { t: string; msg: string }

export interface UwForm { name?: string; pos: string; acq: string; role: string; ask: number; months: number; start: string; elig: string; third: number; replacing: string; basis: string }
export interface DealForm { pos: string; total: number; start: string; months: number; fall: number; inc: number; buyout: number; pays: number[] | null }
export interface OfferForm { pos: string; ask: number; months: number }

export interface AppState {
  data: CuData | null; source: DataSource | null; sourceLabel: string; loadError: string | null;
  threshold: number; metric: Metric; minN: number; lowN: number; band: BandBasis; includeEarly: boolean;
  fy: 2025 | 2026; rail: boolean; sidebarMin: boolean;
  filters: Filters; assume: Assumptions;
  scenarios: Scenario[]; scIdx: number; compare: string[]; imported: ImportedBook | null; audit: AuditEntry[];
  uw: UwForm; deal: DealForm; offer: OfferForm; wi: { pct: number; add: number };
  trace: { label: string; items: TraceItem[] } | null;
}
export interface TraceItem { pid: string; eid: string | null; amount: number; src?: string; pos?: string }

const STORAGE_KEY = 'cu-bsm-state';
const initial: AppState = {
  data: null, source: null, sourceLabel: '', loadError: null,
  threshold: 10000, metric: 'fy', minN: 3, lowN: 5, band: 'pooled', includeEarly: false,
  fy: 2026, rail: true, sidebarMin: false,
  filters: { ...DEFAULT_FILTERS }, assume: { ...DEFAULT_ASSUME },
  scenarios: [{ name: 'BASE', ops: [] }], scIdx: 0, compare: [], imported: null, audit: [],
  uw: { pos: 'OL', acq: 'PORTAL', role: 'STARTER', ask: 300000, months: 12, start: '2027-01', elig: '2', third: 0, replacing: '', basis: 'pooled' },
  deal: { pos: 'WR', total: 400000, start: '2026-07', months: 12, fall: 50, inc: 0, buyout: 0, pays: null },
  offer: { pos: 'DL', ask: 600000, months: 12 }, wi: { pct: -10, add: 0 }, trace: null,
};

let state: AppState = restore(initial);
const listeners = new Set<() => void>();

function restore(s: AppState): AppState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) return { ...s, assume: { ...s.assume, ...(saved.assume || {}) }, scenarios: saved.scenarios?.length ? saved.scenarios : s.scenarios, compare: saved.compare || s.compare };
  } catch { /* storage unavailable */ }
  return s;
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ assume: state.assume, scenarios: state.scenarios, compare: state.compare })); } catch { /* ignore */ }
}

export const store = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>), opts: { persist?: boolean } = {}) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    if (opts.persist) persist();
    listeners.forEach((l) => l());
  },
};

export function logAudit(msg: string) {
  store.set((s) => ({ audit: [{ t: new Date().toISOString().replace('T', ' ').slice(0, 19), msg }, ...s.audit] }));
}

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()));
}

/* ---- engine settings and memoised model */
export function engineSettings(s: AppState): EngineSettings {
  return { threshold: s.threshold, metric: s.metric, minN: s.minN, lowN: s.lowN, band: s.band, includeEarly: s.includeEarly, view: s.filters.view, assume: s.assume };
}
let cache: { key: unknown[]; model: Model } | null = null;
export function getModel(s: AppState = state): Model | null {
  if (!s.data) return null;
  const es = engineSettings(s);
  const key = [s.data, s.imported, es.threshold, es.metric, es.minN, es.lowN, es.band, es.includeEarly, es.view, s.assume];
  if (!cache || cache.key.length !== key.length || cache.key.some((k, i) => k !== key[i])) cache = { key, model: buildModel(s.data, es, s.imported) };
  return cache.model;
}
export function useModel(): Model {
  const m = useStore((s) => getModel(s));
  if (!m) throw new Error('Model not ready');
  return m;
}

/** Setting by path, matching the reference `setPath` coercion ('f.' filters, 'a.' assumptions). */
export function setPath(path: string, raw: string) {
  const ks = path.split('.'); const k = ks[ks.length - 1];
  store.set((s) => {
    const target = ks[0] === 'f' ? { ...s.filters } : ks[0] === 'a' ? { ...s.assume } : null;
    const cur = (target ?? (s as unknown as Record<string, unknown>))[k as never];
    let val: unknown = raw;
    if (raw === 'true' || raw === 'false') val = raw === 'true';
    else if (raw === '') val = null;
    else if (typeof cur === 'number' || /^-?\d+(\.\d+)?$/.test(raw)) val = +raw;
    if (target) { (target as Record<string, unknown>)[k] = val; return ks[0] === 'f' ? { filters: target as Filters } : { assume: target as Assumptions }; }
    return { [k]: val } as Partial<AppState>;
  }, { persist: ks[0] === 'a' });
  logAudit(`Set ${path} = ${raw}`);
}
