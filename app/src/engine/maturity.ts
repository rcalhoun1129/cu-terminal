import { AS_OF_M } from './constants';
import type { Holding, Model } from './model';
import { sum } from './util';

export interface MaturityRow { h: Holding; final: string | null; remaining: number; paid: number; fy2728: number; sched: Record<string, number>; bucket: string }
export interface WallBucket { b: string; rows: MaturityRow[]; remaining: number; annual: number }
export interface Maturity { rows: MaturityRow[]; wall: WallBucket[]; cash: Record<string, number> }

export const WALL_ORDER = ['MATURED', '30D', '60D', '90D · DEC', 'SPRING', 'JUNE', '12M', '18M', '> 18M'];

export function maturityBucket(k: string | null): string {
  if (!k) return 'NONE'; if (k <= AS_OF_M) return 'MATURED'; if (k === '2026-10') return '30D'; if (k === '2026-11') return '60D'; if (k === '2026-12') return '90D · DEC';
  if (k <= '2027-05') return 'SPRING'; if (k === '2027-06') return 'JUNE'; if (k <= '2027-09') return '12M'; if (k <= '2028-03') return '18M'; return '> 18M';
}

export function maturity(M: Model): Maturity {
  const hs = M.holdings(2026).filter((h) => h.capital > 0);
  const rows: MaturityRow[] = hs.map((h) => {
    const e = h.eps.map((id) => M.epById.get(id)!);
    const all: Record<string, number> = {};
    e.forEach((x) => Object.entries(x.months || {}).forEach(([k, v]) => { if (v > 0) all[k] = (all[k] || 0) + v; }));
    const keys = Object.keys(all).sort(); const final = keys[keys.length - 1] || null;
    const remaining = sum(keys.filter((k) => k > AS_OF_M).map((k) => all[k]));
    const paid = sum(keys.filter((k) => k <= AS_OF_M).map((k) => all[k]));
    const fy2728 = sum(e.map((x) => +(x.capsBy['FY27-28'] || 0)));
    return { h, final, remaining, paid, fy2728, sched: all, bucket: maturityBucket(final) };
  });
  const wall = WALL_ORDER.map((b) => ({ b, rows: rows.filter((r) => r.bucket === b), remaining: sum(rows.filter((r) => r.bucket === b).map((r) => r.remaining)), annual: sum(rows.filter((r) => r.bucket === b).map((r) => r.h.capital)) }));
  // monthly scheduled cash (all institutional)
  const cash: Record<string, number> = {};
  for (const e of M.episodes) {
    if (!['RSLA', 'FCST26', 'IMPORT26', 'BUYOUT'].includes(e.kind)) continue;
    for (const [k, v] of Object.entries(e.months || {})) { if (e.kind === 'RSLA' && k >= '2026-07') continue; if (v > 0) cash[k] = (cash[k] || 0) + v; }
  }
  return { rows, wall, cash };
}
