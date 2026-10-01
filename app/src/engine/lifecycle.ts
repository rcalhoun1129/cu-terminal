import { SEASONS } from './constants';
import type { Model } from './model';

export interface KM { n12: number; s12: number; n24: number; s24: number; half: string; n24base: number }
export interface Life {
  cohorts: Record<number, string[]>;
  presence: Map<string, number[]>;
  /** Season-grain Kaplan–Meier: S12 pooled over the 2024 + 2025 cohorts; S24 = S12 × conditional survival of the 2024 cohort. */
  km: (filter?: (pid: string) => boolean, capital?: boolean) => KM;
}

export function lifecycle(M: Model): Life {
  const cohorts: Record<number, string[]> = {};
  const presence = new Map([...M.players.values()].map((p) => [p.id, SEASONS.filter((s) => p.seasons[String(s) as '2024'].onRoster) as number[]]));
  for (const s of [2024, 2025, 2026]) {
    cohorts[s] = [...M.players.values()].filter((p) => { const r = p.seasons[String(s) as '2024']; return r.onRoster && r.acq !== 'RETAINED'; }).map((p) => p.id);
  }
  const km = (filter: (pid: string) => boolean = () => true, capital = false): KM => {
    const alive = (pid: string, s: number) => capital
      ? (((M.h[s] && M.h[s].get(pid)) || ({} as { capital?: number })).capital || 0) >= M.settings.threshold
      : M.players.get(pid)!.seasons[String(s) as '2024'].onRoster;
    const c24 = cohorts[2024].filter(filter).filter((pid) => !capital || alive(pid, 2024));
    const c25 = cohorts[2025].filter(filter).filter((pid) => !capital || alive(pid, 2025));
    const at12 = c24.length + c25.length, surv12 = c24.filter((p) => alive(p, 2025)).length + c25.filter((p) => alive(p, 2026)).length;
    const r24 = c24.filter((p) => alive(p, 2025)), surv24 = r24.filter((p) => alive(p, 2026)).length;
    const S12 = at12 ? surv12 / at12 : NaN, S24 = r24.length && at12 ? S12 * (surv24 / r24.length) : NaN;
    let half = '—';
    if (isFinite(S12) && S12 < 0.5) half = '≤ 12 mo'; else if (isFinite(S24) && S24 < 0.5) half = '12–24 mo'; else if (isFinite(S24)) half = '> 24 mo'; else if (isFinite(S12)) half = '> 12 mo (24M not observable)';
    return { n12: at12, s12: S12, n24: r24.length, s24: S24, half, n24base: c24.length };
  };
  return { cohorts, presence, km };
}
