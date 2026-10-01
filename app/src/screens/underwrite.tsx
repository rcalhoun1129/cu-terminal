/* 07 UNDERWRITE */
import { useEffect, type ReactNode } from 'react';
import { SEASONS } from '../engine/constants';
import { acqBucket, inGroup } from '../engine/model';
import { dealImpact, dealMonths, PICK_G, uwCalc } from '../engine/underwrite';
import { store, useModel, useStore, type AppState } from '../state/store';
import { Hist, MonthBars } from '../ui/charts';
import { Kpi, NavSel, Oda, Panel, PLink, Sel, Table, TLink } from '../ui/components';
import { fmt$, fmt0, fmtM, mean, median, monthLabel, pct, pctf, rank, sgn } from '../ui/fmt';
import { bandLabel, Ladder, QuoteBlock } from './shared';

const bandOpts: [string, string][] = [['pooled', 'All seasons'], ['inst', 'Institutional'], ['2026', '2026'], ['2025', '2025'], ['2024', '2024']];
type Opt = string | [string, string];

/** Bind a form field in a store slice (uw / deal / offer); number inputs coerce like the reference. */
function field<K extends 'uw' | 'deal' | 'offer'>(slice: K, k: string, type: string, raw: string) {
  store.set((s) => ({ [slice]: { ...s[slice], [k]: type === 'number' ? +raw : raw } }) as Partial<AppState>);
}
function Inp({ slice, k, value, type = 'number', ...rest }: { slice: 'uw' | 'deal' | 'offer'; k: string; value: unknown; type?: string; step?: string; min?: string; max?: string; placeholder?: string }) {
  return <input className="inp" type={type} value={String(value ?? '')} onChange={(e) => field(slice, k, type, e.target.value)} {...rest} />;
}
function Pick({ slice, k, value, opts }: { slice: 'uw' | 'deal' | 'offer'; k: string; value: unknown; opts: Opt[] }) {
  return <select className="inp" value={String(value)} onChange={(e) => field(slice, k, 'text', e.target.value)}>{opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}</select>;
}
const F = ({ l, children }: { l: string; children: ReactNode }) => <><label>{l}</label>{children}</>;

