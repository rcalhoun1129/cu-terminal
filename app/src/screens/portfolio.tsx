/* 03 PORTFOLIO */
import { AS_OF_M, POSMAP, SEASONS, SEASON_FY, SEASON_LABEL, TICKERS } from '../engine/constants';
import { acqBucket, inGroup, type Holding, type Model } from '../engine/model';
import { useModel, useStore } from '../state/store';
import { CAT, HBars, Lorenz, Stacked, Treemap, Waterfall, type WStep } from '../ui/charts';
import { chgTxt, Kpi, Money, NavSel, Panel, PLink, Table, Tag, TLink, type Col } from '../ui/components';
import { fmt$, fmt0, fmtM, median, monthLabel, pctf, rank, sum } from '../ui/fmt';
import { allocRows, bandLabel, filtered, FilterBar, RoomTable, seasonOpts, trHold } from './shared';

export function portfolioCols(M: Model, season: number): Col<Holding>[] {
  const hs = M.holdings(season); const tot = sum(hs.map((h) => h.capital));
  const roomTot = (g: string) => sum(hs.filter((h) => h.bs === g).map((h) => h.capital));
  const mat = new Map(M.A.maturity.rows.map((r) => [r.h.pid, r]));
  const pctile = (r: Holding) => rank(M.bandPool(r.bs), r.capital);
  return [
    { l: 'Ticker', v: (r) => M.players.get(r.pid)!.ticker, f: (r) => <span className="mono">{M.players.get(r.pid)!.ticker}</span> },
    { l: 'Player', v: (r) => r.pid, f: (r) => <PLink pid={r.pid} /> }, { l: 'Pos', k: 'pos' }, { l: 'Group', k: 'bs' },
    { l: 'Role (band)', v: (r) => r.capital, f: (r) => M.bandOf(r.bs, r.capital), raw: (r) => M.bandOf(r.bs, r.capital) },
    { l: 'Acq', v: (r) => r.acq, f: (r) => <>{acqBucket(r.acq)}{r.early && <> <span className="tag">EARLY</span></>}</> },
    { l: 'CAPS', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={trHold(M, [r], season)} label={r.pid + ' ' + SEASON_FY[season]} />, raw: (r) => r.capital.toFixed(2) },
    { l: 'Portfolio %', n: true, v: (r) => r.capital / tot, f: (r) => pctf(r.capital / tot, 2) },
    { l: 'Position %', n: true, v: (r) => r.capital / roomTot(r.bs), f: (r) => pctf(r.capital / roomTot(r.bs)) },
    { l: 'Contract mo.', n: true, v: (r) => +(r.term as number) || 0, f: (r) => r.term ?? '—' },
    { l: 'Roster mo.', n: true, t: 'Seasons on official CU rosters 2024–26 × 12 (season grain)', v: (r) => M.A.life.presence.get(r.pid)!.length * 12, f: (r) => M.A.life.presence.get(r.pid)!.length * 12 || '—' },
    { l: 'Cap / month', n: true, v: (r) => r.perMonth || 0, f: (r) => fmtM(r.perMonth) },
    { l: 'Elig', f: (r) => M.players.get(r.pid)!.elig || '', v: (r) => M.players.get(r.pid)!.elig || '' },
    { l: 'Maturity', v: (r) => mat.get(r.pid)?.final || '', f: (r) => { const m = mat.get(r.pid); return season === 2026 && m && m.final ? monthLabel(m.final) : '—'; } },
    { l: 'Status', v: (r) => (r.inSeason ? 1 : 0), f: (r) => (r.inSeason ? <span className="up">ROSTER</span> : r.early ? <span className="t2">EARLY ENROLL</span> : <span className="warn">OFF-ROSTER</span>) },
    { l: 'Pctile', n: true, v: (r) => pctile(r) || 0, f: (r) => { const v = pctile(r); return isFinite(v) ? 'P' + v.toFixed(0) : '—'; } },
    { l: 'Conf', f: (r) => <Tag conf={r.conf} />, v: (r) => r.conf },
  ];
}

