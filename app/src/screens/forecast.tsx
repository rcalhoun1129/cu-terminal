/* 08 FORECAST */
import { useState } from 'react';
import { AS_OF_M, PICK_G, SEASON_FY, TICKERS } from '../engine/constants';
import { inGroup } from '../engine/model';
import { applyScenario, scenarioBase, scMetrics, type Scenario, type ScenarioOp } from '../engine/scenarios';
import { logAudit, store, useModel, useStore } from '../state/store';
import { HBars, MonthBars } from '../ui/charts';
import { Kpi, Money, NavSel, Oda, Panel, PLink, Sel, Table, TLink } from '../ui/components';
import { fmt$, fmt0, fmtM, monthAdd, monthLabel, monthRange, pctf, sgn, sum } from '../ui/fmt';
import { allocRows, trHold } from './shared';

const fyOf = (k: string) => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m >= 7 ? y : y - 1; };

export function Forecast() {
  const M = useModel(); const imported = useStore((s) => s.imported); const cash = M.A.maturity.cash; const ks = monthRange('2025-07', '2027-07');
  const fyCum: number[] = []; let run = 0, fy: number | null = null; ks.forEach((k) => { const f = fyOf(k); if (f !== fy) { run = 0; fy = f; } run += cash[k] || 0; fyCum.push(run); });
  const cap = [{ fy: 'FY25-26', cap: M.caps[2025], com: M.committed[2025], b: 'RSLA ledger (final/amended)' }, { fy: 'FY26-27', cap: M.caps[2026], com: M.committed[2026], b: imported ? 'Imported current book' : 'Spring-26 forecast snapshot' }, { fy: 'FY27-28', cap: M.caps[2027], com: M.fy2728, b: 'Contractual (estimate cap)' }];
  const ob = M.episodes.filter((e) => e.kind !== 'RSLA' && +(e.capsBy['FY27-28'] || 0) > 0).map((e) => ({ pid: e.pid, v: +e.capsBy['FY27-28'], src: e.src })).sort((a, b) => b.v - a.v);
  return <>
    <div className="ph"><h1>Capital Forecast</h1><span className="q">Scheduled institutional outflows Jul-25 → Jul-27 · white line = cumulative within fiscal year</span></div>
    <div className="grid g4">{[2025, 2026].map((y) => <Kpi key={y} label={SEASON_FY[y] + ' committed'} value={fmtM(M.committed[y])} prior={`cap ${fmtM(M.caps[y])} · avail ${fmtM(M.caps[y] - M.committed[y])}`} />)}
      <Kpi label="FY27-28 committed" value={fmtM(M.fy2728)} prior={`est. cap ${fmtM(M.caps[2027])}`} /><Kpi label="FY27-28 capacity" value={fmtM(M.caps[2027] - M.fy2728)} prior="estimated cap − committed" /></div>
    <div style={{ marginTop: 8 }}><Panel title="Future capital curve" oda="OBSERVE" foot="Existing obligations only. Grey = on or before the as-of date. Projected retention and new acquisitions are modelled in the Scenario Manager.">
      <MonthBars entries={ks.map((k) => ({ k, v: cash[k] || 0, tip: `${monthLabel(k)}: ${fmt0(cash[k] || 0)} scheduled` }))} mark={AS_OF_M} cum={fyCum} w={900} h={240} /></Panel></div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Fiscal-year capacity"><Table rows={cap} opts={{ csv: false }} cols={[{ l: 'FY', k: 'fy' }, { l: 'Cap', n: true, f: (r) => fmt$(r.cap) }, { l: 'Committed', n: true, f: (r) => fmt$(r.com) },
        { l: 'Remaining capacity', n: true, f: (r) => <span className={r.cap - r.com < 0 ? 'down' : 'up'}>{fmt$(r.cap - r.com)}</span> }, { l: 'Utilization', n: true, f: (r) => pctf(r.com / r.cap) }, { l: 'Basis', k: 'b' }]} /></Panel>
      <Panel title="FY27-28 obligations"><Table rows={ob} cols={[{ l: 'Player', f: (r) => <PLink pid={r.pid} /> }, { l: 'FY27-28', n: true, v: (r) => r.v, f: (r) => fmtM(r.v) }, { l: 'Source', f: (r) => <span className="muted">{r.src}</span> }]} /></Panel>
    </div>
  </>;
}