export function Underwrite({ args }: { args: string[] }) {
  const M = useModel(); const u = useStore((s) => s.uw); const imported = useStore((s) => s.imported); const lowN = M.settings.lowN;
  useEffect(() => { const g = args[0]; if (g && PICK_G.includes(g) && store.get().uw.pos !== g) store.set((s) => ({ uw: { ...s.uw, pos: g } })); }, [args[0]]);
  const r = uwCalc(M, u);
  const players: Opt[] = [['', '— none —'], ...M.holdings(2026).filter((h) => h.capital > 0).sort((a, b) => a.pid.localeCompare(b.pid)).map((h) => [h.pid, `${h.pid} (${h.bs} ${fmtM(h.capital)})`] as [string, string])];
  const priced = u.months === 12 ? u.ask : r.m12;
  return <>
    <div className="ph"><h1>Buy-Side Underwriter</h1><span className="q">OBSERVE the market · ASSESS the purchase · DECIDE the capital. The tool provides evidence; it does not make the decision.</span></div>
    <div className="grid g12">
      <section className="pn"><h3><span>Proposed purchase</span><Oda which="ASSESS" /></h3><div className="bd"><div className="frm">
        <F l="Player"><input className="inp" value={u.name || ''} placeholder="Prospect name (optional)" onChange={(e) => field('uw', 'name', 'text', e.target.value)} /></F>
        <F l="Position"><Pick slice="uw" k="pos" value={u.pos} opts={PICK_G} /></F>
        <F l="Acquisition type"><Pick slice="uw" k="acq" value={u.acq} opts={['PORTAL', 'HS', 'JUCO', 'RETAINED']} /></F>
        <F l="Expected role"><Pick slice="uw" k="role" value={u.role} opts={['DEVELOPMENT', 'DEPTH', 'ROTATION', 'STARTER', 'PREMIUM', 'EXCEPTION']} /></F>
        <F l="Current ask ($)"><Inp slice="uw" k="ask" value={u.ask} step="5000" /></F>
        <F l="Contract months"><Inp slice="uw" k="months" value={u.months} min="1" max="36" /></F>
        <F l="Start month"><Inp slice="uw" k="start" value={u.start} type="month" /></F>
        <F l="Remaining eligibility"><Pick slice="uw" k="elig" value={u.elig} opts={['1', '2', '3', '4', '5']} /></F>
        <F l="Third-party component ($)"><Inp slice="uw" k="third" value={u.third} step="5000" /></F>
        <F l="Player being replaced"><Pick slice="uw" k="replacing" value={u.replacing} opts={players} /></F>
        <F l="Market basis"><Pick slice="uw" k="basis" value={u.basis} opts={[['pooled', 'All seasons pooled'], ['inst', 'Institutional 2025–26'], ['2026', '2026'], ['2025', '2025'], ['2024', '2024']]} /></F>
      </div></div></section>
      <div id="uwout"><div className="grid g2">
        <Panel title={'Historical market · ' + r.g} n={r.pool.length} low={r.pool.length < lowN} oda="OBSERVE">
          <div className="kv3"><div className="stat"><small>Median</small><b>{fmtM(r.st.median)}</b></div><div className="stat"><small>P25</small><b>{fmtM(r.st.p25)}</b></div><div className="stat"><small>P75</small><b>{fmtM(r.st.p75)}</b></div>
            <div className="stat"><small>P90</small><b>{fmtM(r.st.p90)}</b></div><div className="stat"><small>{u.acq} median</small><b>{fmtM(r.chMed)}</b> <span className="muted">N={r.chN}</span></div><div className="stat"><small>Current room median</small><b>{fmtM(r.roomMed)}</b></div></div>
          <Hist vals={r.pool} bins={12} w={380} h={150} mark={priced} /></Panel>
        <Panel title="Assessment" oda="ASSESS">
          <dl className="kv"><dt>Ask</dt><dd>{fmt0(u.ask)}</dd><dt>12-month equivalent</dt><dd>{fmt0(r.m12)}</dd><dt>Capital / month</dt><dd>{fmt0(r.perMo)}</dd>
            <dt>Proposed market percentile</dt><dd>{isFinite(r.pct) ? 'P' + r.pct.toFixed(0) : '—'}</dd><dt>Historical band at this price</dt><dd>{r.band}</dd><dt>Expected role (management)</dt><dd>{u.role}</dd>
            <dt>Acquisition median / retention median</dt><dd>{fmtM(r.acqMed)} / {fmtM(r.retMed)}</dd><dt>Replacement cost (hist. acq. median)</dt><dd>{fmtM(r.replCost)}</dd>
            {u.third ? <><dt>Total economic package (incl. third-party)</dt><dd>{fmtM(u.ask + u.third)}</dd></> : null}
            <dt>Roster-month value (12M eq ÷ 12)</dt><dd>{fmt0(r.m12 / 12)}</dd></dl>
          {u.role !== r.band && r.band !== '—' && <div className="note" style={{ marginTop: 6 }}>The ask prices this player in the <b>{r.band}</b> band, but management expects a <b>{u.role}</b> role.</div>}</Panel>
        <Panel title="Internal deal quote" oda="DECIDE"><QuoteBlock M={M} g={r.g} q={r.q} ask={priced} /></Panel>
        <Panel title="Capital impact preview · FY26-27" oda="DECIDE" foot={imported ? '' : 'Base = Spring-26 forecast snapshot of FY26-27'}>
          <dl className="kv"><dt>Current cap</dt><dd>{fmt$(M.caps[2026])}</dd><dt>Current committed</dt><dd>{fmt$(M.committed[2026])}</dd><dt>Proposed deal (FY26-27 portion)</dt><dd>{fmt$(r.fy.fy2627)}</dd>
            {r.rep && <><dt>Released: {r.rep.pid}</dt><dd className="up">−{fmt$(r.rep.capital)}</dd></>}
            <dt>New committed</dt><dd>{fmt$(r.newCom)}</dd><dt>New utilization</dt><dd>{pctf(r.newUtil)}</dd><dt>New dry powder</dt><dd className={r.newDry < 0 ? 'down' : 'up'}>{fmt$(r.newDry)}</dd><dt>Future obligation FY27-28+</dt><dd>{fmt$(r.fy.fy2728 + r.fy.later)}</dd></dl><hr className="sep" />
          <dl className="kv"><dt>Current {r.g} room capital</dt><dd>{fmtM(M.A.market[r.g][2026].roomCapital)}</dd><dt>Proposed {r.g} room capital</dt><dd>{fmtM(r.roomCap)}</dd><dt>Position share now → after</dt><dd>{pctf(r.roomShareOld)} → {pctf(r.roomShareNew)}</dd></dl></Panel>
      </div></div>
    </div>
  </>;
}

