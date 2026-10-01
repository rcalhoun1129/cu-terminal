/* 10 CONTROL */
import { useState } from 'react';
import { POSMAP, SEASONS } from '../engine/constants';
import { ctl } from '../engine/controls';
import { importBook } from '../data/importBook';
import { logAudit, setPath, store, useModel, useStore } from '../state/store';
import { Panel, PLink, Sel, Table, Tag } from '../ui/components';
import { by, fmt$, fmt0, fmtM, sum, uniq } from '../ui/fmt';

const SEVS = ['VERIFIED', 'RECONCILED', 'ESTIMATED', 'FORECAST', 'NEEDS REVIEW'];

export function Dq({ args }: { args: string[] }) {
  const M = useModel(); const sev = args[0] || 'ALL';
  const q = M.A.dq.filter((x) => sev === 'ALL' || x.sev === sev); const cnt = by(M.A.dq, (x) => x.sev);
  return <>
    <div className="ph"><h1>Data Quality Terminal</h1><span className="q">Uncertain records are never silently resolved</span></div>
    <div className="grid g6">{SEVS.map((s) => <section key={s} className="pn" data-go={`#/dq/${s}`} style={{ cursor: 'pointer' }}><div className="kpi"><small>{s}</small><span className="v">{(cnt.get(s) || []).length}</span></div></section>)}
      <section className="pn" data-go="#/dq/ALL" style={{ cursor: 'pointer' }}><div className="kpi"><small>ALL ITEMS</small><span className="v">{M.A.dq.length}</span></div></section></div>
    <div style={{ marginTop: 8 }}><Panel title={'Audit items' + (sev !== 'ALL' ? ' · ' + sev : '')}><Table rows={q} opts={{ tall: true }} cols={[{ l: 'Status', f: (r) => <Tag conf={r.sev} />, v: (r) => r.sev }, { l: 'Area', k: 'area' },
      { l: 'Item', f: (r) => (r.pid ? <PLink pid={r.pid} /> : r.item), v: (r) => r.item }, { l: 'Detail', k: 'detail', cls: 'wrap' }]} /></Panel></div>
    <div style={{ marginTop: 8 }}><Panel title="Record confidence across the ledger"><Table rows={[...by(M.episodes, (e) => e.conf)]} opts={{ csv: false }} cols={[{ l: 'Status', f: (r) => <Tag conf={r[0]} /> }, { l: 'Episodes', n: true, f: (r) => r[1].length }, { l: 'Capital', n: true, f: (r) => fmtM(sum(r[1].map((e) => e.capital))) }]} /></Panel></div>
  </>;
}