export function Roster() {
  const M = useModel(); const F = useStore((s) => s.filters); const band = useStore((s) => s.band); const s = F.season;
  const rows = filtered(M, F, s).sort((a, b) => b.capital - a.capital);
  return <>
    <div className="ph"><h1>Active Roster · Portfolio</h1><span className="q">One row per athlete · {SEASON_LABEL[s]} · {rows.length} holdings · {fmtM(sum(rows.map((r) => r.capital)))}</span></div><FilterBar />
    <Panel title="Holdings" oda="OBSERVE"><Table cols={portfolioCols(M, s)} rows={rows} opts={{ tall: true, go: (r) => '#/player/' + encodeURIComponent(r.pid), note: 'Role = CU historical band for the position (' + bandLabel(band) + '). It locates the price only and is not a judgment of the athlete.' }} /></Panel>
  </>;
}

export function Rooms() {
  const M = useModel();
  return <>
    <div className="ph"><h1>Position Rooms</h1><span className="q">Each room is a portfolio</span></div>
    <div className="tiles">{TICKERS.map((T) => { const m = M.A.market[T.g][2026]; const c = M.A.conc[2026].byPos[T.g];
      return <div key={T.t} className="tile" data-go={`#/room/${T.g}`}><div className="tt"><span className="warn">{T.g}</span><span className="muted">{T.t}</span></div><div className="iv">{fmtM(m.roomCapital)}</div>
        <div className="rw"><span>{m.roomCount} players</span><span>med {fmtM(m.median)}</span></div><div className="rw"><span>top-1 {pctf(c.top1, 0)}</span><span>churn {pctf(M.A.flow[2026][T.g].capitalChurn, 0)}</span></div></div>; })}</div>
  </>;
}

export function Room({ args }: { args: string[] }) {
  const M = useModel(); const g0 = args[0] || 'OL'; const T = TICKERS.find((t) => t.g === g0) || TICKERS[4]; const g = g0;
  const m = M.A.market[g][2026], c = M.A.conc[2026].byPos[g], f = M.A.flow[2026][g];
  const inRoom = (pid: string) => { const p = M.players.get(pid)!; return inGroup({ bs: POSMAP[(p.seasons['2026'].pos || p.seasons['2025'].pos) as string] }, g); };
  const km = M.A.life.km(inRoom), kmc = M.A.life.km(inRoom, true);
  const room = m.room.filter((h) => h.capital > 0).sort((a, b) => b.capital - a.capital);
  const repl = median(SEASONS.flatMap((s) => M.obs(s, g).filter((x) => x.h.acq !== 'RETAINED').map((x) => x.v)));
  const exiting = M.A.maturity.rows.filter((r) => inGroup(r.h, g) && r.final && r.final <= '2026-12' && r.final > AS_OF_M);
  return <>
    <div className="ph"><h1>{T.name} portfolio</h1><TLink g={g} /><span className="q">FY26-27 · <NavSel prefix="#/room/" opts={TICKERS.map((t) => [t.g, t.g])} value={g} /></span></div>
    <div className="grid g6">
      <Kpi label="Total capital" value={<Money v={m.roomCapital} items={trHold(M, m.room, 2026)} label={g + ' room'} />} delta={chgTxt(M.A.market[g][2025].roomCapital, m.roomCapital)} prior={'2025 ' + fmtM(M.A.market[g][2025].roomCapital)} />
      <Kpi label="Player count" value={m.roomCount} prior={`${m.paid} core-paid`} />
      <Kpi label="Average / Median" value={`${fmtM(m.mean)} / ${fmtM(m.median)}`} prior={'N=' + m.n} />
      <Kpi label="Top asset" value={c.lead ? <a href={`#/player/${encodeURIComponent(c.lead.pid)}`} style={{ fontSize: 13 }}>{c.lead.pid}</a> : '—'} prior={c.lead ? fmtM(c.lead.capital) + ' · ' + pctf(c.top1) + ' of room' : ''} />
      <Kpi label="Concentration top-3" value={pctf(c.top3)} prior={'top-1 ' + pctf(c.top1)} />
      <Kpi label="Half-life (roster / capital)" value={<span style={{ fontSize: 13 }}>{km.half} / {kmc.half}</span>} prior={`retention ${pctf(f.persistence)} of capital`} />
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Proportional capital" oda="OBSERVE"><Treemap h={280} items={room.map((h) => ({ label: M.players.get(h.pid)!.ticker.split('.')[0], v: h.capital, go: '#/player/' + encodeURIComponent(h.pid), tip: `${h.pid} · ${fmt0(h.capital)} · ${acqBucket(h.acq)} · band ${M.bandOf(g, h.capital)}` }))} /></Panel>
      <Panel title="Replacement requirement" oda="ASSESS">
        <dl className="kv"><dt>Contracts ending by Dec-26</dt><dd>{exiting.length}</dd><dt>Capital attached</dt><dd>{fmtM(sum(exiting.map((r) => r.h.capital)))}</dd><dt>Historical replacement median ({g})</dt><dd>{fmtM(repl)}</dd>
          <dt>Indicative requirement (count × median)</dt><dd>{fmtM(exiting.length * repl)}</dd><dt>Retention rate (roster, 12 mo)</dt><dd>{pctf(km.s12)}</dd><dt>2025 capital retained in 2026</dt><dd>{pctf(f.persistence)}</dd></dl>
        <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>Indicative only: the count of expiring contracts × the historical median price of new acquisitions at {g}. It is not a recommendation.</div>
      </Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Room holdings"><RoomTable M={M} room={room} /></Panel></div>
  </>;
}