export function Obligations() {
  const M = useModel();
  const rows = [...M.players.values()].map((p) => { const e = M.epsByPlayer.get(p.id) || []; const f26 = M.playerSeasonCap(p.id, 2026), f27 = sum(e.filter((x) => x.kind !== 'RSLA').map((x) => +(x.capsBy['FY27-28'] || 0))); return { p, f26, f27, tot: f26 + f27 }; }).filter((r) => r.tot > 0).sort((a, b) => b.tot - a.tot);
  return <>
    <div className="ph"><h1>Future Obligations</h1><span className="q">Contractual capital by fiscal year (current FY onward)</span></div>
    <Panel title="Obligation schedule"><Table rows={rows} opts={{ tall: true, go: (r) => '#/player/' + encodeURIComponent(r.p.id) }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.p.id} />, v: (r) => r.p.id }, { l: 'Pos', f: (r) => r.p.lastPos || '', v: (r) => r.p.lastPos },
      { l: 'FY26-27', n: true, v: (r) => r.f26, f: (r) => fmtM(r.f26) }, { l: 'FY27-28', n: true, v: (r) => r.f27, f: (r) => fmtM(r.f27) }, { l: 'Total forward', n: true, v: (r) => r.tot, f: (r) => fmtM(r.tot) }, { l: 'Multi-year', f: (r) => (r.f27 > 0 ? <span className="warn">YES</span> : '') }]} /></Panel>
  </>;
}

export function Maturity({ args }: { args: string[] }) {
  const M = useModel(); const G = useStore((s) => s.filters.pos); const days = args[0] || '';
  const W = M.A.maturity.wall; const lim = days ? (+days <= 30 ? '2026-10' : +days <= 60 ? '2026-11' : +days <= 90 ? '2026-12' : monthAdd(AS_OF_M, Math.ceil(+days / 30))) : null;
  const rows = M.A.maturity.rows.filter((r) => r.final && (!lim || (r.final > AS_OF_M && r.final <= lim))).sort((a, b) => (a.final! > b.final! ? 1 : -1));
  const inG = (r: { h: { bs: string } }) => G === 'ALL' || inGroup(r.h, G);
  const rs = rows.filter(inG); const wb = W.filter((w) => w.b !== 'NONE');
  return <>
    <div className="ph"><h1>Roster Capital Maturity Wall</h1><span className="q">Like a debt maturity schedule · final scheduled payment month of each FY26-27 agreement{days ? ` · filtered ≤ ${days} days` : ''}</span></div>
    <div className="filt"><label>Window</label><NavSel prefix="#/maturity/" opts={[['', 'All'], ['30', '30D'], ['60', '60D'], ['90', '90D'], ['180', '180D'], ['365', '12M'], ['540', '18M']]} value={days} /><label>Position</label><Sel path="f.pos" opts={['ALL', ...PICK_G]} value={G} /></div>
    <div className="grid g2">
      <Panel title="Remaining obligation by maturity bucket" oda="OBSERVE" foot="30D = Oct-26 · 60D = Nov-26 · 90D = Dec-26 · Spring = Jan–May 27 · June · 12M = Jul–Sep 27 (FY27-28) · 18M = through Mar-28">
        <HBars rows={wb.map((w) => ({ label: w.b.replace(' · DEC', ''), value: sum(w.rows.filter(inG).map((r) => r.remaining)), sub: w.rows.filter(inG).length + ' ctr', tip: `${w.b}: remaining scheduled after ${AS_OF_M}` }))} /></Panel>
      <Panel title="Annual capital released at maturity" foot="FY26-27 capital of agreements whose final payment falls in each bucket"><HBars rows={wb.map((w) => ({ label: w.b.replace(' · DEC', ''), value: sum(w.rows.filter(inG).map((r) => r.h.capital)) }))} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Maturing agreements"><Table rows={rs} opts={{ tall: true, go: (r) => '#/player/' + encodeURIComponent(r.h.pid) }} cols={[
      { l: 'Final pay', v: (r) => r.final, f: (r) => monthLabel(r.final!) }, { l: 'Bucket', k: 'bucket' }, { l: 'Player', f: (r) => <PLink pid={r.h.pid} />, v: (r) => r.h.pid }, { l: 'Pos', f: (r) => r.h.bs, v: (r) => r.h.bs },
      { l: 'FY26-27', n: true, v: (r) => r.h.capital, f: (r) => <Money v={r.h.capital} items={trHold(M, [r.h], 2026)} label={r.h.pid} /> }, { l: 'Paid to date (sched.)', n: true, v: (r) => r.paid, f: (r) => fmtM(r.paid) },
      { l: 'Remaining', n: true, v: (r) => r.remaining, f: (r) => fmtM(r.remaining) }, { l: 'FY27-28', n: true, v: (r) => r.fy2728, f: (r) => fmtM(r.fy2728) },
      { l: 'Elig', f: (r) => M.players.get(r.h.pid)!.elig || '' }, { l: 'Class 26', f: (r) => M.players.get(r.h.pid)!.seasons['2026'].cls || '—' }]} /></Panel></div>
  </>;
}