export function Recon() {
  const M = useModel(); const imported = useStore((s) => s.imported); const data = M.data; const C0 = data.controls;
  const [msg, setMsg] = useState<React.ReactNode>(null);
  const sumK = (k: string, f: string) => sum(M.episodes.filter((e) => e.kind === k).map((e) => +(e.capsBy[f] || 0)));
  const book = M.episodes.filter((e) => e.kind === 'FCST26' || e.kind === 'IMPORT26');
  const bookCtl = imported ? imported.total : C0['FY26-27 contractually committed (current book)'];
  // FY27-28: scheduled months vs the CAPS column (the reference hard-coded these figures in the note).
  const sched28 = (e: (typeof book)[number]) => sum(Object.entries(e.months || {}).filter(([k]) => k >= '2027-07' && k <= '2028-06').map(([, v]) => v));
  const hard28 = book.map((e) => +(e.capsBy['FY27-28'] || 0) - sched28(e)).filter((d) => Math.abs(d) > 0.005);
  const fall25 = sum(Object.entries(M.A.maturity.cash).filter(([k]) => k >= '2025-07' && k <= '2025-12').map(([, v]) => v));
  const rows = ([
    ['2024 collective scheduled payments', sumK('COLLECTIVE_2024', 'COLL24'), null, 'Sum of Jun-24→May-25 schedule (Football tab)'],
    ['2024 contract face (Forecast Master H66)', sum(M.episodes.filter((e) => e.kind === 'COLLECTIVE_2024').map((e) => e.face || 0)), C0['2024 collective 2024-contract total (Forecast Master H66)'], 'Face ≠ scheduled; face kept as a separate field'],
    ['FY25-26 athlete CAPS (AL3:AL185)', sumK('RSLA', 'FY25-26'), C0['FY25-26 contractually committed (file AL191)'], 'Includes amendment rows'],
    ['FY25-26 committed incl. buyout', M.committed[2025], C0['FY25-26 contractually committed (file AL191)'] + ctl.buyout25(C0), 'Remaining vs cap: ' + fmt$(M.caps[2025] - M.committed[2025])],
    ['Fall 2025 spend (formula)', fall25, C0['Fall 2025 actual spend (hard-coded AQ190)'], `Hard-coded AQ190 vs computed: ${fmt$(Math.abs(fall25 - C0['Fall 2025 actual spend (hard-coded AQ190)']))} gap`],
    ['FY26-27 athlete CAPS (current book)', sum(M.episodes.filter((e) => e.kind === 'FCST26').map((e) => +(e.capsBy['FY26-27'] || 0))), bookCtl, imported ? 'Session import' : 'Rev Share “contractually committed” control'],
    ['FY26-27 committed incl. F26 buyout', M.committed[2026], bookCtl + ctl.buyout26(C0), 'Remaining vs cap: ' + fmt$(M.caps[2026] - M.committed[2026])],
    ['FY26-27 remaining budget', M.caps[2026] - M.committed[2026], C0['FY26-27 remaining budget (current book)'], 'Book control “remaining budget”'],
    ['Spring-26 forecast snapshot FY26-27 (history)', sum(M.episodes.filter((e) => e.kind === 'SNAP26').map((e) => e.snap!['FY26-27'])), C0['Fall 26 contractually committed (forecast tab)'] + C0['Spring 27 contractually committed (forecast tab)'], 'Superseded — kept for forecast-vs-book'],
    ['FY26-27 per 2025-26 tab (AM191)', sumK('RSLA', 'FY26-27(RSLA)'), C0['FY26-27 committed per 2025-26 tab (AM191)'], 'Stale — superseded by forecast tab'],
    ['FY27-28 committed (book CAPS col.)', M.fy2728, C0['FY27-28 contractually committed (current book)'], `Scheduled months = ${fmt0(sum(book.map(sched28)))}; ${hard28.length ? `+${fmt0(sum(hard28))} hard-coded on ${hard28.length} rows` : 'no hard-coded rows'}`],
    ['FY27-28 remaining vs estimated cap', M.caps[2027] - M.fy2728, C0['FY27-28 remaining budget (current book)'], 'Cap estimate = FY26-27 cap (book)'],
  ] as [string, number | null, number | null | undefined, string][]).map(([k, a, b, n]) => ({ k, a, b: b ?? null, n, d: a != null && b != null ? a - b : null }));
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setMsg('Reading…'); const ib = await importBook(f, data); store.set({ imported: ib });
      logAudit(`Imported ${f.name}: ${ib.rows} rows, ${fmt$(ib.total)} FY26-27 CAPS, ${ib.months} month columns, ${ib.unmatched.length} unmatched`); setMsg(null); location.hash = '#/recon';
    } catch (err) { const m = (err as Error).message; setMsg(<span className="down">{m}</span>); logAudit('Import failed: ' + m); }
  };
  const nBook = M.episodes.filter((e) => e.kind === 'FCST26' && !e.imported).length;
  return <>
    <div className="ph"><h1>Source Reconciliation</h1><span className="q">Computed totals vs the files' own control cells</span></div>
    <Panel title="Control totals"><Table rows={rows} opts={{ csv: true }} cols={[{ l: 'Control', k: 'k' }, { l: 'Computed', n: true, f: (r) => (r.a == null ? '—' : fmt$(r.a)) }, { l: 'File control', n: true, f: (r) => (r.b == null ? '—' : fmt$(r.b)) },
      { l: 'Difference', n: true, f: (r) => (r.d == null ? '—' : <span className={Math.abs(r.d) < 0.01 ? 'up' : 'warn'}>{fmt$(r.d)}</span>) }, { l: 'Note', k: 'n', cls: 'wrap' }]} /></Panel>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Re-import a newer 26-27 Rev Share book" oda="OBSERVE">
        <div className="note info">The current book ({imported ? 'replaced by a session import' : `${nBook} records`}) is already loaded and verified. Import a newer export here to replace it for this session. The file is read in this browser only; nothing is uploaded. Expected layout: a header row with “Last Name”, “First Name”, a “2026-27 … CAPS total” column, and monthly columns such as “Jul. 2026” (same layout as the 25-26 RSLA sheet). Blank-name rows are treated as amendments of the row above.</div>
        <input type="file" id="impf" accept=".xlsx,.xls,.csv" className="inp" onChange={(e) => onFile(e.target.files?.[0])} />
        <div id="impmsg" style={{ marginTop: 6 }} className="t2">{msg ?? (imported && <>Loaded <b>{imported.file}</b> · {imported.rows} rows · {fmt$(imported.total)} · {imported.unmatched.length} unmatched names</>)}</div>
        {imported && <button className="iconbtn" style={{ marginTop: 6 }} onClick={() => { store.set({ imported: null }); logAudit('Reverted FY26-27 to loaded 26-27 book'); }}>Revert to loaded book</button>}
      </Panel>
      <Panel title="Source hierarchy"><Table rows={data.meta.sources} opts={{ csv: false }} cols={[{ l: 'Source', k: 'file', cls: 'wrap' }, { l: 'Use', k: 'use', cls: 'wrap' }, { l: 'Regime', k: 'regime', cls: 'wrap' }]} /></Panel>
    </div>
    {imported && imported.unmatched.length > 0 && <div style={{ marginTop: 8 }}><Panel title="Imported names not matched to an official roster">
      <Table rows={imported.unmatched.map((u) => ({ ...u, v: sum(imported.episodes.filter((e) => e.pid === u.id).map((e) => e.capital)) }))} cols={[{ l: 'Name as written', k: 'raw' }, { l: 'Resolved as', k: 'id' }, { l: 'FY26-27', n: true, f: (r) => fmt$(r.v) }]} /></Panel></div>}
  </>;
}

