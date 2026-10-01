/* Screen-level building blocks shared across sections (ported from the reference helper functions). */
import type { ReactNode } from 'react';
import type { Drive, Episode } from '../data/types';
import { AS_OF_M, CAPKEY, GROUPS, POSMAP, REGIME, SEASONS, SEASON_LABEL, TICKERS } from '../engine/constants';
import { acqBucket, inGroup, type Bands, type Holding, type MarketCell, type Model, type Quote } from '../engine/model';
import type { Flow } from '../engine/flows';
import { dateLabel, type TapeEvent } from '../engine/tape';
import { useStore, type AppState, type TraceItem } from '../state/store';
import { CapStack, HBars, Line } from '../ui/charts';
import { HeatTag, LowTag, Money, PLink, Sel, Seg, Table } from '../ui/components';
import { fmt$, fmt0, fmtM, idx, median, pct, pctf, rank, sgn, sum } from '../ui/fmt';

/* ---------------------------------------------------------------- trace builders */
export function trHold(M: Model, hs: Holding[], season: number): TraceItem[] {
  const out: TraceItem[] = [];
  for (const h of hs) for (const id of h.eps) { const e = M.epById.get(id)!; out.push({ pid: h.pid, eid: id, amount: +(e.capsBy[CAPKEY[season]] || 0), pos: h.bs }); }
  return out;
}
export const trEps = (eps: Episode[], key?: string): TraceItem[] => eps.map((e) => ({ pid: e.pid, eid: e.id, amount: key ? +(e.capsBy[key] || 0) : e.capital }));

/* ---------------------------------------------------------------- market board */
export interface BoardRow { T: (typeof TICKERS)[number]; g: string; idx: number | null; idx25: number | null; yoy: number; median: number; p75: number; p90: number; room: number; count: number; n: number; churn: number; heat: Model['A']['heat'][string]; m: MarketCell }
export function boardRows(M: Model): BoardRow[] {
  const S = M.settings;
  return TICKERS.map((T) => { const m = M.A.market[T.g][2026], m25 = M.A.market[T.g][2025], ix = M.A.index[T.g]; const f = M.A.flow[2026][T.g];
    return { T, g: T.g, idx: ix[2026].v, idx25: ix[2025].v, yoy: ix[2026].v && ix[2025].v ? ix[2026].v / ix[2025].v - 1 : m.n >= S.minN && m25.n >= S.minN ? m.median / m25.median - 1 : NaN,
      median: m.median, p75: m.p75, p90: m.p90, room: m.roomCapital, count: m.roomCount, n: m.n, churn: f.capitalChurn, heat: M.A.heat[T.g], m }; });
}
export function BoardTable({ M, rows, maxh }: { M: Model; rows: BoardRow[]; maxh?: number }) {
  const S = M.settings;
  return <Table rows={rows} opts={{ go: (r) => '#/pos/' + r.T.t, maxh, note: 'Index 2024 = 100 · median basis · CORE ≥ ' + fmtM(S.threshold) }} cols={[
    { l: 'Ticker', v: (r) => r.T.t, f: (r) => <span className="mono warn">{r.T.t}</span> },
    { l: 'Position', v: (r) => r.T.name, f: (r) => <>{r.T.name}{r.T.composite && <> <span className="tag">COMPOSITE</span></>}</> },
    { l: 'Index', n: true, v: (r) => r.idx ?? -1, f: (r) => (r.idx == null ? <span className="muted" data-tip={M.A.index[r.g][2026].why}>N/A</span>
      : <>{r.idx.toFixed(1)}{Math.min(M.A.market[r.g][2024].n, r.n) < S.lowN && <span className="low" data-tip={`Base or current N below ${S.lowN}: index is unstable`}>LOW</span>}</>) },
    { l: 'YoY', n: true, v: (r) => (isFinite(r.yoy) ? r.yoy : -99), f: (r) => (isFinite(r.yoy) ? <span className={r.yoy >= 0 ? 'up' : 'down'}>{sgn(r.yoy)}</span> : '—') },
    { l: 'Median', n: true, v: (r) => r.median || 0, f: (r) => <><Money v={r.median} items={trHold(M, r.m.obs.map((x) => x.h), 2026)} label={r.T.t + ' 2026 market observations'} /><LowTag n={r.n} minN={S.minN} lowN={S.lowN} /></> },
    { l: 'P75', n: true, v: (r) => r.p75 || 0, f: (r) => fmtM(r.p75) }, { l: 'P90', n: true, v: (r) => r.p90 || 0, f: (r) => fmtM(r.p90) },
    { l: 'Room Capital', n: true, v: (r) => r.room, f: (r) => <Money v={r.room} items={trHold(M, r.m.room, 2026)} label={r.T.t + ' room capital FY26-27'} /> },
    { l: 'Roster', n: true, v: (r) => r.count, f: (r) => r.count }, { l: 'N', n: true, v: (r) => r.n, f: (r) => r.n },
    { l: 'Cap Churn', n: true, v: (r) => (isFinite(r.churn) ? r.churn : -1), f: (r) => pctf(r.churn, 0) },
    { l: 'Heat', v: (r) => r.heat.score ?? -1, f: (r) => <HeatTag h={r.heat} /> }]} />;
}
export interface AllocRow { g: string; T: (typeof TICKERS)[number]; v: number; share: number; prev: number; yoy: number; hs: Holding[] }
export function allocRows(M: Model, season: number): AllocRow[] {
  const tot = sum(M.holdings(season).map((h) => h.capital));
  return TICKERS.filter((T) => !T.composite).map((T) => { const r = M.holdings(season).filter((h) => inGroup(h, T.g)); const v = sum(r.map((h) => h.capital));
    const prev = season > 2024 ? sum(M.holdings(season - 1).filter((h) => inGroup(h, T.g)).map((h) => h.capital)) : NaN;
    return { g: T.g, T, v, share: tot ? v / tot : 0, prev, yoy: prev ? v / prev - 1 : NaN, hs: r }; }).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
}

