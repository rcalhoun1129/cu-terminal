/* =====================================================================
   CU Buy-Side Capital Manager — analytics engine (pure, typed).
   Faithful port of the reference buildModel()/computeAnalytics(): same inputs, same algorithms,
   same summation order. The parity test compares this module with the original engine.
   ===================================================================== */
import type { CuData, Episode, ImportedBook, Player, Season } from '../data/types';
import { COMPOSITE, FY_MONTHS, INDEX_UNIVERSE, KIND_FOR, CAPKEY, POSMAP, SEASONS, TICKERS } from './constants';
import type { EngineSettings, Metric, View } from './settings';
import { sum, median, mean, pct, by } from './util';
import { lifecycle, type Life } from './lifecycle';
import { flows, type Flow } from './flows';
import { heat, finishHeat, type Heat } from './heat';
import { concentration, type Concentration } from './concentration';
import { maturity, type Maturity } from './maturity';
import { tape, type TapeEvent } from './tape';
import { alerts, type Alert } from './alerts';
import { dataQuality, type DqItem } from './dq';

export interface Holding {
  pid: string; season: Season; pos: string; bs: string; acq: string; early: boolean; inSeason: boolean; onNext: boolean; onPrev: boolean;
  capital: number; eps: string[]; monthMap: Record<string, number>; face: number | null; term: number | null; conf: string | null;
  statusRaw?: string; months: number; perMonth: number; m12: number;
}
export interface Obs { h: Holding; v: number }
export interface Stats { n: number; total: number; mean: number; median: number; p10: number; p25: number; p40: number; p50: number; p60: number; p75: number; p90: number; max: number; min: number; _a?: number[] }
export interface MarketCell extends Stats { obs: Obs[]; roomCapital: number; roomCount: number; paid: number; paidAll: number; room: Holding[] }
export interface IndexCell { v: number | null; why: string; n: number; low: boolean }
export interface Cubsmi {
  price: Record<number, { v: number | null; coverage: number; contrib: Record<string, { w: number; rel: number; points: number }> }>;
  capital: Record<number, { v: number; total: number }>; contrib: Record<string, never>;
  weights: Record<string, number>; term: Record<number, { v: number }>;
}
export interface BandRow { k: string; lo: number | null; hi: number | null; rng: string }
export interface Bands { n: number; st: Stats; rows: BandRow[] }
export interface Quote { bid: number; target: number; auth: number; walk: number; n: number }

export interface Analytics {
  market: Record<string, Record<number, MarketCell>>;
  index: Record<string, Record<number, IndexCell>>;
  cubsmi: Cubsmi;
  life: Life;
  flow: Record<number, Record<string, Flow>>;
  heat: Record<string, Heat>;
  conc: Record<number, Concentration>;
  maturity: Maturity;
  tape: TapeEvent[];
  alerts: Alert[];
  dq: DqItem[];
}

export function stats(vals: number[]): Stats {
  const a = vals.filter((v) => isFinite(v));
  return {
    n: a.length, total: sum(a), mean: mean(a), median: median(a), p10: pct(a, 10), p25: pct(a, 25), p40: pct(a, 40), p50: pct(a, 50),
    p60: pct(a, 60), p75: pct(a, 75), p90: pct(a, 90), max: a.length ? Math.max(...a) : NaN, min: a.length ? Math.min(...a) : NaN,
  };
}
export function acqBucket(a: string): string {
  return a === 'RETAINED' ? 'RETAINED' : a === 'HS' ? 'HS' : a === 'JUCO' ? 'JUCO' : a === 'PORTAL' ? 'PORTAL' : 'UNKNOWN';
}
export function inGroup(h: { bs: string }, g: string): boolean {
  if (g === 'ALL') return true;
  if (COMPOSITE[g]) return COMPOSITE[g].includes(h.bs);
  return h.bs === g;
}