export function Crosswalk() {
  const M = useModel(); const map = Object.entries(POSMAP);
  const changes = [...M.players.values()].map((p) => ({ p, ps: SEASONS.map((s) => p.seasons[String(s) as '2024'].pos) })).filter((r) => uniq(r.ps.filter(Boolean)).length > 1);
  return <>
    <div className="ph"><h1>Position Crosswalk</h1><span className="q">Official seasonal position → Buy-Side group. A historical position is never overwritten by a later one.</span></div>
    <div className="grid g12">
      <Panel title="Crosswalk"><Table rows={map} opts={{ csv: false }} cols={[{ l: 'Official', f: (r) => r[0] }, { l: 'Buy-Side group', f: (r) => <b className="mono">{r[1]}</b> }]} /></Panel>
      <Panel title="Athletes whose official position changed"><Table rows={changes} cols={[{ l: 'Player', f: (r) => <PLink pid={r.p.id} /> }, { l: '2024', f: (r) => r.ps[0] || '—' }, { l: '2025', f: (r) => r.ps[1] || '—' }, { l: '2026', f: (r) => r.ps[2] || '—' },
        { l: 'Groups', f: (r) => uniq(r.ps.filter(Boolean).map((x) => POSMAP[x as string])).join(' → ') }]} /></Panel>
    </div>
  </>;
}

export function Names() {
  const M = useModel();
  const rows = [...M.players.values()].map((p) => ({ p, v: uniq([...p.legal, ...p.aliases]).filter((a) => a !== p.id) })).filter((r) => r.v.length || r.p.identity !== 'VERIFIED');
  return <>
    <div className="ph"><h1>Name Resolution</h1><span className="q">Canonical = official CU roster name · legal / RSLA and planning-file variants retained, never treated as separate athletes</span></div>
    <Panel title="Identity map"><Table rows={rows} opts={{ tall: true }} cols={[{ l: 'Canonical (official)', f: (r) => <PLink pid={r.p.id} />, v: (r) => r.p.id }, { l: 'Legal / RSLA', f: (r) => r.p.legal.join(' · '), cls: 'wrap' },
      { l: 'Variants seen in files', f: (r) => r.v.join(' · '), cls: 'wrap' }, { l: 'Identity', f: (r) => <Tag conf={r.p.identity} />, v: (r) => r.p.identity }, { l: 'Note', f: (r) => r.p.offRosterNote || '', cls: 'wrap' }]} /></Panel>
  </>;
}