/* ---------------------------------------------------------------- capital stack */
export function CapStackBlock({ M, fy, reserve }: { M: Model; fy: number; reserve: number | null }) {
  const cap = M.caps[fy], com = M.committed[fy], res = reserve || 0;
  const paidToDate = fy === 2026 ? sum(Object.entries(M.A.maturity.cash).filter(([k]) => k >= '2026-07' && k <= AS_OF_M).map(([, v]) => v)) : com;
  const avail = cap - com - res;
  const segs = [{ k: 'Paid to date (sched.)', v: paidToDate, color: '#4b5059' }, { k: 'Committed remaining', v: Math.max(0, com - paidToDate), color: '#3987e5' }, { k: 'Reserved', v: res, color: '#c98500' }, { k: 'Available', v: Math.max(0, avail), color: '#2fd06b' }].filter((s) => s.v > 0);
  const f27 = M.episodes.filter((e) => +(e.capsBy['FY27-28'] || 0) > 0 && e.kind !== 'RSLA');
  return <>
    <dl className="kv"><dt>Total cap</dt><dd>{fmt$(cap)}</dd><dt>Committed</dt><dd>{fmt$(com)}</dd><dt>Reserved {reserve == null && <a href="#/assumptions" className="muted">(set)</a>}</dt><dd>{fmt$(res)}</dd>
      <dt>Available</dt><dd className={avail < 0 ? 'down' : 'up'}>{fmt$(avail)}</dd>
      <dt>Future obligations FY27-28</dt><dd><Money v={M.fy2728} items={f27.map((e) => ({ pid: e.pid, eid: e.id, amount: +e.capsBy['FY27-28'] }))} label="FY27-28 committed" fmt={fmt$} /></dd></dl>
    <CapStack segs={segs} total={cap} />
    <div className="muted" style={{ fontSize: '10.5px' }}>{fy === 2026 ? 'Paid-to-date = scheduled Jul–Sep 2026 payments in the current book (scheduled, not bank actuals).' : 'FY25-26 fully scheduled.'}</div>
  </>;
}