export class Model {
  readonly data: CuData;
  readonly settings: EngineSettings;
  readonly imported: ImportedBook | null;
  players: Map<string, Player>;
  episodes: Episode[];
  epById: Map<string, Episode>;
  epsByPlayer: Map<string, Episode[]>;
  third: CuData['thirdParty'];
  caps: Record<number, number>;
  h: Record<number, Map<string, Holding>>;
  buyouts: Episode[];
  committed: Record<number, number>;
  fy2728: number;
  pMonths: Map<string, Record<string, number>>;
  A!: Analytics;

  constructor(data: CuData, settings: EngineSettings, imported: ImportedBook | null = null) {
    this.data = data; this.settings = settings; this.imported = imported;
    const D = data;
    this.players = new Map(D.players.concat(imported ? imported.newPlayers : []).map((p) => [p.id, p]));
    this.episodes = D.episodes.filter((e) => !(imported && e.kind === 'FCST26')).concat(imported ? imported.episodes : []);
    this.epById = new Map(this.episodes.map((e) => [e.id, e]));
    this.epsByPlayer = by(this.episodes, (e) => e.pid);
    this.third = D.thirdParty;
    this.caps = { 2025: D.controls['FY25-26 cap'], 2026: D.controls['FY26-27 cap'], 2027: D.controls['FY27-28 cap (estimate)'] };
    // ---- holdings: one per player per season (market unit)
    this.h = { 2024: new Map(), 2025: new Map(), 2026: new Map() };
    for (const s of SEASONS) {
      const [m0, m1] = FY_MONTHS[s];
      for (const e of this.episodes) {
        if (e.kind !== KIND_FOR[s]) continue;
        const p = this.players.get(e.pid); if (!p) continue;
        let h = this.h[s].get(e.pid);
        if (!h) { h = this.mkHolding(p, s); this.h[s].set(e.pid, h); }
        h.capital += +(e.capsBy[CAPKEY[s]] || 0);
        h.eps.push(e.id);
        for (const [k, v] of Object.entries(e.months || {})) if (k >= m0 && k <= m1 && v > 0) { h.monthMap[k] = (h.monthMap[k] || 0) + v; }
        if (e.face && (h.face == null || (e.amend || 0) >= 0)) h.face = Math.max(h.face || 0, e.face);
        if (e.term) h.term = e.term;
        if (e.status) h.statusRaw = e.status;
        if (e.conf === 'NEEDS REVIEW') h.conf = 'NEEDS REVIEW'; else if (!h.conf) h.conf = e.conf;
      }
      for (const h of this.h[s].values()) {
        h.capital = Math.round(h.capital * 100) / 100;
        h.months = Object.keys(h.monthMap).length;
        h.perMonth = h.months ? h.capital / h.months : NaN;
        h.m12 = h.months ? (h.capital / h.months) * 12 : NaN;
      }
    }
    this.buyouts = this.episodes.filter((e) => e.kind === 'BUYOUT');
    this.committed = {
      2024: sum([...this.h[2024].values()].map((h) => h.capital)),
      2025: sum([...this.h[2025].values()].map((h) => h.capital)) + sum(this.buyouts.filter((b) => b.season === 2025).map((b) => b.capital)),
      2026: sum([...this.h[2026].values()].map((h) => h.capital)) + sum(this.buyouts.filter((b) => b.season === 2026).map((b) => b.capsBy['FY26-27'] || 0)),
    };
    this.fy2728 = sum(this.episodes.filter((e) => e.kind === 'FCST26' || e.kind === 'IMPORT26').map((e) => +(e.capsBy['FY27-28'] || 0)));
    // ---- player monthly capital (all episodes, for security charts & economic tenure)
    this.pMonths = new Map();
    for (const e of this.episodes) {
      if (e.kind === 'BUYOUT') continue;
      const m = this.pMonths.get(e.pid) || {};
      for (const [k, v] of Object.entries(e.months || {})) {
        if (e.kind === 'RSLA' && k >= '2026-07') continue; // superseded by the FY26-27 schedule
        if (e.kind === 'COLLECTIVE_SP25') continue; // overlaps the collective schedule months; shown as its own episode
        if (v > 0) m[k] = (m[k] || 0) + v;
      }
      this.pMonths.set(e.pid, m);
    }
    this.computeAnalytics();
  }