/** Numeric input bound to a store path; commits on change like the reference [data-set] inputs. */
function SetInp({ path, value, placeholder, step = 1, style }: { path: string; value: unknown; placeholder?: string; step?: number; style?: React.CSSProperties }) {
  return <input className="inp" type="number" step={step} value={value == null ? '' : String(value)} placeholder={placeholder} style={style} onChange={(e) => setPath(path, e.target.value)} />;
}
function setAnchors(v: number | null, msg: string) {
  store.set((s) => ({ assume: { ...s.assume, bid: v && 40, target: v && 50, auth: v && 75, walk: v && 90 } }), { persist: true }); logAudit(msg);
}
export function AssumptionsScreen() {
  const A = useStore((s) => s.assume);
  const i = (k: keyof typeof A, ph: string, step = 1) => <SetInp path={'a.' + k} value={A[k]} placeholder={ph} step={step} />;
  return <>
    <div className="ph"><h1>Assumptions</h1><span className="q">Management underwriting inputs. Shown in amber everywhere they are used and kept separate from historical statistics.</span></div>
    <div className="grid g2">
      <Panel title="Internal quote anchors (percentiles of the position distribution)" oda="DECIDE">
        <div className="frm"><label>BID (opening offer)</label>{i('bid', 'e.g. 40')}<label>TARGET (close)</label>{i('target', 'e.g. 50')}<label>AUTH (authority)</label>{i('auth', 'e.g. 75')}<label>WALK (walk-away)</label>{i('walk', 'e.g. 90')}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="iconbtn" onClick={() => setAnchors(1, 'Quote anchors set P40/P50/P75/P90')}>Adopt P40 / P50 / P75 / P90</button><button className="iconbtn" onClick={() => setAnchors(null, 'Quote anchors cleared')}>Clear</button></div>
        <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>Until all four anchors are set, no BID / TARGET / AUTH / WALK values appear anywhere.</div></Panel>
      <Panel title="Portfolio thresholds" oda="ASSESS"><div className="frm"><label>Dry-powder reserve ($)</label>{i('reserve', 'none', 25000)}<label>Top-5 concentration alert (%)</label>{i('top5', 'none')}<label>Room share alert (%)</label>{i('roomShare', 'none')}
        <label>Maturity alert (days)</label>{i('maturityDays', '60', 30)}<label>Median YoY alert (±%)</label>{i('yoyAlert', '10')}</div></Panel>
    </div>
  </>;
}

export function SettingsScreen() {
  const s = useStore((st) => st);
  return <>
    <div className="ph"><h1>Market Settings</h1><span className="q">Changes recompute every market, index, band and alert</span></div>
    <Panel title="Market construction"><div className="frm" style={{ maxWidth: 640 }}>
      <label>Core-market threshold ($)</label><SetInp path="threshold" value={s.threshold} step={1000} />
      <label>Minimum N (else N/A)</label><SetInp path="minN" value={s.minN} /><label>Low-sample N</label><SetInp path="lowN" value={s.lowN} />
      <label>Band basis</label><Sel path="band" className="inp" opts={[['pooled', 'All seasons pooled'], ['inst', 'Institutional 2025–26'], ['2026', '2026'], ['2025', '2025'], ['2024', '2024']]} value={s.band} />
      <label>Price metric</label><Sel path="metric" className="inp" opts={[['fy', 'FY CAPS'], ['12m', '12-month equivalent'], ['month', 'Capital / month']]} value={s.metric} />
      <label>Include early enrollees in prior season</label><Sel path="includeEarly" className="inp" opts={[['false', 'No — price them in their roster season'], ['true', 'Yes']]} value={String(s.includeEarly)} />
    </div></Panel>
  </>;
}

export function AuditScreen() {
  const audit = useStore((s) => s.audit);
  return <>
    <div className="ph"><h1>Audit Log</h1><span className="q">Session events: settings, assumptions, imports, exports</span></div>
    <Panel><Table rows={audit} cols={[{ l: 'Time', k: 't' }, { l: 'Event', k: 'msg', cls: 'wrap' }]} /></Panel>
  </>;
}