const GREYS = ['#6b717c', '#8a8f98', '#4b5059', '#a3a8b1', '#2f3540', '#c3c2b7', '#383835', '#5b6270', '#9aa0aa'];
export function Allocation() {
  const M = useModel(); const cur = allocRows(M, 2026);
  const keys = TICKERS.filter((t) => !t.composite).map((t) => t.g).concat(['ATH', 'UNK']).filter((g) => SEASONS.some((s) => M.holdings(s).some((h) => h.bs === g && h.capital > 0)));
  const shares = (s: number) => { const hs = M.holdings(s); const tot = sum(hs.map((h) => h.capital)); return Object.fromEntries(keys.map((g) => [g, sum(hs.filter((h) => h.bs === g).map((h) => h.capital)) / tot])) as Record<string, number>; };
  const sh: Record<number, Record<string, number>> = { 2024: shares(2024), 2025: shares(2025), 2026: shares(2026) };
  const colors = keys.map((_, i) => (i < 8 ? CAT[i] : GREYS[i - 8]));
  const yrows = keys.map((g) => cur.find((x) => x.g === g) || { g, v: 0, prev: sum(M.holdings(2025).filter((h) => h.bs === g).map((h) => h.capital)) });
  return <>
    <div className="ph"><h1>Capital Allocation</h1><span className="q">Where is it allocated · how has it moved</span></div>
    <div className="grid g2">
      <Panel title="Current capital by position · FY26-27"><HBars rows={cur.map((r) => ({ label: r.g, value: r.v, go: '#/room/' + r.g, sub: pctf(r.share), tip: `${r.T.name}: ${fmt0(r.v)}` }))} /></Panel>
      <Panel title="Historical allocation · share of capital" foot="2024 = collective scheduled payments; 2025–26 = institutional CAPS. CB/S relabelled DB on the 2026 roster.">
        <Stacked rows={SEASONS.map((s) => ({ label: String(s), v: Object.fromEntries(keys.map((g) => [g, sh[s][g]])) }))} keys={keys} colors={colors} fmt={(v) => pctf(v, 0)} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="YoY change · dollars and share"><Table rows={yrows} opts={{ go: (r) => '#/room/' + r.g }} cols={[
      { l: 'Position', f: (r) => <TLink g={r.g} />, v: (r) => r.g },
      ...[2024, 2025, 2026].map((s) => ({ l: `${s} share`, n: true, v: (r: (typeof yrows)[number]) => sh[s][r.g], f: (r: (typeof yrows)[number]) => pctf(sh[s][r.g]) })),
      { l: 'Δ share (pts)', n: true, v: (r) => sh[2026][r.g] - sh[2025][r.g], f: (r) => { const d = (sh[2026][r.g] - sh[2025][r.g]) * 100; return <span className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>; } },
      { l: 'FY25-26 $', n: true, v: (r) => r.prev, f: (r) => fmtM(r.prev) }, { l: 'FY26-27 $', n: true, v: (r) => r.v, f: (r) => fmtM(r.v) },
      { l: 'Δ $', n: true, v: (r) => r.v - r.prev, f: (r) => <span className={r.v >= r.prev ? 'up' : 'down'}>{fmtM(r.v - r.prev)}</span> }]} /></Panel></div>
    <div style={{ marginTop: 8 }}><Panel title="Where did the money go? · capital flow" oda="ASSESS"><WaterfallBlock M={M} /></Panel></div>
  </>;
}