export function PosUnderwrite() {
  const M = useModel(); const band = useStore((s) => s.band); const bid = useStore((s) => s.assume.bid);
  const rows = PICK_G.map((g) => { const b = M.bands(g); return { g, n: b.n, st: b.st, q: M.quote(g) }; });
  const qc = (k: 'bid' | 'target' | 'auth' | 'walk') => (r: (typeof rows)[number]) => (r.q ? <span className="warn">{fmtM(r.q[k])}</span> : '—');
  return <>
    <div className="ph"><h1>Position Underwriter</h1><span className="q">Every position's historical bands and internal quote · {bandLabel(band)}</span></div>
    {bid == null && <div className="note">Quote columns stay blank until management anchors are set in <a href="#/assumptions" className="warn">Assumptions</a>.</div>}
    <Panel title="Position quotes" oda="DECIDE" right={<Sel path="band" opts={bandOpts} value={band} />}><Table rows={rows} opts={{ go: (r) => '#/underwrite/' + r.g }} cols={[
      { l: 'Pos', f: (r) => <TLink g={r.g} />, v: (r) => r.g }, { l: 'N', n: true, k: 'n' }, { l: 'Dev < P25', n: true, f: (r) => fmtM(r.st.p25) }, { l: 'Depth P40', n: true, f: (r) => fmtM(r.st.p40) },
      { l: 'Rotation P60', n: true, f: (r) => fmtM(r.st.p60) }, { l: 'Starter P75', n: true, f: (r) => fmtM(r.st.p75) }, { l: 'Premium P90', n: true, f: (r) => fmtM(r.st.p90) }, { l: 'Max', n: true, f: (r) => fmtM(r.st.max) },
      { l: 'BID', n: true, f: qc('bid') }, { l: 'TARGET', n: true, f: qc('target') }, { l: 'AUTH', n: true, f: qc('auth') }, { l: 'WALK', n: true, f: qc('walk') }]} /></Panel>
  </>;
}