  private mkHolding(p: Player, s: Season): Holding {
    const r = p.seasons[String(s) as '2024'], next = p.seasons[String(s + 1) as '2024'], prev = p.seasons[String(s - 1) as '2024'];
    let pos = r && r.pos, early = false;
    if (!pos) { if (s === 2025 && next && next.pos) { pos = next.pos; early = true; } else if (s === 2026 && prev && prev.pos) pos = prev.pos; }
    if (!pos) { const e24 = s === 2024 && (this.epsByPlayer.get(p.id) || []).find((e) => e.filePos); if (e24) pos = e24.filePos; }
    if (!pos) pos = p.fallbackPos;
    let acq: string = r && r.onRoster ? r.acq : early && next ? next.acq : 'UNKNOWN';
    if (acq === 'UNKNOWN' && p.offRosterNote) acq = 'PORTAL';
    return {
      pid: p.id, season: s, pos: pos || 'UNK', bs: POSMAP[pos as string] || 'UNK', acq, early, inSeason: !!(r && r.onRoster),
      onNext: !!(next && next.onRoster), onPrev: !!(prev && prev.onRoster), capital: 0, eps: [], monthMap: {}, face: null, term: null, conf: null,
      months: 0, perMonth: NaN, m12: NaN,
    };
  }

  holdings(s: number): Holding[] { return [...this.h[s].values()]; }
  metricVal(h: Holding, metric: Metric = this.settings.metric): number { return metric === '12m' ? h.m12 : metric === 'month' ? h.perMonth : h.capital; }
  /** Market observations: core purchase market (≥ threshold) and in-season roster (unless includeEarly). */
  obs(s: number, g = 'ALL', o: { view?: View; metric?: Metric; anyRoster?: boolean; acq?: string } = {}): Obs[] {
    const S = this.settings, view = o.view || S.view, metric = o.metric || S.metric;
    return this.holdings(s).filter((h) => inGroup(h, g) && (view === 'all' ? h.capital > 0 : h.capital >= S.threshold)
      && (o.anyRoster || h.inSeason || (S.includeEarly && h.early)) && (!o.acq || o.acq === 'ALL' || acqBucket(h.acq) === o.acq))
      .map((h) => ({ h, v: this.metricVal(h, metric) })).filter((x) => isFinite(x.v));
  }
  bandPool(g: string, basis: string = this.settings.band): number[] {
    const seasons = basis === 'pooled' ? SEASONS : basis === 'inst' ? [2025, 2026] : [+basis];
    return seasons.flatMap((s) => this.obs(s, g).map((x) => x.v));
  }
  bands(g: string, basis: string = this.settings.band): Bands {
    const a = this.bandPool(g, basis); const st = stats(a);
    return { n: st.n, st, rows: [
      { k: 'EXCEPTION', lo: st.p90, hi: null, rng: '> P90' }, { k: 'PREMIUM', lo: st.p75, hi: st.p90, rng: 'P75–P90' }, { k: 'STARTER', lo: st.p60, hi: st.p75, rng: 'P60–P75' },
      { k: 'ROTATION', lo: st.p40, hi: st.p60, rng: 'P40–P60' }, { k: 'DEPTH', lo: st.p25, hi: st.p40, rng: 'P25–P40' }, { k: 'DEVELOPMENT', lo: null, hi: st.p25, rng: '< P25' }] };
  }
  bandOf(g: string, v: number, basis: string = this.settings.band): string {
    const b = this.bands(g, basis); if (b.n < this.settings.minN) return '—'; const s = b.st;
    return v > s.p90 ? 'EXCEPTION' : v > s.p75 ? 'PREMIUM' : v > s.p60 ? 'STARTER' : v > s.p40 ? 'ROTATION' : v >= s.p25 ? 'DEPTH' : 'DEVELOPMENT';
  }
  quote(g: string, basis: string = this.settings.band): Quote | null {
    const a = this.bandPool(g, basis), A = this.settings.assume;
    if (A.bid == null || A.target == null || A.auth == null || A.walk == null) return null;
    return { bid: pct(a, A.bid), target: pct(a, A.target), auth: pct(a, A.auth), walk: pct(a, A.walk), n: a.length };
  }
  playerSeasonCap(pid: string, s: number): number { return (this.h[s].get(pid) || ({} as Holding)).capital || 0; }