/* ---------------------------------------------------------------- transaction table */
export function TapeTable({ M, rows, maxh, tall }: { M: Model; rows: TapeEvent[]; maxh?: number; tall?: boolean }) {
  void M;
  return <Table rows={rows} opts={{ maxh: maxh || 600, tall, go: (r) => '#/player/' + encodeURIComponent(r.pid) }} cols={[
    { l: 'Date', v: (r) => r.date, f: (r) => <span className="mono">{dateLabel(r)}</span> }, { l: 'Player', v: (r) => r.pid, f: (r) => <PLink pid={r.pid} /> }, { l: 'Pos', k: 'pos' },
    { l: 'Action', v: (r) => r.action, f: (r) => <span className={`act ${r.action}`}>{r.action}</span> },
    { l: 'Old Capital', n: true, v: (r) => r.old ?? -1, f: (r) => (r.old != null ? fmtM(r.old) : '—') },
    { l: 'New Capital', n: true, v: (r) => r.nu ?? -1, f: (r) => (r.nu != null ? <Money v={r.nu} items={[{ pid: r.pid, eid: r.eid, amount: r.nu }]} label={r.action + ' ' + r.pid} /> : '—') },
    { l: 'Delta', n: true, v: (r) => r.delta ?? 0, f: (r) => (r.delta != null ? <span className={r.delta >= 0 ? 'up' : 'down'}>{r.delta >= 0 ? '+' : ''}{fmtM(r.delta)}</span> : '—') },
    { l: 'Term', n: true, v: (r) => +(r.term as number) || 0, f: (r) => (r.term != null && r.term !== '' ? String(r.term).replace('.0', '') : '—') }, { l: 'Regime', k: 'regime' }, { l: 'Status', k: 'status', cls: 'wrap' }]} />;
}

/* ---------------------------------------------------------------- CUBSMI */
export function seasonalIndex(M: Model, kind: 'acq' | 'ret'): Record<number, number | null> {
  const med = (s: number) => median(M.obs(s, 'ALL').filter((x) => (kind === 'acq' ? x.h.acq !== 'RETAINED' : x.h.acq === 'RETAINED')).map((x) => x.v)); const b = med(2024);
  return Object.fromEntries(SEASONS.map((s) => [s, b ? (100 * med(s)) / b : null]));
}
export function CubsmiChart({ M }: { M: Model }) {
  const I = M.A.cubsmi; const rep = seasonalIndex(M, 'acq'), ret = seasonalIndex(M, 'ret');
  return <Line x={['2024', '2025', '2026']} base={100} h={210} series={[
    { name: 'Price', color: '#e8e9eb', pts: SEASONS.map((s) => ({ y: I.price[s].v, tip: `CUBSMI price ${s}: ${idx(I.price[s].v)} (coverage ${pctf(I.price[s].coverage, 0)} of base weight)`, go: '#/cubsmi' })) },
    { name: 'Capital', color: '#3987e5', pts: SEASONS.map((s) => ({ y: I.capital[s].v, tip: `Capital index ${s}: ${idx(I.capital[s].v)} · core capital ${fmtM(I.capital[s].total)}` })) },
    { name: 'Term', color: '#c98500', dash: 1, pts: SEASONS.map((s) => ({ y: I.term[s].v })) },
    { name: 'Replacement', color: '#d95926', dash: 1, pts: SEASONS.map((s) => ({ y: rep[s] })) },
    { name: 'Retention', color: '#199e70', dash: 1, pts: SEASONS.map((s) => ({ y: ret[s] })) }]} />;
}