export function RetRep({ args }: { args: string[] }) {
  const M = useModel(); const g = args[0] || 'OL';
  const F2 = [2025, 2026].map((s) => M.A.flow[s][g]); const f = M.A.flow[2026][g];
  const retain = median(F2.flatMap((x) => x.retCur.map((h) => h.capital))), acq = median(F2.flatMap((x) => x.newAcq.map((h) => h.capital)));
  const prem = median(F2.flatMap((x) => x.premList.map((p) => p.chg)));
  const retH = M.holdings(2026).filter((h) => inGroup(h, g) && h.acq === 'RETAINED');
  const eligAvg = mean(retH.map((h) => +String(M.players.get(h.pid)!.elig || '').split('-')[1]).filter(isFinite));
  const termAcq = mean(M.holdings(2026).filter((h) => inGroup(h, g) && h.acq !== 'RETAINED' && +(h.term as number) > 0).map((h) => +(h.term as number)));
  const all = PICK_G.map((g2) => { const F = [2025, 2026].map((s) => M.A.flow[s][g2]); return { g: g2, r: median(F.flatMap((x) => x.retCur.map((h) => h.capital))), a: median(F.flatMap((x) => x.newAcq.map((h) => h.capital))), p: median(F.flatMap((x) => x.premList.map((p) => p.chg))) }; });
  const newMed = (a: string) => fmtM(median(F2.flatMap((x) => x.newAcq.filter((h) => h.acq === a).map((h) => h.capital))));
  return <>
    <div className="ph"><h1>Retention vs Acquisition</h1><TLink g={g} /><span className="q"><NavSel prefix="#/retrep/" opts={PICK_G} value={g} /> · pooled 2025 + 2026 transitions</span></div>
    <div className="grid g3">
      <Panel title="Retention market" n={F2.reduce((a, x) => a + x.retCur.length, 0)}><dl className="kv"><dt>Median retained capital</dt><dd>{fmtM(retain)}</dd><dt>Renewal premium (median)</dt><dd className={prem >= 0 ? 'up' : 'down'}>{sgn(prem)}</dd>
        <dt>Avg remaining seasons (RSLA elig)</dt><dd>{isFinite(eligAvg) ? eligAvg.toFixed(1) : '—'}</dd><dt>Avg roster tenure</dt><dd>{(mean(retH.map((h) => M.A.life.presence.get(h.pid)!.length)) * 12 || 0).toFixed(0)} mo</dd></dl></Panel>
      <section className="pn"><h3><span>Retention vs replace spread</span><Oda which="ASSESS" /></h3><div className="bd" style={{ textAlign: 'center' }}>
        <div className={`bigidx ${acq - retain > 0 ? 'down' : 'up'}`} style={{ fontSize: 30 }}>{isFinite(acq - retain) ? (acq - retain >= 0 ? '+' : '') + fmtM(acq - retain) : '—'}</div><div className="t2">median new acquisition − median retained</div>
        <div className="bigchg" style={{ marginTop: 8 }}>{isFinite(acq / retain) ? (acq / retain).toFixed(2) + '×' : '—'}</div><div className="muted">replacement multiple</div></div></section>
      <Panel title="Acquisition market" n={F2.reduce((a, x) => a + x.newAcq.length, 0)}><dl className="kv"><dt>Portal median</dt><dd>{newMed('PORTAL')}</dd><dt>HS median</dt><dd>{newMed('HS')}</dd>
        <dt>Replacement premium (2026)</dt><dd>{isFinite(f.replPremium) ? fmtM(f.replPremium) + ' (' + sgn(f.replPremiumPct) + ')' : '—'}</dd><dt>Average contract term (2026 new)</dt><dd>{isFinite(termAcq) ? termAcq.toFixed(1) + ' mo' : '—'}</dd></dl></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="All positions"><Table rows={all} cols={[{ l: 'Pos', f: (r) => <a href={`#/retrep/${r.g}`} className="warn mono">{r.g}</a>, v: (r) => r.g },
      { l: 'Retained median', n: true, v: (r) => r.r || 0, f: (r) => fmtM(r.r) }, { l: 'Acquired median', n: true, v: (r) => r.a || 0, f: (r) => fmtM(r.a) },
      { l: 'Spread', n: true, v: (r) => r.a - r.r || 0, f: (r) => (isFinite(r.a - r.r) ? <span className={r.a > r.r ? 'down' : 'up'}>{fmtM(r.a - r.r)}</span> : '—') }, { l: 'Renewal premium', n: true, v: (r) => r.p || 0, f: (r) => sgn(r.p) }]} /></Panel></div>
  </>;
}

