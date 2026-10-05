/* Roster Capital OS state: the live operating book, an undo stack and a change log.
   Every edit replaces the book immutably, so the engine recomputes every dependent view —
   the equivalent of the workbook's cross-sheet formulas. Persisted to this browser only. */
import { useSyncExternalStore } from 'react';
import { computeOs, type OsModel } from './engine';
import { sampleBook } from './sample';
import { EMPTY_UW, type OsAssumptions, type OsBook, type OsInputs, type PortalRow, type PositionRow, type RosterRec, type ScenarioRow, type TriggerRow } from './types';

export interface OsLog { t: string; msg: string }
export interface OsState { book: OsBook; undo: { book: OsBook; msg: string }[]; log: OsLog[]; savedAt: string | null; persistError: string | null }

const KEY = 'cu-os-book';
export const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function restore(): OsState {
  const fresh: OsState = { book: sampleBook(), undo: [], log: [], savedAt: null, persistError: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.book?.roster && saved.book.inputs && saved.book.assume) return { ...fresh, book: { ...saved.book, meta: { ...saved.book.meta, asOf: today() } }, log: saved.log || [], savedAt: saved.savedAt || null };
  } catch { /* unavailable or corrupt — start from the sample */ }
  return { ...fresh, book: { ...fresh.book, meta: { ...fresh.book.meta, asOf: today() } } };
}

let state: OsState = restore();
const subs = new Set<() => void>();
function emit() { for (const f of subs) f(); }
function persist() {
  try { const savedAt = stamp(); localStorage.setItem(KEY, JSON.stringify({ book: state.book, log: state.log.slice(0, 500), savedAt })); state = { ...state, savedAt, persistError: null }; }
  catch (e) { state = { ...state, persistError: (e as Error).message }; }
}

export const os = {
  get: () => state,
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  /** Apply a change to the book, log it, keep an undo point and persist. */
  commit(msg: string, fn: (b: OsBook) => OsBook) {
    const next = fn(state.book); if (next === state.book) return;
    state = { ...state, book: next, undo: [{ book: state.book, msg }, ...state.undo].slice(0, 50), log: [{ t: stamp(), msg }, ...state.log] };
    persist(); emit();
  },
  undo() {
    const [u, ...rest] = state.undo; if (!u) return;
    state = { ...state, book: u.book, undo: rest, log: [{ t: stamp(), msg: 'Undo: ' + u.msg }, ...state.log] }; persist(); emit();
  },
  load(book: OsBook, msg: string) {
    state = { ...state, book: { ...book, meta: { ...book.meta, asOf: today() } }, undo: [{ book: state.book, msg }, ...state.undo].slice(0, 50), log: [{ t: stamp(), msg }, ...state.log] }; persist(); emit();
  },
  /** Forget everything stored in this browser and return to the synthetic sample. */
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    state = { book: { ...sampleBook(), meta: { ...sampleBook().meta, asOf: today() } }, undo: [], log: [{ t: stamp(), msg: 'Local data cleared — sample book loaded' }], savedAt: null, persistError: null }; emit();
  },
  /** Test hook: replace state without persisting. */
  _reset(book: OsBook) { state = { book, undo: [], log: [], savedAt: null, persistError: null }; emit(); },
};

export function useOs<T>(sel: (s: OsState) => T): T { return useSyncExternalStore(os.subscribe, () => sel(state), () => sel(state)); }
let memo: { book: OsBook; m: OsModel } | null = null;
export function osModel(): OsModel { if (!memo || memo.book !== state.book) memo = { book: state.book, m: computeOs(state.book) }; return memo.m; }
export function useOsModel(): OsModel { useOs((s) => s.book); return osModel(); }

/* ------------------------------------------------------------------ actions */
const fmtV = (v: unknown) => (v == null || v === '' ? '∅' : String(v));
const nextId = (prefix: string, ids: string[]) => prefix + (Math.max(0, ...ids.map((x) => +x.replace(/\D/g, '') || 0)) + 1);