/** Cap bridge and year bridge (reference waterfallBlock). */
export function waterfallSteps(M: Model) {
  const cap = M.caps[2026];
  const h26 = M.holdings(2026), ret = h26.filter((h) => M.players.get(h.pid)!.seasons['2025'].onRoster || (M.h[2025].has(h.pid) && !M.h[2025].get(h.pid)!.early && M.h[2025].get(h.pid)!.capital > 0));
  const retIds = new Set(ret.map((h) => h.pid)); const neu = h26.filter((h) => !retIds.has(h.pid));
  const byAcq = (k: string) => sum(neu.filter((h) => acqBucket(h.acq) === k).map((h) => h.capital));
  const bo = sum(M.buyouts.filter((b) => b.capsBy['FY26-27']).map((b) => b.capsBy['FY26-27']));
  const prev25 = M.committed[2025]; const dep = sum(M.holdings(2025).filter((h) => !M.h[2026].has(h.pid)).map((h) => h.capital));
  const cont = M.holdings(2025).filter((h) => M.h[2026].has(h.pid)); const contDelta = sum(cont.map((h) => M.h[2026].get(h.pid)!.capital - h.capital));
  const bo25 = sum(M.buyouts.filter((b) => b.season === 2025).map((b) => b.capital));
  const newLedger = sum(h26.filter((h) => !M.h[2025].has(h.pid)).map((h) => h.capital));
  const other = M.committed[2026] - (prev25 - dep - bo25 + contDelta + newLedger + bo);
  const A: WStep[] = ([{ label: 'FY26-27 Cap', v: cap, type: 'start' }, { label: 'Retained players', v: -sum(ret.map((h) => h.capital)) }, { label: 'Portal acquisitions', v: -byAcq('PORTAL') }, { label: 'JUCO acquisitions', v: -byAcq('JUCO') },
    { label: 'HS acquisitions', v: -byAcq('HS') }, { label: 'Other channel', v: -(byAcq('UNKNOWN') + byAcq('RETAINED')) }, { label: 'Buyouts', v: -bo }, { label: 'Remaining capital', v: cap - M.committed[2026], type: 'end' }] as WStep[]).filter((x) => x.type || Math.abs(x.v) > 0);
  const B: WStep[] = [{ label: 'FY25-26 committed', v: prev25, type: 'start' }, { label: 'Departed capital', v: -dep }, { label: 'FY25-26 buyout', v: -bo25 }, { label: 'Continuing Δ', v: contDelta, tip: 'retention re-pricing & amendments' },
    { label: 'New to ledger', v: newLedger }, { label: 'FY26-27 buyout', v: bo }, { label: 'FY26-27 committed', v: M.committed[2026], type: 'end' }];
  return { A, B, other };
}
function WaterfallBlock({ M }: { M: Model }) {
  const { A, B, other } = waterfallSteps(M);
  return <div className="grid g2">
    <div><Waterfall steps={A} w={760} h={260} /><div className="muted" style={{ fontSize: 10.5 }}>Cap bridge: FY26-27 cap → retained / acquired by channel / buyouts → remaining.</div></div>
    <div><Waterfall steps={B} w={760} h={260} /><div className="muted" style={{ fontSize: 10.5 }}>Year bridge FY25-26 → FY26-27 (reconciles to the cent; residual {fmt$(other)}).</div></div>
  </div>;
}

