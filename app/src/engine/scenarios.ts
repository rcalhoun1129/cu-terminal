/* Scenario manager (reference scenarioBase / applyScenario / scMetrics). Pure functions of the model. */
import type { Model } from './model';
import { mean, median, sum } from './util';

export interface ScenarioOp { t: 'remove' | 'set' | 'add' | 'scale'; pid?: string; g?: string; cap?: number; pct?: number; name?: string }
export interface Scenario { name: string; ops: ScenarioOp[] }
export interface ScRow { pid: string; g: string; cap: number; hypo?: boolean }

export const scenarioBase = (M: Model): ScRow[] => M.holdings(2026).filter((h) => h.capital > 0).map((h) => ({ pid: h.pid, g: h.bs, cap: h.capital }));

export function applyScenario(M: Model, sc: Scenario): ScRow[] {
  let rows = scenarioBase(M);
  (sc.ops || []).forEach((op) => {
    if (op.t === 'remove') rows = rows.filter((r) => r.pid !== op.pid);
    else if (op.t === 'set') rows = rows.map((r) => (r.pid === op.pid ? { ...r, cap: op.cap! } : r));
    else if (op.t === 'add') rows.push({ pid: op.name || 'New ' + op.g, g: op.g!, cap: op.cap!, hypo: true });
    else if (op.t === 'scale') rows = rows.map((r) => (r.g === op.g ? { ...r, cap: r.cap * (1 + op.pct! / 100) } : r));
  });
  return rows;
}

export const SC_ALLOC = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB', 'CB', 'S'];
export function scMetrics(M: Model, rows: ScRow[]) {
  const tot = sum(rows.map((r) => r.cap)) + sum(M.buyouts.filter((b) => b.capsBy['FY26-27']).map((b) => b.capsBy['FY26-27']));
  const s = [...rows].sort((a, b) => b.cap - a.cap); const paid = rows.filter((r) => r.cap >= M.settings.threshold);
  const mat = new Map(M.A.maturity.rows.map((r) => [r.h.pid, r]));
  const all = sum(rows.map((r) => r.cap));
  return {
    tot, avail: M.caps[2026] - tot, paid: paid.length, avg: mean(paid.map((r) => r.cap)), med: median(paid.map((r) => r.cap)), top5: sum(s.slice(0, 5).map((r) => r.cap)) / all,
    mat: sum(rows.filter((r) => { const m = mat.get(r.pid); return !!m && (m.final as string) <= '2026-12'; }).map((r) => r.cap)),
    ret: sum(rows.filter((r) => !r.hypo && M.players.get(r.pid)?.seasons['2025'].onRoster).map((r) => r.cap)) / all,
    fut: M.fy2728, alloc: Object.fromEntries(SC_ALLOC.map((g) => [g, sum(rows.filter((r) => r.g === g).map((r) => r.cap))])) as Record<string, number>,
  };
}