/* ---------------------------------------------------------------- bands, ladder, quote */
export const bandLabel = (band: string) => (band === 'pooled' ? 'all seasons pooled' : band === 'inst' ? 'institutional 2025–26' : band);
export function Ladder({ M, g, b, hit = null }: { M: Model; g: string; b: Bands; hit?: string | null }) {
  if (b.n < M.settings.minN) return <div className="empty">N/A — insufficient observations (N={b.n})</div>;
  const chMed = (c: string) => fmtM(median(SEASONS.flatMap((s) => M.obs(s, g).filter((x) => x.h.acq === c).map((x) => x.v))));
  return <>
    <div className="ladder">{b.rows.map((r) => <div key={r.k} className={`lr ${hit === r.k ? 'hit' : ''}`}><b>{r.k}</b><span className="num">{r.lo == null ? '< ' + fmtM(r.hi) : r.hi == null ? fmtM(r.lo) + '+' : fmtM(r.lo) + ' – ' + fmtM(r.hi)}</span><span className="muted" style={{ textAlign: 'right' }}>{r.rng}</span></div>)}</div>
    <dl className="kv" style={{ marginTop: 6 }}><dt>Historical median (pooled)</dt><dd>{fmtM(median(M.bandPool(g, 'pooled')))}</dd><dt>Current median (2026)</dt><dd>{fmtM(M.A.market[g][2026].median)}</dd>
      <dt>Portal median</dt><dd>{chMed('PORTAL')}</dd><dt>Retention median</dt><dd>{chMed('RETAINED')}</dd></dl>
    <div className="muted" style={{ fontSize: '10.5px', marginTop: 4 }}>Historical statistical bands. Management bands are set through the quote anchors in Assumptions.</div>
  </>;
}
export function QuoteBlock({ M, g, q, ask = null }: { M: Model; g: string; q: Quote | null; ask?: number | null }) {
  const med = median(M.bandPool(g)), p75 = pct(M.bandPool(g), 75); const A = M.settings.assume;
  if (!q) return <>
    <div className="note">Management quote not established. BID / TARGET / AUTH / WALK stay blank until the underwriting anchors are set.</div>
    <dl className="kv"><dt>Historical median</dt><dd>{fmtM(med)}</dd><dt>Market P75</dt><dd>{fmtM(p75)}</dd></dl>
    <div style={{ marginTop: 8 }}><a className="iconbtn" href="#/assumptions">Set underwriting anchors ›</a></div></>;
  return <>
    <div className="qt">{ask != null ? <div className="ask"><small>ASK</small><b>{fmtM(ask)}</b></div> : <div><small>HIST MEDIAN</small><b>{fmtM(med)}</b></div>}
      <div className="mgmt"><small>BID · P{A.bid}</small><b>{fmtM(q.bid)}</b></div><div className="mgmt"><small>TARGET · P{A.target}</small><b>{fmtM(q.target)}</b></div>
      <div className="mgmt"><small>AUTH · P{A.auth}</small><b>{fmtM(q.auth)}</b></div><div className="mgmt"><small>WALK · P{A.walk}</small><b>{fmtM(q.walk)}</b></div></div>
    {ask != null && <dl className="kv" style={{ marginTop: 8 }}><dt>Ask spread (ask − target)</dt><dd className={ask - q.target > 0 ? 'down' : 'up'}>{fmtM(ask - q.target)}</dd><dt>Authority spread (auth − target)</dt><dd>{fmtM(q.auth - q.target)}</dd><dt>Walk-away spread (ask − walk)</dt><dd className={ask > q.walk ? 'down' : 'up'}>{fmtM(ask - q.walk)}</dd></dl>}
    <div className="muted" style={{ fontSize: '10.5px', marginTop: 6 }}>Amber = management values (percentile anchors set in Assumptions, applied to the {bandLabel(M.settings.band)} {g} distribution, N={q.n}). Historical statistics are shown separately.</div>
  </>;
}
export function SeasonStatsTable({ M, g }: { M: Model; g: string }) {
  const m = M.A.market[g];
  return <Table rows={SEASONS.map((s) => ({ s, ...m[s] }))} opts={{ note: 'Outlier control: mean vs mean ex-top transaction shown; nothing deleted' }} cols={[
    { l: 'Season', k: 's' }, { l: 'Regime', f: (r) => REGIME[r.s] }, { l: 'N', n: true, k: 'n' }, { l: 'Total', n: true, v: (r) => r.total, f: (r) => <Money v={r.total} items={trHold(M, r.obs.map((x) => x.h), r.s)} label={g + ' ' + r.s} /> },
    { l: 'Mean', n: true, f: (r) => fmtM(r.mean) }, { l: 'Median', n: true, f: (r) => fmtM(r.median) }, { l: 'P25', n: true, f: (r) => fmtM(r.p25) }, { l: 'P75', n: true, f: (r) => fmtM(r.p75) }, { l: 'P90', n: true, f: (r) => fmtM(r.p90) },
    { l: 'Max', n: true, f: (r) => fmtM(r.max) }, { l: 'Min+', n: true, f: (r) => fmtM(r.min) },
    { l: 'Mean ex-top', n: true, f: (r) => { const a = r.obs.map((x) => x.v).sort((x, y) => y - x).slice(1); return fmtM(a.length ? sum(a) / a.length : NaN); } }, { l: 'Index', n: true, f: (r) => idx(M.A.index[g][r.s].v) }]} />;
}
export function RoomTable({ M, room }: { M: Model; room: Holding[] }) {
  const tot = sum(room.map((x) => x.capital));
  return <Table rows={room} opts={{ go: (r) => '#/player/' + encodeURIComponent(r.pid) }} cols={[
    { l: 'Ticker', f: (r) => <span className="mono">{M.players.get(r.pid)!.ticker}</span>, v: (r) => M.players.get(r.pid)!.ticker }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Pos', k: 'pos' }, { l: 'Acq', f: (r) => acqBucket(r.acq), v: (r) => r.acq },
    { l: 'FY26-27 CAPS', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={trHold(M, [r], 2026)} label={r.pid} /> }, { l: 'Room %', n: true, v: (r) => r.capital, f: (r) => pctf(r.capital / tot) },
    { l: 'Band', f: (r) => M.bandOf(r.bs, r.capital), v: (r) => r.capital }, { l: 'Pctile', n: true, v: (r) => rank(M.bandPool(r.bs), r.capital), f: (r) => { const v = rank(M.bandPool(r.bs), r.capital); return isFinite(v) ? 'P' + v.toFixed(0) : '—'; } },
    { l: 'Comp. months', n: true, k: 'months' }, { l: 'Term', n: true, f: (r) => r.term ?? '—', v: (r) => +(r.term as number) || 0 }, { l: 'FY25-26', n: true, v: (r) => M.playerSeasonCap(r.pid, 2025), f: (r) => fmtM(M.playerSeasonCap(r.pid, 2025)) },
    { l: 'Status', f: (r) => (r.inSeason ? <span className="up">ROSTER</span> : <span className="warn">OFF-ROSTER</span>) }]} />;
}
export function HeatTiles({ M }: { M: Model }) {
  return <div className="tiles">{TICKERS.map((T) => { const h = M.A.heat[T.g], ix = M.A.index[T.g], m = M.A.market[T.g][2026], y = ix[2025].v && ix[2026].v ? ix[2026].v / ix[2025].v - 1 : NaN;
    const tip = Object.entries(h.comp).map(([k, c]) => `${k}: ${c.raw != null && isFinite(c.raw) ? sgn(c.raw).replace('+', '') : '—'} → ${c.score ?? '—'}`).join('\n');
    return <div key={T.t} className="tile" data-go={`#/pos/${T.t}`} data-tip={tip}><div className="tt"><span className="warn">{T.t}</span><HeatTag h={h} /></div><div className="iv">{idx(ix[2026].v)}</div>
      <div className="rw"><span>YoY {isFinite(y) ? <span className={y >= 0 ? 'up' : 'down'}>{sgn(y, 0)}</span> : '—'}</span><span>Med {fmtM(m.median)}</span></div>
      <div className="rw"><span>Cap churn {pctf(M.A.flow[2026][T.g].capitalChurn, 0)}</span><span>N={m.n}</span></div></div>; })}</div>;
}