export function Replace({ args }: { args: string[] }) {
  const M = useModel(); const T0 = M.settings.threshold;
  const list = M.holdings(2026).filter((h) => h.capital >= T0).sort((a, b) => b.capital - a.capital);
  const pid = args[0] || list[0]?.pid; const h = pid ? M.h[2026].get(pid) || M.h[2025].get(pid) : undefined;
  if (!h) return <div className="note">Player has no institutional capital.</div>;
  const g = h.bs, acqPool = SEASONS.flatMap((s) => M.obs(s, g).filter((x) => x.h.acq !== 'RETAINED').map((x) => x.v)), pool = M.bandPool(g);
  const est = median(acqPool), p75 = pct(acqPool, 75), dry = M.caps[2026] - M.committed[2026]; const room = M.A.market[g][2026].roomCapital;
  const hist = [2025, 2026].flatMap((s) => M.A.flow[s][g].newAcq.map((x) => ({ ...x, s }))).sort((a, b) => b.capital - a.capital);
  const sc = [{ k: 'RETAIN', cap: h.capital, note: 'Hold current agreement / renew at current capital' }, { k: 'REPLACE (median)', cap: est, note: 'Acquire at historical acquisition median' },
    { k: 'REPLACE (P75)', cap: p75, note: 'Acquire at historical acquisition P75' }, { k: 'DO NOT REPLACE', cap: 0, note: 'Release the capital; the room carries one fewer paid player' }];
  return <>
    <div className="ph"><h1>Replacement Terminal</h1><span className="q"><NavSel prefix="#/replace/" opts={list.map((x) => [x.pid, `${x.pid} · ${x.bs} · ${fmtM(x.capital)}`])} value={pid} /></span></div>
    <div className="grid g6">
      <Kpi label="Exiting player" value={<a href={`#/player/${encodeURIComponent(pid!)}`} style={{ fontSize: 13 }}>{pid}</a>} prior={g + ' · ' + acqBucket(h.acq)} />
      <Kpi label="Current capital" value={fmtM(h.capital)} /><Kpi label="Hist. position median" value={fmtM(median(pool))} prior={'N=' + pool.length} />
      <Kpi label="Hist. replacement median" value={fmtM(est)} prior={'N=' + acqPool.length + ' acquisitions'} /><Kpi label="P75 replacement" value={fmtM(p75)} /><Kpi label="Available internal capital" value={fmtM(dry)} prior="FY26-27 dry powder" />
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Scenario economics (no automatic recommendation)" oda="DECIDE" foot="Room / portfolio impact uses FY26-27 annual capital; timing of a mid-year replacement would change the FY portion (use the Deal Builder).">
        <Table rows={sc} opts={{ csv: false }} cols={[{ l: 'Scenario', k: 'k' }, { l: 'Capital', n: true, v: (r) => r.cap, f: (r) => fmtM(r.cap) }, { l: 'Δ vs current', n: true, f: (r) => <span className={r.cap - h.capital <= 0 ? 'up' : 'down'}>{fmtM(r.cap - h.capital)}</span> },
          { l: 'Room capital after', n: true, f: (r) => fmtM(room - h.capital + r.cap) }, { l: 'Portfolio committed after', n: true, f: (r) => fmtM(M.committed[2026] - h.capital + r.cap) }, { l: 'Dry powder after', n: true, f: (r) => fmtM(dry + h.capital - r.cap) }, { l: '', k: 'note', cls: 'wrap' }]} /></Panel>
      <Panel title={'Historical replacement transactions · ' + g}><Table rows={hist} opts={{ maxh: 300 }} cols={[{ l: 'Season', k: 's' }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Channel', f: (r) => acqBucket(r.acq) },
        { l: 'Capital', n: true, v: (r) => r.capital, f: (r) => fmtM(r.capital) }, { l: 'Still on roster 2026', f: (r) => (M.players.get(r.pid)!.seasons['2026'].onRoster ? 'yes' : 'no') }]} /></Panel>
    </div>
  </>;
}

