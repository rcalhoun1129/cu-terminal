import { TICKERS } from './constants';
import { inGroup, type Holding, type Model } from './model';
import { sum, median } from './util';

export interface Flow {
  prev: Holding[]; cur: Holding[]; departed: Holding[]; returning: Holding[]; retainedPaid: Holding[]; newAcq: Holding[]; retCur: Holding[];
  playerChurn: number; capitalChurn: number; persistence: number; acqChurn: number;
  prevCap: number; depCap: number; curCap: number; acqCap: number; retCap: number;
  retentionPremium: number; premList: { pid: string; prev: number; cur: number; chg: number }[];
  medRetained: number; medAcq: number; medPortal: number; medHS: number; medJUCO: number; medDeparted: number;
  replRatio: number; replPremium: number; replPremiumPct: number; acqPremium: number;
}

/** Churn / persistence / retention / replacement between consecutive seasons a → b, per group (and ALL). */
export function flows(M: Model, a: number, b: number): Record<string, Flow> {
  const F: Record<string, Flow> = {};
  const T0 = M.settings.threshold;
  const onR = (pid: string, s: number) => M.players.get(pid)!.seasons[String(s) as '2024'].onRoster;
  for (const T of [...TICKERS, { g: 'ALL' }]) {
    const g = T.g;
    const prev = M.holdings(a).filter((h) => inGroup(h, g) && h.capital >= T0 && h.inSeason);
    const cur = M.holdings(b).filter((h) => inGroup(h, g) && h.capital >= T0);
    const departed = prev.filter((h) => !onR(h.pid, b));
    const returning = prev.filter((h) => onR(h.pid, b));
    const retainedPaid = prev.filter((h) => { const n = M.h[b].get(h.pid); return n && n.capital >= T0; });
    const prevCap = sum(prev.map((h) => h.capital)), depCap = sum(departed.map((h) => h.capital));
    const newAcq = cur.filter((h) => !h.onPrev && !onR(h.pid, a));
    const curCap = sum(cur.map((h) => h.capital)), acqCap = sum(newAcq.map((h) => h.capital));
    const retCur = cur.filter((h) => onR(h.pid, a));
    const prem = retainedPaid.map((h) => ({ pid: h.pid, prev: h.capital, cur: M.h[b].get(h.pid)!.capital })).map((x) => ({ ...x, chg: (x.cur - x.prev) / x.prev }));
    const f: Flow = {
      prev, cur, departed, returning, retainedPaid, newAcq, retCur,
      playerChurn: prev.length ? departed.length / prev.length : NaN,
      capitalChurn: prevCap ? depCap / prevCap : NaN,
      persistence: prevCap ? sum(retainedPaid.map((h) => h.capital)) / prevCap : NaN,
      acqChurn: curCap ? acqCap / curCap : NaN,
      prevCap, depCap, curCap, acqCap, retCap: sum(retCur.map((h) => h.capital)),
      retentionPremium: median(prem.map((x) => x.chg)), premList: prem,
      medRetained: median(retCur.map((h) => h.capital)), medAcq: median(newAcq.map((h) => h.capital)),
      medPortal: median(newAcq.filter((h) => h.acq === 'PORTAL').map((h) => h.capital)), medHS: median(newAcq.filter((h) => h.acq === 'HS').map((h) => h.capital)),
      medJUCO: median(newAcq.filter((h) => h.acq === 'JUCO').map((h) => h.capital)),
      medDeparted: median(departed.map((h) => h.capital)),
      replRatio: depCap ? acqCap / depCap : NaN,
      replPremium: 0, replPremiumPct: 0, acqPremium: 0,
    };
    f.replPremium = f.medAcq - f.medDeparted;
    f.replPremiumPct = f.medDeparted ? f.replPremium / f.medDeparted : NaN;
    f.acqPremium = f.medAcq - f.medRetained;
    F[g] = f;
  }
  return F;
}