/* ---------------------------------------------------------------- filter bar */
export function FilterBar({ extra }: { extra?: ReactNode }) {
  const F = useStore((s) => s.filters); const threshold = useStore((s) => s.threshold); const metric = useStore((s) => s.metric);
  const g = ['ALL', ...GROUPS.filter((x) => x !== 'ATH'), 'SEC'];
  return <div className="filt">
    <label>Season</label><Sel path="f.season" opts={[[2024, '2024 · Collective'], [2025, '2025 · FY25-26'], [2026, '2026 · FY26-27']]} value={F.season} />
    <label>Regime</label><span className="mono t2">{REGIME[F.season]}</span>
    <label>Position</label><Sel path="f.pos" opts={g} value={F.pos} />
    <label>Acquisition</label><Sel path="f.acq" opts={['ALL', 'PORTAL', 'HS', 'JUCO', 'RETAINED', 'UNKNOWN']} value={F.acq} />
    <label>Status</label><Sel path="f.status" opts={[['ALL', 'All'], ['ROSTER', 'On season roster'], ['EARLY', 'Early enrollee'], ['OFF', 'Off roster']]} value={F.status} />
    <label>Tier</label><Sel path="f.tier" opts={['ALL', 'EXCEPTION', 'PREMIUM', 'STARTER', 'ROTATION', 'DEPTH', 'DEVELOPMENT']} value={F.tier} />
    <label>View</label><Seg path="f.view" opts={[['core', 'CORE ≥' + fmtM(threshold)], ['all', 'ALL PAID']]} value={F.view} />
    <label>Metric</label><Seg path="metric" opts={[['fy', 'FY CAPS'], ['12m', '12M EQUIV'], ['month', 'CAP/MONTH']]} value={metric} />
    {extra}</div>;
}
export function filtered(M: Model, F: AppState['filters'], season: number = F.season): Holding[] {
  const T0 = M.settings.threshold;
  return M.holdings(season).filter((h) => {
    if (F.view === 'core' ? h.capital < T0 : h.capital <= 0) return false;
    if (F.pos !== 'ALL' && !inGroup(h, F.pos)) return false;
    if (F.acq !== 'ALL' && acqBucket(h.acq) !== F.acq) return false;
    if (F.status === 'ROSTER' && !h.inSeason) return false; if (F.status === 'EARLY' && !h.early) return false; if (F.status === 'OFF' && (h.inSeason || h.early)) return false;
    if (F.tier !== 'ALL' && M.bandOf(h.bs, h.capital) !== F.tier) return false;
    return true;
  });
}