export function Deal() {
  const M = useModel(); const D = useStore((s) => s.deal);
  const x = dealImpact(M, D);
  const toggle = () => store.set((s) => ({ deal: { ...s.deal, pays: s.deal.pays ? null : dealMonths(s.deal).slice(0, 12).map(([, v]) => Math.round(v)) } }));
  const setPay = (i: number, v: number) => store.set((s) => { const pays = [...(s.deal.pays || [])]; pays[i] = v; return { deal: { ...s.deal, pays } }; });
  return <>
    <div className="ph"><h1>Deal Structure Workbench</h1><span className="q">Month-by-month payment design → FY impact, position impact, percentile, band</span></div>
    <div className="grid g12">
      <section className="pn"><h3><span>Structure</span><Oda which="DECIDE" /></h3><div className="bd"><div className="frm">
        <F l="Position"><Pick slice="deal" k="pos" value={D.pos} opts={PICK_G} /></F>
        <F l="Total compensation"><Inp slice="deal" k="total" value={D.total} step="5000" /></F>
        <F l="Start month"><Inp slice="deal" k="start" value={D.start} type="month" /></F><F l="Contract months"><Inp slice="deal" k="months" value={D.months} min="1" max="36" /></F>
        <F l="Fall allocation %"><Inp slice="deal" k="fall" value={D.fall} min="0" max="100" /></F><F l="Incentives (Dec)"><Inp slice="deal" k="inc" value={D.inc} step="5000" /></F>
        <F l="Buyout"><Inp slice="deal" k="buyout" value={D.buyout} step="5000" /></F></div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="iconbtn" onClick={toggle}>{D.pays ? 'Use formula schedule' : 'Edit payments manually'}</button></div></div></section>
      <div id="dealout"><div className="grid g2">
        <Panel title="Monthly schedule"><table className="t"><thead><tr><th>Month</th><th className="n">Payment</th></tr></thead><tbody>{x.ms.map(([k, v], i) => <tr key={k}><td>{monthLabel(k)}</td>
          <td className="n">{D.pays && i < 12 ? <input className="inp" style={{ width: 110, textAlign: 'right' }} type="number" value={Math.round(v)} onChange={(e) => setPay(i, +e.target.value)} /> : fmt0(v)}</td></tr>)}</tbody></table></Panel>
        <Panel title="Impact"><dl className="kv"><dt>Fall % / Spring %</dt><dd>{pctf(x.fall / (x.fall + x.spr || 1), 0)} / {pctf(x.spr / (x.fall + x.spr || 1), 0)}</dd><dt>FY26-27 impact</dt><dd>{fmt0(x.fy)}</dd><dt>Future-year obligations</dt><dd>{fmt0(x.fut)}</dd><dt>Incentive</dt><dd>{fmt0(D.inc)}</dd>
          <dt>Monthly impact (avg paid month)</dt><dd>{fmt0((x.fy + x.fut - D.buyout) / Math.max(1, x.paidMonths))}</dd><dt>12-month equivalent</dt><dd>{fmt0(x.m12)}</dd><dt>Cap utilization after</dt><dd>{pctf(x.com / M.caps[2026])}</dd>
          <dt>Dry powder after</dt><dd className={M.caps[2026] - x.com < 0 ? 'down' : 'up'}>{fmt0(M.caps[2026] - x.com)}</dd><dt>{D.pos} room after</dt><dd>{fmtM(x.room)}</dd>
          <dt>Position percentile (12M eq)</dt><dd>{isFinite(x.pct) ? 'P' + x.pct.toFixed(0) : '—'}</dd><dt>Underwriting band</dt><dd>{x.band}</dd></dl></Panel>
        <div className="span2"><Panel title="Payment curve"><MonthBars entries={x.ms.map(([k, v]) => ({ k, v }))} /></Panel></div>
      </div></div>
    </div>
  </>;
}