export function RForecast() {
  const M = useModel(); const hs = M.holdings(2026).filter((h) => h.capital > 0); const cls = (pid: string) => M.players.get(pid)!.seasons['2026'].cls || '—';
  const senior = (pid: string) => /5th|6th/.test(cls(pid)) || /^1-1$|^EE$/.test(M.players.get(pid)!.elig || '');
  const byG = TICKERS.filter((t) => !t.composite).map((T) => { const r = hs.filter((h) => h.bs === T.g); const f27 = r.filter((h) => (M.epsByPlayer.get(h.pid) || []).some((e) => e.kind !== 'RSLA' && +(e.capsBy['FY27-28'] || 0) > 0)); const sn = r.filter((h) => senior(h.pid));
    return { T, n: r.length, cap: sum(r.map((h) => h.capital)), f27: f27.length, sen: sn.length, senCap: sum(sn.map((h) => h.capital)) }; }).filter((r) => r.n);
  return <>
    <div className="ph"><h1>Roster Forecast · into 2027</h1><span className="q">Which FY26-27 assets are contractually carried forward and which are in their final eligibility windows</span></div>
    <Panel title="By position" oda="ASSESS" foot="Final-window = 2026 roster class 5th/6th, or RSLA eligibility 1-1 / EE. This is a structural roll-off indicator and does not predict individual decisions.">
      <Table rows={byG} cols={[{ l: 'Pos', f: (r) => <TLink g={r.T.g} /> }, { l: 'Paid assets', n: true, k: 'n' }, { l: 'FY26-27 capital', n: true, v: (r) => r.cap, f: (r) => fmtM(r.cap) }, { l: 'With FY27-28 commitment', n: true, k: 'f27' },
        { l: '5th/6th-year or final-season elig.', n: true, k: 'sen' }, { l: 'Capital in final-window players', n: true, v: (r) => r.senCap, f: (r) => fmtM(r.senCap) }, { l: 'Share expected to roll off', n: true, v: (r) => r.senCap / r.cap, f: (r) => pctf(r.senCap / r.cap) }]} /></Panel>
  </>;
}