export function Exposure() {
  const M = useModel();
  const share = (s: number) => { const hs = M.holdings(s); const tot = sum(hs.map((h) => h.capital)); return (g: string) => sum(hs.filter((h) => inGroup(h, g)).map((h) => h.capital)) / tot; };
  const s24 = share(2024), s25 = share(2025), s26 = share(2026); const tot26 = sum(M.holdings(2026).map((h) => h.capital));
  const rows = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'SEC', 'PK', 'P', 'SN'].map((g) => ({ g, cur: s26(g), hist: (s24(g) + s25(g)) / 2 })).map((r) => ({ ...r, d: r.cur - r.hist }));
  const sorted = [...rows].sort((a, b) => b.d - a.d);
  return <>
    <div className="ph"><h1>Portfolio Exposure</h1><span className="q">Where am I overexposed · where am I underinvested (vs CU's own 2024–25 average allocation)</span></div>
    <div className="grid g2">
      <Panel title="Current share − historical share (pts)" oda="ASSESS" foot="Positive = overweight vs CU history; negative = underweight. Secondary shown as composite (SEC) because of the 2026 DB relabel.">
        <HBars fmt={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)} rows={sorted.map((r) => ({ label: r.g, value: r.d * 100, color: r.d >= 0 ? 'var(--warn)' : 'var(--info)', sub: `${pctf(r.cur, 1)} vs ${pctf(r.hist, 1)}`, go: '#/room/' + r.g, tip: `${r.g}: ${pctf(r.cur)} now vs ${pctf(r.hist)} 2024–25 avg` }))} /></Panel>
      <Panel title="Exposure table"><Table rows={sorted} cols={[{ l: 'Group', k: 'g' }, { l: 'FY26-27 share', n: true, v: (r) => r.cur, f: (r) => pctf(r.cur) }, { l: '2024–25 avg', n: true, v: (r) => r.hist, f: (r) => pctf(r.hist) },
        { l: 'Δ pts', n: true, v: (r) => r.d, f: (r) => <span className={r.d >= 0 ? 'warn' : 't2'}>{(r.d * 100 >= 0 ? '+' : '') + (r.d * 100).toFixed(1)}</span> },
        { l: 'FY26-27 $', n: true, v: (r) => r.cur * tot26, f: (r) => fmtM(r.cur * tot26) }]} /></Panel>
    </div>
  </>;
}

export function Concentration({ args }: { args: string[] }) {
  const M = useModel(); const fs = useStore((s) => s.filters.season); const s = +(args[0] || fs), c = M.A.conc[s];
  const pos = TICKERS.filter((t) => !t.composite).map((T) => ({ g: T.g, ...c.byPos[T.g] })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  return <>
    <div className="ph"><h1>Capital Concentration</h1><span className="q">{SEASON_LABEL[s]} · <NavSel prefix="#/concentration/" opts={seasonOpts} value={s} /></span></div>
    <div className="grid g4">{([['Top 1', c.top1, 1], ['Top 5', c.top5, 5], ['Top 10', c.top10, 10], ['Top 20', c.top20, 20]] as const).map(([l, v, n]) =>
      <Kpi key={l} label={l + ' share'} value={<Money v={v} items={trHold(M, c.hs.slice(0, n), s)} label={l} fmt={(x) => pctf(x)} />} prior={fmtM(sum(c.hs.slice(0, n).map((h) => h.capital)))} />)}</div>
    <div className="grid g12" style={{ marginTop: 8 }}>
      <Panel title="Lorenz curve" foot="Diagonal = equal distribution across paid players"><Lorenz pts={c.lorenz} /></Panel>
      <Panel title="Concentration by position"><Table rows={pos} cols={[{ l: 'Room', f: (r) => <TLink g={r.g} />, v: (r) => r.g }, { l: 'Capital', n: true, v: (r) => r.total, f: (r) => fmtM(r.total) }, { l: 'Players', n: true, k: 'n' },
        { l: 'Top-1 share', n: true, v: (r) => r.top1 || 0, f: (r) => pctf(r.top1) }, { l: 'Top-3 share', n: true, v: (r) => r.top3 || 0, f: (r) => pctf(r.top3) }, { l: 'Lead asset', f: (r) => (r.lead ? <PLink pid={r.lead.pid} /> : '—') }]} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Largest holdings"><HBars rows={c.hs.slice(0, 20).map((h) => ({ label: M.players.get(h.pid)!.ticker.split('.')[0], value: h.capital, sub: pctf(h.capital / c.tot), go: '#/player/' + encodeURIComponent(h.pid), tip: `${h.pid} · ${h.bs}` }))} /></Panel></div>
  </>;
}

export function Construction() {
  const M = useModel(); const s = useStore((st) => st.filters.season); const T0 = M.settings.threshold;
  const hs = M.holdings(s).filter((h) => h.inSeason || h.early);
  const keys = ['RETAINED', 'PORTAL', 'JUCO', 'HS', 'UNKNOWN']; const bandsK = ['EXCEPTION', 'PREMIUM', 'STARTER', 'ROTATION', 'DEPTH', 'DEVELOPMENT', 'UNPAID'];
  type CRow = { T: (typeof TICKERS)[number]; r: Holding[]; c: Record<string, number> };
  const rows: CRow[] = TICKERS.filter((t) => !t.composite).map((T) => { const r = hs.filter((h) => h.bs === T.g);
    return { T, r, c: { ...Object.fromEntries(keys.map((k) => [k, r.filter((h) => acqBucket(h.acq) === k).length])), ...Object.fromEntries(bandsK.map((k) => [k, r.filter((h) => (k === 'UNPAID' ? h.capital < T0 : h.capital >= T0 && M.bandOf(h.bs, h.capital) === k)).length])) } }; }).filter((r) => r.r.length);
  const onRoster = M.data.rosters[String(s) as '2024'];
  const unpaid = onRoster.filter((x) => !M.h[s].has(x.name) || M.h[s].get(x.name)!.capital < T0);
  const cnt = (k: string): Col<CRow> => ({ l: k, n: true, v: (r) => r.c[k], f: (r) => r.c[k] });
  return <>
    <div className="ph"><h1>Roster Construction</h1><span className="q">{SEASON_LABEL[s]} · {onRoster.length} on official roster · {unpaid.length} without core capital</span></div><FilterBar />
    <div className="grid g2">
      <Panel title="Players by channel"><Table rows={rows} opts={{ csv: true }} cols={[{ l: 'Room', f: (r) => <TLink g={r.T.g} />, v: (r) => r.T.g }, ...keys.map(cnt), { l: 'Total', n: true, f: (r) => r.r.length, v: (r) => r.r.length }]} /></Panel>
      <Panel title="Players by price band (compensated)"><Table rows={rows} opts={{ csv: true }} cols={[{ l: 'Room', f: (r) => <TLink g={r.T.g} />, v: (r) => r.T.g }, ...bandsK.map(cnt)]} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Official roster members without core capital"><Table rows={unpaid} opts={{ maxh: 360 }} cols={[{ l: 'Player', f: (r) => (M.players.has(r.name) ? <PLink pid={r.name} /> : r.name), v: (r) => r.name }, { l: 'Pos', k: 'pos' }, { l: 'Class', k: 'cls' }, { l: 'Prev. school', k: 'school' },
      { l: 'Capital', n: true, v: (r) => M.h[s].get(r.name)?.capital || 0, f: (r) => fmtM(M.h[s].get(r.name)?.capital || 0) }]} /></Panel></div>
  </>;
}

