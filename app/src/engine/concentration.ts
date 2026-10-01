import { TICKERS } from './constants';
import { inGroup, type Holding, type Model } from './model';
import { sum } from './util';

export interface PosConc { n: number; total: number; top1: number; top3: number; lead?: Holding }
export interface Concentration { hs: Holding[]; tot: number; top1: number; top5: number; top10: number; top20: number; lorenz: [number, number][]; byPos: Record<string, PosConc> }

export function concentration(M: Model, s: number): Concentration {
  const hs = M.holdings(s).filter((h) => h.capital > 0).sort((a, b) => b.capital - a.capital), tot = sum(hs.map((h) => h.capital));
  const top = (n: number) => (tot ? sum(hs.slice(0, n).map((h) => h.capital)) / tot : NaN);
  const lorenz: [number, number][] = []; let c = 0;
  hs.slice().reverse().forEach((h, i) => { c += h.capital; lorenz.push([(i + 1) / hs.length, c / tot]); });
  const byPos: Record<string, PosConc> = {};
  for (const T of TICKERS) {
    const r = hs.filter((h) => inGroup(h, T.g)); const t = sum(r.map((h) => h.capital));
    byPos[T.g] = { n: r.length, total: t, top1: t ? (r[0]?.capital as number) / t : NaN, top3: t ? sum(r.slice(0, 3).map((h) => h.capital)) / t : NaN, lead: r[0] };
  }
  return { hs, tot, top1: top(1), top5: top(5), top10: top(10), top20: top(20), lorenz, byPos };
}