/* ---------------------------------------------------------------- scenarios */
function saveScenarios(scenarios: Scenario[], scIdx: number, msg?: string) { store.set({ scenarios, scIdx }, { persist: true }); if (msg) logAudit(msg); }
function pushOp(op: ScenarioOp, guard: string) {
  const { scenarios, scIdx } = store.get(); if (!scIdx) { alert(guard); return; }
  saveScenarios(scenarios.map((s, i) => (i === scIdx ? { ...s, ops: [...s.ops, op] } : s)), scIdx);
}
export function Scenarios() {
  const M = useModel(); const sc = useStore((s) => s.scenarios); const scIdx = useStore((s) => s.scIdx || 0);
  const players = scenarioBase(M).sort((a, b) => a.pid.localeCompare(b.pid));
  const [f, setF] = useState({ name: '', rm: players[0]?.pid || '', setp: players[0]?.pid || '', setv: '', addg: PICK_G[0], addv: '', scg: PICK_G[0], scv: '' });
  const upd = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ms = sc.map((s) => ({ s, m: scMetrics(M, applyScenario(M, s)) }));
  const row = (l: string, fn: (m: (typeof ms)[number]['m']) => React.ReactNode) => <tr key={l}><th style={{ position: 'static' }}>{l}</th>{ms.map((x, i) => <td key={i} className="n">{fn(x.m)}</td>)}</tr>;
  const cur = sc[scIdx] || sc[0];
  const NB = 'Create or select a non-BASE scenario first.';
  return <>
    <div className="ph"><h1>Scenario Manager</h1><span className="q">Build alternative FY26-27 portfolios from the current book and compare them</span></div>
    <div className="grid g12">
      <section className="pn"><h3><span>Edit scenario</span><Oda which="DECIDE" /></h3><div className="bd">
        <div className="frm"><label>Scenario</label><select className="inp" id="scsel" value={scIdx} onChange={(e) => store.set({ scIdx: +e.target.value })}>{sc.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select>
          <label>New scenario</label><div style={{ display: 'flex', gap: 4 }}><input className="inp" placeholder="e.g. PORTAL AGGRESSIVE" value={f.name} onChange={upd('name')} />
            <button className="iconbtn" onClick={() => { const n = (f.name || 'SCENARIO ' + sc.length).toUpperCase(); saveScenarios([...sc, { name: n, ops: [] }], sc.length, 'Scenario created ' + n); setF({ ...f, name: '' }); }}>Add</button></div></div><hr className="sep" />
        <div className="frm">
          <label>Remove player</label><div style={{ display: 'flex', gap: 4 }}><select className="inp" value={f.rm} onChange={upd('rm')}>{players.map((p) => <option key={p.pid}>{p.pid}</option>)}</select>
            <button className="iconbtn" onClick={() => pushOp({ t: 'remove', pid: f.rm }, 'BASE is the current book. Create or select another scenario first.')}>Remove</button></div>
          <label>Re-price player</label><div style={{ display: 'flex', gap: 4 }}><select className="inp" value={f.setp} onChange={upd('setp')}>{players.map((p) => <option key={p.pid}>{p.pid}</option>)}</select>
            <input className="inp" type="number" step="5000" placeholder="$" value={f.setv} onChange={upd('setv')} /><button className="iconbtn" onClick={() => pushOp({ t: 'set', pid: f.setp, cap: +f.setv || 0 }, NB)}>Set</button></div>
          <label>Add acquisition</label><div style={{ display: 'flex', gap: 4 }}><select className="inp" value={f.addg} onChange={upd('addg')}>{PICK_G.map((g) => <option key={g}>{g}</option>)}</select>
            <input className="inp" type="number" step="5000" placeholder="$" value={f.addv} onChange={upd('addv')} /><button className="iconbtn" onClick={() => pushOp({ t: 'add', g: f.addg, cap: +f.addv || 0, name: 'New ' + f.addg + ' #' + (cur.ops.filter((o) => o.t === 'add').length + 1) }, NB)}>Add</button></div>
          <label>Scale position</label><div style={{ display: 'flex', gap: 4 }}><select className="inp" value={f.scg} onChange={upd('scg')}>{PICK_G.map((g) => <option key={g}>{g}</option>)}</select>
            <input className="inp" type="number" placeholder="%" value={f.scv} onChange={upd('scv')} /><button className="iconbtn" onClick={() => pushOp({ t: 'scale', g: f.scg, pct: +f.scv || 0 }, NB)}>Apply</button></div>
        </div>
        <hr className="sep" /><div className="scn">{cur.ops.length ? cur.ops.map((o, i) => <span key={i} className="pill">{o.t.toUpperCase()} {o.pid || o.g || ''} {o.cap != null ? fmtM(o.cap) : ''}{o.pct != null ? o.pct + '%' : ''}
          <button onClick={() => saveScenarios(sc.map((s, j) => (j === scIdx ? { ...s, ops: s.ops.filter((_, k) => k !== i) } : s)), scIdx)}>✕</button></span>) : <span className="muted">No changes — identical to the current book</span>}</div>
        {scIdx > 0 && <button className="iconbtn" onClick={() => saveScenarios(sc.filter((_, i) => i !== scIdx), 0)}>Delete scenario</button>}
      </div></section>
      <Panel title="Side-by-side" oda="ASSESS" foot="Scenarios are saved in this browser only."><div className="tw"><table className="t"><thead><tr><th></th>{ms.map((x, i) => <th key={i} className="n">{x.s.name}</th>)}</tr></thead><tbody>
        {row('Total capital', (m) => fmtM(m.tot))}{row('Available capital', (m) => <span className={m.avail < 0 ? 'down' : 'up'}>{fmtM(m.avail)}</span>)}{row('Paid players (core)', (m) => m.paid)}{row('Average price', (m) => fmtM(m.avg))}{row('Median price', (m) => fmtM(m.med))}
        {row('Maturity exposure (≤ Dec-26)', (m) => fmtM(m.mat))}{row('Future commitments FY27-28', (m) => fmtM(m.fut))}{row('Top-5 concentration', (m) => pctf(m.top5))}{row('Retention %', (m) => pctf(m.ret))}{row('Acquisition %', (m) => pctf(1 - m.ret))}
        {['QB', 'WR', 'OL', 'DL', 'EDGE', 'LB', 'DB', 'RB', 'TE'].map((g) => row(g + ' allocation', (m) => fmtM(m.alloc[g])))}</tbody></table></div></Panel>
    </div>
  </>;
}

export function WhatIf() {
  const M = useModel(); const pos = useStore((s) => s.filters.pos); const W = useStore((s) => s.wi); const g = pos === 'ALL' ? 'OL' : pos;
  const [f, setF] = useState({ pct: String(W.pct), add: String(W.add) });
  const room = M.A.market[g][2026].roomCapital, d = (room * W.pct) / 100 + W.add; const dry = M.caps[2026] - M.committed[2026];
  return <>
    <div className="ph"><h1>What-If Analysis</h1><span className="q">Quick sensitivity on the FY26-27 book</span></div>
    <div className="filt"><label>Position</label><Sel path="f.pos" opts={PICK_G} value={g} /><label>Change room capital %</label><input className="inp" style={{ width: 90 }} type="number" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} />
      <label>Add capital $</label><input className="inp" style={{ width: 120 }} type="number" step="5000" value={f.add} onChange={(e) => setF({ ...f, add: e.target.value })} /><button className="iconbtn" onClick={() => store.set({ wi: { pct: +f.pct || 0, add: +f.add || 0 } })}>Recalculate</button></div>
    <div className="grid g4"><Kpi label={g + ' room now'} value={fmtM(room)} /><Kpi label={g + ' room after'} value={fmtM(room + d)} delta={sgn(d / room)} />
      <Kpi label="Dry powder after" value={<span className={dry - d < 0 ? 'down' : 'up'}>{fmtM(dry - d)}</span>} prior={'now ' + fmtM(dry)} /><Kpi label="Utilization after" value={pctf((M.committed[2026] + d) / M.caps[2026])} /></div>
    <div style={{ marginTop: 8 }}><Panel title="Room share after change"><HBars rows={allocRows(M, 2026).map((r) => ({ label: r.g, value: r.g === g ? r.v + d : r.v, color: r.g === g ? 'var(--warn)' : undefined }))} /></Panel></div>
  </>;
}