/* ---------------------------------------------------------------- players & lifecycle */
export interface PRow { p: Model['players'] extends Map<string, infer P> ? P : never; c24: number; c25: number; c26: number; life: number }
export const allPlayerRows = (M: Model): PRow[] => [...M.players.values()].map((p) => ({ p, c24: M.playerSeasonCap(p.id, 2024), c25: M.playerSeasonCap(p.id, 2025), c26: M.playerSeasonCap(p.id, 2026), life: sum(Object.values(M.pMonths.get(p.id) || {})) }));
export const kmBy = (M: Model, groups: [string, (pid: string) => boolean][], capital = false) => groups.map(([name, f]) => ({ name, ...M.A.life.km(f, capital) }));
export const posF = (M: Model, g: string) => (pid: string) => { const p = M.players.get(pid)!; return SEASONS.some((s) => inGroup({ bs: POSMAP[p.seasons[String(s) as '2024'].pos as string] }, g)); };
export const chF = (M: Model, c: string) => (pid: string) => { const p = M.players.get(pid)!; return SEASONS.some((s) => p.seasons[String(s) as '2024'].onRoster && p.seasons[String(s) as '2024'].acq === c && (!M.A.life.cohorts[s] || M.A.life.cohorts[s].includes(pid))); };

/* ---------------------------------------------------------------- 26-27 book helpers (Drive program screens) */
export const bookEps = (M: Model) => M.episodes.filter((e) => e.kind === 'FCST26' || (e.kind === 'BUYOUT' && e.season === 2026));
export function bookMonths(M: Model): Record<string, number> { const m: Record<string, number> = {}; for (const e of bookEps(M)) for (const [k, v] of Object.entries(e.months || {})) m[k] = (m[k] || 0) + v; return m; }
export const trMonth = (M: Model, k: string): TraceItem[] => bookEps(M).filter((e) => (e.months || {})[k]).map((e) => ({ pid: e.pid, eid: e.id, amount: e.months[k] }));
export const egBucket = (bs: string) => (bs === 'CB' || bs === 'S' || bs === 'DB' ? 'DB' : bs === 'PK' || bs === 'P' || bs === 'SN' ? 'Specialists' : bs);

/* ---------------------------------------------------------------- small shared views */
export const seasonOpts: [number, string][] = [[2024, '2024'], [2025, '2025'], [2026, '2026']];
export const FlowCap = ({ f }: { f: Flow }) => <CapStack segs={[{ k: 'Departed', v: f.depCap, color: '#ff5a5a' }, { k: 'Returned', v: f.prevCap - f.depCap, color: '#3987e5' }]} total={f.prevCap || 1} />;
export { SEASON_LABEL, HBars, fmt0 };

/* ---------------------------------------------------------------- Drive program helpers (data-derived, no hard-coded figures) */
/** Games scheduled per calendar month (dated rows only). */
export function gamesPerMonth(D: Drive): Record<string, number> {
  const m: Record<string, number> = {}; D.games.schedule.forEach((g) => { if (/^\d{4}-\d\d-\d\d$/.test(g.date)) m[g.date.slice(0, 7)] = (m[g.date.slice(0, 7)] || 0) + 1; }); return m;
}
/** Buyout register rows grouped by status: count, total and the athletes/counterparties involved. */
export function buyoutStatus(D: Drive, status: string) {
  const r = D.buyouts.rows.filter((x) => x[4] === status);
  return { n: r.length, total: sum(r.map((x) => x[2] || 0)), who: r.map((x) => x[0]).join(' · '), with: r.map((x) => `${x[0]} — ${x[1]}`).join(' · ') };
}