export function Offer() {
  const M = useModel(); const O = useStore((s) => s.offer);
  const m12 = (O.ask / O.months) * 12, b = M.bands(O.pos), q = M.quote(O.pos), band = M.bandOf(O.pos, m12); const pr = rank(M.bandPool(O.pos), m12);
  return <>
    <div className="ph"><h1>Offer Calculator</h1><span className="q">Ask → percentile, band and internal quote</span></div>
    <div className="grid g12">
      <section className="pn"><h3><span>Ask</span></h3><div className="bd"><div className="frm"><F l="Position"><Pick slice="offer" k="pos" value={O.pos} opts={PICK_G} /></F><F l="Ask ($)"><Inp slice="offer" k="ask" value={O.ask} step="5000" /></F><F l="Months"><Inp slice="offer" k="months" value={O.months} /></F></div></div></section>
      <div id="ofout"><div className="grid g2">
        <Panel title={'Price ladder · ' + O.pos} n={b.n}><Ladder M={M} g={O.pos} b={b} hit={band} /></Panel>
        <Panel title="Quote" oda="DECIDE"><QuoteBlock M={M} g={O.pos} q={q} ask={m12} />
          <dl className="kv" style={{ marginTop: 8 }}><dt>12-month equivalent</dt><dd>{fmt0(m12)}</dd><dt>Percentile</dt><dd>{isFinite(pr) ? 'P' + pr.toFixed(0) : '—'}</dd><dt>Band</dt><dd>{band}</dd></dl></Panel>
      </div></div>
    </div>
  </>;
}

export function Walkaway() {
  const M = useModel(); const S = M.settings;
  const ex = SEASONS.flatMap((s) => M.holdings(s).filter((h) => h.capital >= S.threshold).map((h) => ({ ...h, s, p90: pct(M.bandPool(h.bs), 90) })))
    .filter((h) => isFinite(h.p90) && M.bandPool(h.bs).length >= S.lowN && h.capital > h.p90).sort((a, b) => b.capital - a.capital);
  const rows = PICK_G.map((g) => ({ g, ...M.bands(g), q: M.quote(g) }));
  return <>
    <div className="ph"><h1>Walk-Away Analysis</h1><span className="q">Where should the walk-away be? · historical exception deals shown for context</span></div>
    <Panel title="Walk-away by position" oda="DECIDE"><Table rows={rows} opts={{ go: () => '#/offer' }} cols={[{ l: 'Pos', f: (r) => <TLink g={r.g} /> }, { l: 'N', n: true, k: 'n' }, { l: 'P75', n: true, f: (r) => fmtM(r.st.p75) }, { l: 'P90', n: true, f: (r) => fmtM(r.st.p90) },
      { l: 'Max paid', n: true, f: (r) => fmtM(r.st.max) }, { l: 'WALK (mgmt)', n: true, f: (r) => (r.q ? <span className="warn">{fmtM(r.q.walk)}</span> : <span className="muted">not set</span>) }, { l: 'Exceptions paid above P90', n: true, f: (r) => ex.filter((h) => h.bs === r.g).length }]} /></Panel>
    <div style={{ marginTop: 8 }}><Panel title="Historical exception-level transactions (> position P90, pooled)"><Table rows={ex} cols={[{ l: 'Season', k: 's' }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Pos', k: 'bs' },
      { l: 'Capital', n: true, v: (r) => r.capital, f: (r) => fmtM(r.capital) }, { l: 'P90', n: true, v: (r) => r.p90, f: (r) => fmtM(r.p90) }, { l: 'Premium over P90', n: true, v: (r) => r.capital / r.p90 - 1, f: (r) => sgn(r.capital / r.p90 - 1) },
      { l: 'On 2026 roster', f: (r) => (M.players.get(r.pid)!.seasons['2026'].onRoster ? 'yes' : 'no') }]} /></Panel></div>
  </>;
}