export function DryPowder() {
  const M = useModel(); const res = useStore((s) => s.assume.reserve); const cash = M.A.maturity.cash; const ks = monthRange('2026-07', '2027-06');
  let rem = M.caps[2026]; const rows = ks.map((k) => { rem -= cash[k] || 0; return { k, out: cash[k] || 0, rem }; });
  return <>
    <div className="ph"><h1>Dry Powder Forecast</h1><span className="q">Unspent FY26-27 cap after scheduled payments · month by month</span></div>
    <div className="grid g4"><Kpi label="Cap" value={fmtM(M.caps[2026])} /><Kpi label="Committed" value={fmtM(M.committed[2026])} /><Kpi label="Uncommitted dry powder" value={fmtM(M.caps[2026] - M.committed[2026])} prior={res != null ? 'reserve ' + fmtM(res) : 'no reserve set'} />
      <Kpi label="FY27-28 capacity" value={fmtM(M.caps[2027] - M.fy2728)} prior="estimated cap" /></div>
    <div style={{ marginTop: 8 }}><Panel title="Cash remaining against cap (after scheduled outflows)" foot="Unspent ≠ uncommitted: the end-of-June bar equals uncommitted dry powder.">
      <MonthBars entries={rows.map((r) => ({ k: r.k, v: r.rem, tip: `${monthLabel(r.k)}: ${fmt0(r.out)} out · ${fmt0(r.rem)} of cap unspent` }))} /></Panel></div>
  </>;
}
