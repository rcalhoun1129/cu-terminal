import { TICKERS } from './constants';
import { inGroup, type Model } from './model';
import { sum, mean } from './util';

export interface HeatComp { raw: number | null; fmt: 'pct'; score: number | null; scale: string }
export interface Heat { comp: Record<string, HeatComp>; n: number; score: number | null; label: string }

/** Seven-factor market heat; maturity exposure is filled in by finishHeat() once maturity is known. */
export function heat(M: Model): Record<string, Heat> {
  const H: Record<string, Heat> = {}; const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const lin = (v: number, a: number, b: number) => (isFinite(v) ? Math.round(clamp((100 * (v - a)) / (b - a))) : null);
  const minN = M.settings.minN;
  for (const T of TICKERS) {
    const g = T.g;
    const m25 = M.A.market[g][2025], m26 = M.A.market[g][2026], f = M.A.flow[2026][g];
    const comp: Record<string, HeatComp> = {
      'YoY median price change': { raw: m25.n >= minN && m26.n >= minN ? m26.median / m25.median - 1 : NaN, fmt: 'pct', score: null, scale: '−20% → 0 · +50% → 100' },
      'Replacement premium': { raw: f.replPremiumPct, fmt: 'pct', score: null, scale: '−50% → 0 · +100% → 100' },
      'Capital churn': { raw: f.capitalChurn, fmt: 'pct', score: null, scale: '0% → 0 · 100% → 100' },
      'Acquisition demand': { raw: f.acqChurn, fmt: 'pct', score: null, scale: 'new-player share of room capital' },
      'Position capital growth': { raw: m25.roomCapital ? m26.roomCapital / m25.roomCapital - 1 : NaN, fmt: 'pct', score: null, scale: '−30% → 0 · +100% → 100' },
      'Internal supply shortfall': { raw: f.cur.length ? 1 - f.retCur.length / f.cur.length : NaN, fmt: 'pct', score: null, scale: '1 − returning share of paid room' },
      'Maturity exposure (≤ Dec-26)': { raw: null, fmt: 'pct', score: null, scale: 'share of room FY26-27 obligation maturing by Dec 2026' },
    };
    comp['YoY median price change'].score = lin(comp['YoY median price change'].raw!, -0.2, 0.5);
    comp['Replacement premium'].score = lin(comp['Replacement premium'].raw!, -0.5, 1);
    comp['Capital churn'].score = lin(comp['Capital churn'].raw!, 0, 1);
    comp['Acquisition demand'].score = lin(comp['Acquisition demand'].raw!, 0, 1);
    comp['Position capital growth'].score = lin(comp['Position capital growth'].raw!, -0.3, 1);
    comp['Internal supply shortfall'].score = lin(comp['Internal supply shortfall'].raw!, 0, 1);
    H[g] = { comp, n: 0, score: null, label: 'N/A' };
  }
  return H;
}

export function finishHeat(M: Model): void {
  for (const T of TICKERS) {
    const g = T.g, H = M.A.heat[g];
    const room = M.holdings(2026).filter((h) => inGroup(h, g)); const tot = sum(room.map((h) => h.capital));
    const early = sum(room.filter((h) => { const mm = Object.keys(h.monthMap).filter((k) => h.monthMap[k] > 0).sort(); return mm.length && mm[mm.length - 1] <= '2026-12'; }).map((h) => h.capital));
    const c = H.comp['Maturity exposure (≤ Dec-26)']; c.raw = tot ? early / tot : NaN; c.score = isFinite(c.raw) ? Math.round(100 * c.raw) : null;
    const sc = Object.values(H.comp).map((c) => c.score).filter((v): v is number => v != null && isFinite(v));
    H.n = sc.length; H.score = sc.length >= 3 ? Math.round(mean(sc)) : null;
    H.label = H.score == null ? 'N/A' : H.score <= 20 ? 'LOW' : H.score <= 40 ? 'MODERATE' : H.score <= 60 ? 'ACTIVE' : H.score <= 80 ? 'TIGHT' : 'EXTREME';
  }
}