export function Changes() {
  const M = useModel();
  const add = M.holdings(2026).filter((h) => !M.players.get(h.pid)!.seasons['2025'].onRoster && h.capital > 0).sort((a, b) => b.capital - a.capital);
  const ex = M.holdings(2025).filter((h) => h.inSeason && h.capital > 0 && !M.players.get(h.pid)!.seasons['2026'].onRoster).sort((a, b) => b.capital - a.capital);
  const go = (r: Holding) => '#/player/' + encodeURIComponent(r.pid);
  return <>
    <div className="ph"><h1>Roster Changes · 2025 → 2026</h1><span className="q">Adds {add.length} ({fmtM(sum(add.map((h) => h.capital)))}) · exits {ex.length} ({fmtM(sum(ex.map((h) => h.capital)))} FY25-26 capital)</span></div>
    <div className="grid g2">
      <Panel title="Additions (FY26-27 capital)"><Table rows={add} opts={{ maxh: 560, go }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Pos', k: 'bs' }, { l: 'Channel', f: (r) => acqBucket(r.acq), v: (r) => r.acq },
        { l: 'Prev. school', f: (r) => M.players.get(r.pid)!.seasons['2026'].school || '', v: (r) => M.players.get(r.pid)!.seasons['2026'].school || '' }, { l: 'FY26-27', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={trHold(M, [r], 2026)} label={r.pid} /> }]} /></Panel>
      <Panel title="Exits (FY25-26 capital)"><Table rows={ex} opts={{ maxh: 560, go }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Pos', k: 'bs' }, { l: 'Channel in', f: (r) => acqBucket(r.acq) },
        { l: 'RSLA status', f: (r) => M.players.get(r.pid)!.rslaStatus, v: (r) => M.players.get(r.pid)!.rslaStatus }, { l: 'FY25-26', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={trHold(M, [r], 2025)} label={r.pid} /> }]} /></Panel>
    </div>
  </>;
}