export function updateRecord(id: string, patch: Partial<RosterRec>, why?: string) {
  const r = state.book.roster.find((x) => x.id === id); if (!r) return;
  const changed = (Object.keys(patch) as (keyof RosterRec)[]).filter((k) => JSON.stringify(r[k]) !== JSON.stringify(patch[k]));
  if (!changed.length) return;
  const msg = why ?? `${r.athlete || id}: ${changed.map((k) => `${k} ${fmtV(r[k])} → ${fmtV(patch[k])}`).join(', ')}`;
  os.commit(msg, (b) => ({ ...b, roster: b.roster.map((x) => (x.id === id ? { ...x, ...patch, updated: today() } : x)) }));
}
export function addRecord(athlete: string, pos = ''): string {
  const id = nextId('R', state.book.roster.map((r) => r.id));
  const rec: RosterRec = { id, athlete, pos, status: 'Current', elig: null, cert: '', rosterState: 'Current', functionalRole: 'TBD', depthRole: 'TBD', caps2627: 0, caps2728: 0, acqBasis: null, mark: null,
    low2027: null, high2027: null, bsmClass: 'Developmental / Optionality', call: 'Scout', decision: 'Observing', confidence: 'Low', agent: '', nextDate: '', trigger: '', replLow: null, replHigh: null,
    retentionRisk: 'Medium', portalRisk: 'Medium', notes: '', owner: '', updated: today(), uw: { ...EMPTY_UW } };
  os.commit(`Added master record ${athlete}`, (b) => ({ ...b, roster: [...b.roster, rec] }));
  return id;
}
export function deleteRecord(id: string) {
  const r = state.book.roster.find((x) => x.id === id); if (!r) return;
  os.commit(`Deleted master record ${r.athlete}`, (b) => ({ ...b, roster: b.roster.filter((x) => x.id !== id) }));
}
export function setAssume<K extends keyof OsAssumptions>(k: K, v: OsAssumptions[K]) {
  if (state.book.assume[k] === v) return;
  os.commit(`Assumption ${k}: ${fmtV(state.book.assume[k])} → ${fmtV(v)}`, (b) => ({ ...b, assume: { ...b.assume, [k]: v } }));
}
export function setInput<K extends keyof OsInputs>(k: K, v: OsInputs[K]) {
  if (state.book.inputs[k] === v) return;
  os.commit(`Input ${k}: ${fmtV(state.book.inputs[k])} → ${fmtV(v)}`, (b) => {
    const inputs = { ...b.inputs, [k]: v };
    // the class obligation is one number across Forecast, Capital Books, Control Center and the scenarios
    const scenarios = k === 'classObligation2728' ? b.scenarios.map((s) => (s.classObligation === b.inputs.classObligation2728 ? { ...s, classObligation: v as number } : s)) : b.scenarios;
    return { ...b, inputs, scenarios };
  });
}
export function updatePosition(i: number, patch: Partial<PositionRow>) {
  const p = state.book.positions[i]; if (!p) return;
  const ks = (Object.keys(patch) as (keyof PositionRow)[]).filter((k) => p[k] !== patch[k]); if (!ks.length) return;
  os.commit(`${p.group}: ${ks.map((k) => `${k} ${fmtV(p[k])} → ${fmtV(patch[k])}`).join(', ')}`, (b) => ({ ...b, positions: b.positions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
}
export function resetPositions() {
  os.commit('Position Inventory live columns reset to baseline', (b) => ({ ...b, positions: b.positions.map((p) => ({ ...p, current: p.baseCurrent, need: p.baseNeed, targets: p.baseTargets, capital: p.baseCapital })) }));
}
export function upsertPortal(row: PortalRow | Omit<PortalRow, 'id'>) {
  if ('id' in row && row.id) {
    os.commit(`Portal Board ${row.priority} ${row.pos} updated`, (b) => ({ ...b, portal: b.portal.map((x) => (x.id === row.id ? row as PortalRow : x)) }));
  } else {
    const id = nextId('PB', state.book.portal.map((p) => p.id));
    os.commit(`Portal target added: ${row.priority} ${row.pos} ×${row.bodies ?? 0}`, (b) => ({ ...b, portal: [...b.portal, { ...row, id }] }));
  }
}
export function deletePortal(id: string) {
  const p = state.book.portal.find((x) => x.id === id); if (!p) return;
  os.commit(`Portal target removed: ${p.priority} ${p.pos}`, (b) => ({ ...b, portal: b.portal.filter((x) => x.id !== id) }));
}
export function updateScenario(i: number, patch: Partial<ScenarioRow>) {
  os.commit(`Scenario ${state.book.scenarios[i]?.name}: ${Object.entries(patch).map(([k, v]) => `${k} → ${fmtV(v)}`).join(', ')}`, (b) => ({ ...b, scenarios: b.scenarios.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
}

/** Log a trigger event. With `apply`, it re-underwrites the master record in the same step:
    the new call and trigger flag are written and the decision moves to Under Review. */
export function logTrigger(t: Omit<TriggerRow, 'id' | 'applied'>, apply: boolean) {
  const id = nextId('T', state.book.triggers.map((x) => x.id));
  const rec = t.rosterId ? state.book.roster.find((r) => r.id === t.rosterId) : undefined;
  os.commit(`Trigger logged: ${t.type} · ${t.subject}${apply && rec ? ` → ${rec.call} ⇒ ${t.newCall || rec.call}` : ''}`, (b) => ({
    ...b, triggers: [{ ...t, id, priorCall: t.priorCall || rec?.call || '', applied: apply && !!rec }, ...b.triggers],
    roster: apply && rec ? b.roster.map((r) => (r.id === rec.id ? { ...r, call: t.newCall || r.call, trigger: t.type, decision: r.decision === 'Observing' ? 'Under Review' : r.decision, updated: today() } : r)) : b.roster,
  }));
}
export function applyTrigger(id: string) {
  const t = state.book.triggers.find((x) => x.id === id); const rec = t?.rosterId ? state.book.roster.find((r) => r.id === t.rosterId) : undefined;
  if (!t || !rec || t.applied) return;
  os.commit(`Trigger applied to master: ${rec.athlete} ${rec.call} ⇒ ${t.newCall || rec.call}`, (b) => ({
    ...b, triggers: b.triggers.map((x) => (x.id === id ? { ...x, applied: true, priorCall: x.priorCall || rec.call } : x)),
    roster: b.roster.map((r) => (r.id === rec.id ? { ...r, call: t.newCall || r.call, trigger: t.type, decision: r.decision === 'Observing' ? 'Under Review' : r.decision, updated: today() } : r)),
  }));
}
export function setTriggerStatus(id: string, status: string) {
  const t = state.book.triggers.find((x) => x.id === id); if (!t || t.status === status) return;
  os.commit(`Trigger ${t.type} · ${t.subject}: ${t.status} → ${status}`, (b) => ({
    ...b, triggers: b.triggers.map((x) => (x.id === id ? { ...x, status } : x)),
    // closing the event clears the master trigger flag it raised
    roster: status === 'Closed' && t.rosterId ? b.roster.map((r) => (r.id === t.rosterId && r.trigger === t.type ? { ...r, trigger: '', updated: today() } : r)) : b.roster,
  }));
}
export function deleteTrigger(id: string) {
  const t = state.book.triggers.find((x) => x.id === id); if (!t) return;
  os.commit(`Trigger deleted: ${t.type} · ${t.subject}`, (b) => ({ ...b, triggers: b.triggers.filter((x) => x.id !== id) }));
}