  private computeAnalytics(): void {
    const S = this.settings;
    const A = (this.A = {} as Analytics);
    // --- position markets by season
    A.market = {};
    for (const T of TICKERS) {
      A.market[T.g] = {};
      for (const s of SEASONS) {
        const o = this.obs(s, T.g), room = this.holdings(s).filter((h) => inGroup(h, T.g));
        const st = stats(o.map((x) => x.v)) as MarketCell;
        st.obs = o; st.roomCapital = sum(room.map((h) => h.capital)); st.roomCount = room.filter((h) => h.inSeason || h.early).length;
        st.paid = room.filter((h) => h.capital >= S.threshold).length; st.paidAll = room.filter((h) => h.capital > 0).length;
        st.room = room;
        A.market[T.g][s] = st;
      }
    }
    // --- position indexes (2024 = 100, median basis)
    A.index = {};
    for (const T of TICKERS) {
      const base = A.market[T.g][2024]; A.index[T.g] = {};
      for (const s of SEASONS) {
        const m = A.market[T.g][s];
        let v: number | null = null, why = '';
        if (base.n < S.minN) why = 'insufficient 2024 base (N=' + base.n + ')';
        else if (m.n < S.minN) why = 'insufficient ' + s + ' observations (N=' + m.n + ')';
        else v = s === 2024 ? 100 : (100 * m.median) / base.median;
        A.index[T.g][s] = { v, why, n: m.n, low: m.n > 0 && m.n < S.lowN };
      }
    }
    // --- CUBSMI: fixed-base (Laspeyres) position-weighted median-price relative
    const w0: Record<string, number> = {}; let wsum = 0;
    for (const g of INDEX_UNIVERSE) { const b = A.market[g][2024]; if (b.n >= S.lowN) { w0[g] = b.total; wsum += b.total; } }
    A.cubsmi = { price: {}, capital: {}, contrib: {}, weights: {}, term: {} };
    for (const g in w0) A.cubsmi.weights[g] = w0[g] / wsum;
    const cap24 = sum(this.obs(2024, 'ALL').map((x) => x.h.capital));
    for (const s of SEASONS) {
      let num = 0, den = 0; const contrib: Record<string, { w: number; rel: number; points: number }> = {};
      for (const g in w0) { const m = A.market[g][s]; if (m.n >= S.lowN) { const rel = m.median / A.market[g][2024].median; num += w0[g] * rel; den += w0[g]; contrib[g] = { w: w0[g], rel, points: 0 }; } }
      const lvl = den ? (100 * num) / den : null;
      for (const g in contrib) { contrib[g].points = 100 * (contrib[g].w / den) * (contrib[g].rel - 1); }
      A.cubsmi.price[s] = { v: lvl, coverage: den / wsum, contrib };
      const capS = sum(this.obs(s, 'ALL').map((x) => x.h.capital));
      A.cubsmi.capital[s] = { v: (100 * capS) / cap24, total: capS };
    }
    const t24 = median(this.obs(2024, 'ALL').map((x) => x.h.months));
    for (const s of SEASONS) A.cubsmi.term[s] = { v: (100 * median(this.obs(s, 'ALL').map((x) => x.h.months))) / t24 };
    A.life = lifecycle(this);
    A.flow = {};
    for (const [a, b] of [[2024, 2025], [2025, 2026]]) A.flow[b] = flows(this, a, b);
    A.heat = heat(this);
    A.conc = {}; for (const s of SEASONS) A.conc[s] = concentration(this, s);
    A.maturity = maturity(this);
    finishHeat(this);
    A.tape = tape(this);
    A.alerts = alerts(this);
    A.dq = dataQuality(this);
  }
}

export const buildModel = (data: CuData, settings: EngineSettings, imported: ImportedBook | null = null): Model => new Model(data, settings, imported);
