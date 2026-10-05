/* Roster Capital OS screens: the CEO Dashboard workbook as a live operating system.
   Edit any input and every dependent figure on every screen recomputes immediately. */
import { useRef, useState, type ReactNode } from 'react';
import { Kpi, Note, Panel, Table, type Col } from '../ui/components';
import { money, pct, type Exception, type Rag, type RosterDerived } from '../os/engine';
import { GUIDE_HEADER, OPERATING_LOOP } from '../os/guide';
import {
  addRecord, applyTrigger, deletePortal, deleteRecord, deleteTrigger, logTrigger, os, resetPositions, setAssume, setInput, setTriggerStatus, today,
  updatePosition, updateRecord, updateScenario, upsertPortal, useOs, useOsModel,
} from '../os/store';
import { LISTS, type OsAssumptions, type OsInputs, type PortalRow, type RosterRec } from '../os/types';
import { readWorkbookFile, writeWorkbookFile } from '../os/workbook';

/* ------------------------------------------------------------------ editable fields */
const go = (r: string) => { location.hash = '#/' + r; };
function NumField({ v, onSave, step = 1, asPct = false, ph = '', w }: { v: number | null; onSave: (v: number | null) => void; step?: number; asPct?: boolean; ph?: string; w?: number }) {
  const [d, setD] = useState<string | null>(null);
  const shown = d ?? (v == null ? '' : String(asPct ? +(v * 100).toFixed(4) : v));
  const save = () => { if (d == null) return; const t = d.replace(/[$,\s%]/g, ''); const n = t === '' ? null : Number(t); setD(null); if (n === null || isFinite(n)) onSave(n == null ? null : asPct ? n / 100 : n); };
  return <input className="inp num osin" style={w ? { width: w } : undefined} type="text" inputMode="decimal" value={shown} placeholder={ph} step={step}
    onChange={(e) => setD(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setD(null); }} />;
}
function TxtField({ v, onSave, ph = '', w, type = 'text' }: { v: string; onSave: (v: string) => void; ph?: string; w?: number; type?: string }) {
  const [d, setD] = useState<string | null>(null);
  return <input className="inp osin" style={w ? { width: w } : undefined} type={type} value={d ?? v} placeholder={ph} onChange={(e) => { setD(e.target.value); if (type === 'date') { onSave(e.target.value); setD(null); } }}
    onBlur={() => { if (d != null && d !== v) onSave(d); setD(null); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setD(null); }} />;
}
function Pick({ v, opts, onSave, blank = true, w }: { v: string; opts: readonly string[]; onSave: (v: string) => void; blank?: boolean; w?: number }) {
  const all = v && !opts.includes(v) ? [v, ...opts] : opts;
  return <select className="inp osin" style={w ? { width: w } : undefined} value={v} onChange={(e) => onSave(e.target.value)}>
    {blank && <option value="">—</option>}{all.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}
export const RagTag = ({ s, children }: { s: Rag | string; children?: ReactNode }) => <span className={`rag ${s}`}>{children ?? s}</span>;
const CALL_RAG: Record<string, Rag> = { Increase: 'GREEN', Retain: 'GREEN', Hold: 'GRAY', Scout: 'GRAY', Restructure: 'YELLOW', Recycle: 'RED', Replace: 'RED', Exit: 'RED' };
const CallTag = ({ c }: { c: string }) => (c ? <RagTag s={CALL_RAG[c] ?? 'GRAY'}>{c}</RagTag> : <span className="muted">—</span>);
const READY_RAG: Record<string, Rag> = { READY: 'GREEN', INCOMPLETE: 'YELLOW', 'ELIGIBILITY CERT NEEDED': 'RED' };
const POS_RAG: Record<string, Rag> = { CRITICAL: 'RED', THIN: 'YELLOW', STABLE: 'GREEN', SURPLUS: 'GRAY' };
const Val = ({ v, fmt = 'money' }: { v: number | null; fmt?: 'money' | 'count' | 'pct' }) => <span className={`num ${v != null && v < 0 ? 'down' : ''}`}>{v == null ? 'WITHHELD' : fmt === 'money' ? money(v) : fmt === 'pct' ? pct(v, 1) : v.toLocaleString()}</span>;

/* ------------------------------------------------------------------ header + workbook I/O */
function OsHead({ title, q, children }: { title: string; q: string; children?: ReactNode }) {
  const meta = useOs((s) => s.book.meta); const undo = useOs((s) => s.undo); const saved = useOs((s) => s.savedAt); const perr = useOs((s) => s.persistError);
  const file = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const onFile = async (f?: File) => {
    if (!f) return; setBusy('Reading ' + f.name + '…'); setErr('');
    try { const b = await readWorkbookFile(f); os.load(b, `Workbook loaded: ${f.name} · ${b.roster.length} master records`); } catch (e) { setErr((e as Error).message); }
    setBusy(''); if (file.current) file.current.value = '';
  };
  const exportIt = async () => { setErr(''); try { await writeWorkbookFile(os.get().book, `Roster_Capital_OS_${today()}.xlsx`); } catch (e) { setErr((e as Error).message); } };
  return <>
    <div className="ph"><h1>{title}</h1><span className="q">{q}</span></div>
    <div className="osbar">
      <span className={`tag ${meta.sample ? 'ESTIMATED' : 'VERIFIED'}`} title={meta.loaded ? 'Loaded ' + meta.loaded : ''}>{meta.sample ? 'SAMPLE BOOK' : 'LIVE BOOK'}</span>
      <span className="mono t2">{meta.sample ? 'Synthetic athletes — import your workbook to operate on real data' : meta.source}</span>
      <span style={{ flex: 1 }} />
      {busy && <span className="warn">{busy}</span>}{err && <span className="down">{err}</span>}
      <span className="muted mono" style={{ fontSize: 10.5 }} title={perr ?? ''}>{perr ? 'NOT SAVED: ' + perr : saved ? 'saved locally ' + saved.slice(11) : ''}</span>
      <input ref={file} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button className="iconbtn" onClick={() => file.current?.click()} title="Read a Roster Capital CEO Dashboard workbook in this browser (nothing is uploaded)">⇪ Import workbook</button>
      <button className="iconbtn" onClick={exportIt} title="Download the live book as .xlsx (re-importable)">⇩ Export .xlsx</button>
      <button className="iconbtn" disabled={!undo.length} onClick={() => os.undo()} title={undo[0] ? 'Undo: ' + undo[0].msg : 'Nothing to undo'}>↶ Undo</button>
      <button className="iconbtn" onClick={() => { if (confirm('Remove the operating book stored in this browser and return to the sample?')) os.clear(); }}>Clear local data</button>
    </div>
    {meta.warnings?.length ? <Note cls="dq">{meta.warnings.join(' · ')}</Note> : null}
    {children}
  </>;
}

/* ------------------------------------------------------------------ shared blocks */
function CapitalStack() {
  const m = useOsModel(); const b = useOs((s) => s.book); const P = m.projected || 1;
  const cls = b.inputs.classObligation2728; const floor = P * b.assume.utilFloor, ceil = P * b.assume.utilCeiling;
  const segs: [string, number, string][] = [
    ['Existing FY27-28 CAPS', m.existing2728, 'var(--up)'], ['Proposed class', cls, '#b7a8ff'],
    [`Room to ${pct(b.assume.utilFloor)}`, Math.max(0, floor - m.existing2728 - cls), 'var(--bar)'], [`${pct(b.assume.utilFloor)}→${pct(b.assume.utilCeiling)} band`, Math.max(0, ceil - Math.max(floor, m.existing2728 + cls)), 'var(--warn)'],
    ['Held outside utilization', P - Math.max(ceil, m.existing2728 + cls), 'var(--panel3)'],
  ];
  return <div>
    <div className="osstack">{segs.filter((s) => s[1] > 0).map(([l, v, c]) => <i key={l} style={{ width: `${(v / P) * 100}%`, background: c }} title={`${l}: ${money(v)} (${pct(v / P, 1)})`} />)}
      <u style={{ left: `${b.assume.utilFloor * 100}%` }} /><u style={{ left: `${b.assume.utilCeiling * 100}%` }} /></div>
    <div className="legend">{segs.map(([l, v, c]) => <span key={l}><i style={{ background: c }} />{l} <b className="num">{money(v)}</b></span>)}</div>
    <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>Projected FY27-28 allocation {money(m.projected)} · committed + proposed = {pct(m.utilization.committed, 1)} utilization</div>
  </div>;
}
function ExceptionList({ ex, max = 99 }: { ex: Exception[]; max?: number }) {
  if (!ex.length) return <div className="muted">No exceptions — every control is inside its operating range.</div>;
  return <div>{ex.slice(0, max).map((e, i) => <div key={i} className={`al lv-${e.lvl === 'RED' ? 'crit' : e.lvl === 'YELLOW' ? 'warn' : 'info'}`} data-go={'#/' + e.go}><i></i>
    <div><div className="c"><RagTag s={e.lvl}>{e.code}</RagTag> <span className="muted">· {e.owner}</span></div><div className="x">{e.text}</div></div></div>)}</div>;
}
function OperatingLoop() {
  return <div className="osloop">{OPERATING_LOOP.map((s, i) => <span key={s}><b>{s}</b>{i < OPERATING_LOOP.length - 1 && <em>→</em>}</span>)}</div>;
}

/* ------------------------------------------------------------------ CEO dashboard */
export function OsDashboard() {
  const m = useOsModel(); const b = useOs((s) => s.book); const I = b.inputs; const c = m.counts;
  const red = m.exceptions.filter((e) => e.lvl === 'RED').length, yel = m.exceptions.filter((e) => e.lvl === 'YELLOW').length;
  return <OsHead title="Roster Capital OS · CEO Dashboard" q="Structure first • verified → proposed → reserved → authorized. Every figure recomputes from the master inputs.">
    <div className="grid g6" style={{ marginBottom: 8 }}>
      <Kpi label="FY26-27 forecast available" value={money(I.forecastAvailable2627)} prior="Source-reported" />
      <Kpi label="Projected FY27-28 allocation" value={money(m.projected)} prior={`${pct(b.assume.growth, 1)} growth · not approved`} cls="warn" />
      <Kpi label="Existing FY27-28 CAPS" value={money(m.existing2728)} prior="Verified ledger" />
      <Kpi label="Proposed FY27-28 class" value={money(I.classObligation2728)} prior={I.classStatus} />
      <Kpi label="Base portal bodies" value={I.basePortalBodies} prior={I.basePortalMix} />
      <Kpi label="Exceptions" value={<><span className="down">{red}</span> / <span className="warn">{yel}</span></>} prior="red / yellow" />
    </div>
    <div className="grid g21">
      <Panel title="Capacity view · True OTB is withheld until reserves are authorized" oda="ASSESS" foot={<a href="#/oscapital">Capital books →</a>}>
        <div className="grid g4" style={{ marginBottom: 10 }}>
          <div className="stat"><small>Gross uncommitted before reserves</small><b><Val v={m.gross} /></b></div>
          <div className="stat"><small>Room to {pct(b.assume.utilFloor)}</small><b><Val v={m.room70} /></b></div>
          <div className="stat"><small>Room to {pct(b.assume.utilCeiling)}</small><b><Val v={m.room72} /></b></div>
          <div className="stat"><small>True OTB</small><b className={m.trueOtb == null ? 'warn' : ''}><Val v={m.trueOtb} /></b>{m.trueOtb == null && <div className="muted" style={{ fontSize: 10 }}>{4 - m.reservesSet} reserve input(s) required</div>}</div>
        </div>
        <CapitalStack />
      </Panel>
      <Panel title="Exception queue · red → yellow → gray" n={m.exceptions.length} oda="DECIDE"><div style={{ maxHeight: 300, overflow: 'auto' }}><ExceptionList ex={m.exceptions} /></div></Panel>
    </div>
    <div className="grid g6" style={{ margin: '8px 0' }}>
      {([['Total roster', c.records, 'osroster'], ['2+ season planning inventory', c.inv2plus, 'osroster/inv2'], ['1-season inventory', c.inv1, 'osroster/inv1'],
        ['Blank eligibility', c.blankElig, 'osroster/blank'], ['Certified yes', c.certYes, 'osroster/cert'], ['Action required', c.actionRequired, 'osroster/action']] as [string, number, string][])
        .map(([l, v, r]) => <section key={l} className="pn" data-go={'#/' + r} style={{ cursor: 'pointer' }}><div className="kpi"><small>{l}</small><span className={`v ${l === 'Blank eligibility' && v ? 'down' : ''}`}>{v}</span><span className="p">counts, not dollars</span></div></section>)}
    </div>
    <div className="grid g2">
      <Panel title="Position capital · live inventory" oda="ASSESS" foot={<a href="#/ospositions">Edit position inventory →</a>}>
        <Table rows={[...m.positions].sort((x, y) => x.priority.localeCompare(y.priority) || y.net - x.net)} opts={{ csv: false }} cols={[
          { l: 'Position', f: (p) => p.row.group }, { l: 'Current', n: true, f: (p) => p.row.current }, { l: 'Need', n: true, f: (p) => p.row.need }, { l: 'Targets', n: true, f: (p) => p.row.targets },
          { l: 'Net', n: true, v: (p) => p.net, f: (p) => p.net }, { l: 'Status', f: (p) => <RagTag s={POS_RAG[p.status]}>{p.status}</RagTag> }, { l: 'Target capital', n: true, v: (p) => p.row.capital, f: (p) => money(p.row.capital) },
          { l: 'Priority', f: (p) => p.priority }]} />
      </Panel>
      <Panel title="Decision mix · capital by economic call" oda="DECIDE" foot={<a href="#/osdecisions">Decision board →</a>}>
        <Table rows={m.mix.call} opts={{ csv: false }} cols={[{ l: 'Call', f: (g) => <CallTag c={g.k} /> }, { l: 'Athletes', n: true, f: (g) => g.n },
          { l: '2026-27 CAPS', n: true, v: (g) => g.caps, f: (g) => money(g.caps) }, { l: 'Share', n: true, f: (g) => pct(m.capsTotal ? g.caps / m.capsTotal : 0, 1) }, { l: 'FY27-28 CAPS', n: true, f: (g) => money(g.fwd) }]} />
        <div className="grid g3" style={{ marginTop: 8 }}>
          <div className="stat"><small>Athlete CAPS total</small><b>{money(m.capsTotal)}</b></div>
          <div className="stat"><small>CAPS ledger residual</small><b>{money(m.ledgerResidual)}</b></div>
          <div className="stat"><small>High-capital athletes</small><b>{c.highCapital}</b></div>
        </div>
      </Panel>
    </div>
    <Panel title="Operating loop" cls="" foot="Every source-state change updates a master input and flows through the engine instead of being repainted across tabs."><OperatingLoop /></Panel>
    <Note cls="info">EXECUTIVE RULE: the 2+ season figure ({c.inv2plus}) is a planning COUNT, not certified eligibility. The CAPS-ledger residual ({money(m.ledgerResidual)}) and FY forecast availability ({money(I.forecastAvailable2627)}) answer different questions.
      The class number ({money(I.classObligation2728)}) is a proposed FY27-28 obligation, not the earlier target board total ({money(I.priorBoardTotal)}).</Note>
  </OsHead>;
}

/* ------------------------------------------------------------------ roster master */
const FILTERS: Record<string, [string, (d: RosterDerived) => boolean]> = {
  all: ['All records', () => true], inv2: ['2+ season planning inventory', (d) => d.planningInventory === 'YES'], inv1: ['1-season inventory', (d) => d.rec.elig === 1],
  blank: ['Blank eligibility', (d) => d.rec.elig == null], cert: ['Compliance cert not populated', (d) => !d.rec.cert], incomplete: ['Roles TBD (incomplete)', (d) => d.readiness === 'INCOMPLETE'],
  action: ['Action required', (d) => d.actionRequired === 'YES'], hc: ['High-capital review', (d) => d.highCapital === 'YES'], departing: ['Departing', (d) => d.rec.rosterState === 'Departing'],
};
export function OsRoster({ args }: { args: string[] }) {
  const m = useOsModel(); const [q, setQ] = useState(''); const f = FILTERS[args[0]] ? args[0] : 'all'; const [call, setCall] = useState(''); const [newName, setNewName] = useState('');
  const rows = m.recs.filter(FILTERS[f][1]).filter((d) => !call || d.rec.call === call).filter((d) => !q || `${d.rec.athlete} ${d.rec.pos} ${d.rec.notes}`.toLowerCase().includes(q.toLowerCase()));
  const up = (d: RosterDerived, p: Partial<RosterRec>) => updateRecord(d.rec.id, p);
  const cols: Col<RosterDerived>[] = [
    { l: 'Athlete', v: (d) => d.rec.athlete, f: (d) => <a href={`#/osrecord/${d.rec.id}`} className="plink">{d.rec.athlete}</a> },
    { l: 'Pos', v: (d) => d.rec.pos, raw: (d) => d.rec.pos, f: (d) => <TxtField v={d.rec.pos} w={52} onSave={(v) => up(d, { pos: v })} /> },
    { l: 'Status', v: (d) => d.rec.status, raw: (d) => d.rec.status, f: (d) => <Pick v={d.rec.status} opts={LISTS.status} w={112} onSave={(v) => up(d, { status: v })} /> },
    { l: 'Elig', n: true, v: (d) => d.rec.elig ?? -1, raw: (d) => d.rec.elig ?? '', f: (d) => <NumField v={d.rec.elig} w={44} onSave={(v) => up(d, { elig: v })} /> },
    { l: 'Cert 2027', v: (d) => d.rec.cert, raw: (d) => d.rec.cert, f: (d) => <Pick v={d.rec.cert} opts={LISTS.cert} w={76} onSave={(v) => up(d, { cert: v })} /> },
    { l: 'Roster state', v: (d) => d.rec.rosterState, raw: (d) => d.rec.rosterState, f: (d) => <Pick v={d.rec.rosterState} opts={LISTS.rosterState} w={124} onSave={(v) => up(d, { rosterState: v })} /> },
    { l: '2026-27 CAPS', n: true, v: (d) => d.rec.caps2627, raw: (d) => d.rec.caps2627, f: (d) => <NumField v={d.rec.caps2627} w={92} onSave={(v) => up(d, { caps2627: v ?? 0 })} /> },
    { l: '2027-28 CAPS', n: true, v: (d) => d.rec.caps2728, raw: (d) => d.rec.caps2728, f: (d) => <NumField v={d.rec.caps2728} w={86} onSave={(v) => up(d, { caps2728: v ?? 0 })} /> },
    { l: 'BSM class', v: (d) => d.rec.bsmClass, raw: (d) => d.rec.bsmClass, f: (d) => <Pick v={d.rec.bsmClass} opts={LISTS.bsmClass} w={150} onSave={(v) => up(d, { bsmClass: v })} /> },
    { l: 'Economic call', v: (d) => d.rec.call, raw: (d) => d.rec.call, f: (d) => <Pick v={d.rec.call} opts={LISTS.call} w={100} onSave={(v) => up(d, { call: v })} /> },
    { l: 'Decision', v: (d) => d.rec.decision, raw: (d) => d.rec.decision, f: (d) => <Pick v={d.rec.decision} opts={LISTS.decision} w={104} onSave={(v) => up(d, { decision: v })} /> },
    { l: 'High cap?', v: (d) => d.highCapital, f: (d) => (d.highCapital === 'YES' ? <RagTag s="YELLOW">YES</RagTag> : <span className="muted">NO</span>), t: 'Roster Master AA — CAPS ≥ high-capital review floor' },
    { l: '2027 inv?', v: (d) => d.planningInventory, f: (d) => d.planningInventory, t: 'Roster Master AB' },
    { l: 'Priority', v: (d) => d.priority, f: (d) => d.priority, t: 'Roster Master AC' },
    { l: 'Readiness', v: (d) => d.readiness, f: (d) => <RagTag s={READY_RAG[d.readiness]}>{d.readiness}</RagTag>, t: 'Roster Master AD' },
    { l: 'Cur %', n: true, v: (d) => d.currentPct, f: (d) => pct(d.currentPct, 2), t: 'Share of FY26-27 allocation' },
    { l: 'Action?', v: (d) => d.actionRequired, f: (d) => (d.actionRequired === 'YES' ? <RagTag s="RED">YES</RagTag> : <span className="muted">NO</span>), t: 'Roster Master AG' },
  ];
  return <OsHead title="Roster Master" q="One athlete = one master record. Blue inputs edit in place; derived columns (AA–AG) and every dashboard recompute immediately.">
    <div className="filt" style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="inp" style={{ width: 'auto' }} value={f} onChange={(e) => go(e.target.value === 'all' ? 'osroster' : 'osroster/' + e.target.value)}>
        {Object.entries(FILTERS).map(([k, [l]]) => <option key={k} value={k}>{l} ({m.recs.filter(FILTERS[k][1]).length})</option>)}</select>
      <select className="inp" style={{ width: 'auto' }} value={call} onChange={(e) => setCall(e.target.value)}><option value="">All calls</option>{LISTS.call.map((c) => <option key={c}>{c}</option>)}</select>
      <input className="inp" style={{ width: 200 }} placeholder="Search athlete / pos / notes" value={q} onChange={(e) => setQ(e.target.value)} />
      <span style={{ flex: 1 }} />
      <input className="inp" style={{ width: 180 }} placeholder="New athlete name" value={newName} onChange={(e) => setNewName(e.target.value)} />
      <button className="iconbtn" disabled={!newName.trim()} onClick={() => { const id = addRecord(newName.trim()); setNewName(''); go('osrecord/' + id); }}>+ Add record</button>
    </div>
    <Panel title={FILTERS[f][0]} n={rows.length} right={<span className="muted mono">{money(rows.reduce((a, d) => a + d.rec.caps2627, 0))} 26-27 · {money(rows.reduce((a, d) => a + d.rec.caps2728, 0))} 27-28</span>}>
      <Table rows={rows} cols={cols} opts={{ tall: true }} />
    </Panel>
  </OsHead>;
}

export function OsRecord({ args }: { args: string[] }) {
  const m = useOsModel(); const d = m.recs.find((x) => x.rec.id === args[0]);
  const triggers = useOs((s) => s.book.triggers).filter((t) => t.rosterId === args[0]);
  if (!d) return <OsHead title="Master record" q="Record not found"><Note>No master record with id {args[0]}. <a href="#/osroster">Back to Roster Master</a></Note></OsHead>;
  const r = d.rec; const up = (p: Partial<RosterRec>) => updateRecord(r.id, p);
  const N = (k: keyof RosterRec, step = 1000) => <NumField v={r[k] as number | null} step={step} onSave={(v) => up({ [k]: k === 'caps2627' || k === 'caps2728' ? v ?? 0 : v } as Partial<RosterRec>)} />;
  const T = (k: keyof RosterRec, type = 'text') => <TxtField v={r[k] as string} type={type} onSave={(v) => up({ [k]: v } as Partial<RosterRec>)} />;
  const S = (k: keyof RosterRec, opts: readonly string[]) => <Pick v={r[k] as string} opts={opts} onSave={(v) => up({ [k]: v } as Partial<RosterRec>)} />;
  return <OsHead title={r.athlete} q={`${r.pos || 'No position'} · ${r.status || 'No status'} · master record ${r.id}${r.updated ? ' · updated ' + r.updated : ''}`}>
    <div className="grid g4" style={{ marginBottom: 8 }}>
      <Kpi label="2026-27 CAPS" value={money(r.caps2627)} prior={`${pct(d.currentPct, 2)} of FY26-27 allocation`} />
      <Kpi label="2027-28 existing CAPS" value={money(r.caps2728)} prior={`${pct(d.forwardPct, 2)} of projected FY27-28`} />
      <Kpi label="Decision priority" value={d.priority} prior={<CallTag c={r.call} />} />
      <Kpi label="Record readiness" value={<RagTag s={READY_RAG[d.readiness]}>{d.readiness}</RagTag>} prior={d.actionRequired === 'YES' ? 'Action required' : 'No action required'} />
    </div>
    <div className="grid g3">
      <Panel title="Identity & eligibility" oda="OBSERVE"><div className="frm">
        <label>Athlete</label>{T('athlete')}<label>Position</label>{T('pos')}<label>Current status</label>{S('status', LISTS.status)}<label>Elig. seasons (internal)</label>{N('elig', 1)}
        <label>Compliance cert 2027</label>{S('cert', LISTS.cert)}<label>Roster state</label>{S('rosterState', LISTS.rosterState)}<label>Functional role</label>{T('functionalRole')}<label>Depth role</label>{T('depthRole')}
      </div><Note style={{ marginTop: 8 }}>{d.treatment} · 2027 eligible: <b>{d.eligible2027}</b></Note></Panel>
      <Panel title="Capital & valuation" oda="ASSESS"><div className="frm">
        <label>2026-27 CAPS</label>{N('caps2627')}<label>2027-28 existing CAPS</label>{N('caps2728')}<label>Acquisition basis</label>{N('acqBasis')}<label>Current economic mark</label>{N('mark')}
        <label>2027 low</label>{N('low2027')}<label>2027 high</label>{N('high2027')}<label>Replacement low</label>{N('replLow')}<label>Replacement high</label>{N('replHigh')}
      </div>{r.low2027 != null && r.replHigh != null && <Note style={{ marginTop: 8 }} cls="info">Retention band midpoint {money(((r.low2027 ?? 0) + (r.high2027 ?? r.low2027 ?? 0)) / 2)} vs replacement midpoint {money(((r.replLow ?? 0) + (r.replHigh ?? 0)) / 2)}.</Note>}</Panel>
      <Panel title="Decision" oda="DECIDE"><div className="frm">
        <label>BSM capital class</label>{S('bsmClass', LISTS.bsmClass)}<label>Economic call</label>{S('call', LISTS.call)}<label>Decision status</label>{S('decision', LISTS.decision)}<label>Confidence</label>{S('confidence', LISTS.confidence)}
        <label>Agent / counterparty</label>{T('agent')}<label>Next decision date</label>{T('nextDate', 'date')}<label>Trigger flag</label>{S('trigger', LISTS.trigger)}<label>Retention risk</label>{S('retentionRisk', LISTS.risk)}
        <label>Portal risk</label>{S('portalRisk', LISTS.risk)}<label>Owner</label>{S('owner', LISTS.owner)}<label>Notes</label>{T('notes')}
      </div>{d.overdue && <Note cls="dq" style={{ marginTop: 8 }}>Decision is {-(d.daysToDecision ?? 0)} days past its date — escalate.</Note>}</Panel>
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Retention underwriting (Retention Matrix)">{r.uw.priority || r.uw.callText ? <dl className="kv">
        <dt>Priority</dt><dd>{r.uw.priority}</dd><dt>Economic call</dt><dd>{r.uw.callText}</dd><dt>2027 target / value band</dt><dd>{r.uw.band}</dd><dt>Fixed / protected</dt><dd>{r.uw.fixedShare}</dd>
        <dt>Conditional / earned</dt><dd>{r.uw.conditionalShare}</dd><dt>Evidence</dt><dd>{r.uw.evidence}</dd><dt>Rationale</dt><dd>{r.uw.rationale}</dd>
        {r.uw.rosterSource && <><dt>Sources</dt><dd><a className="muted" href={r.uw.rosterSource} target="_blank" rel="noopener">roster ↗</a> {r.uw.statsSource && <a className="muted" href={r.uw.statsSource} target="_blank" rel="noopener">stats ↗</a>}</dd></>}</dl>
        : <div className="muted">No retention-matrix row for this athlete.</div>}</Panel>
      <Panel title="Trigger history" n={triggers.length} foot={<a href={`#/ostriggers/${r.id}`}>Log a trigger for {r.athlete} →</a>}>{triggers.length ? <Table rows={triggers} opts={{ csv: false }} cols={[
        { l: 'Date', k: 'date' }, { l: 'Type', k: 'type' }, { l: 'Change', k: 'observed' }, { l: 'Prior → new', f: (t) => <>{t.priorCall || '—'} → <CallTag c={t.newCall} /></> }, { l: 'Status', k: 'status' }]} />
        : <div className="muted">No trigger events logged.</div>}</Panel>
    </div>
    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
      <a className="iconbtn" href="#/osroster">← Roster Master</a>
      <button className="iconbtn" onClick={() => up({ rosterState: 'Departing' })}>Mark departing</button>
      <button className="iconbtn" onClick={() => { if (confirm(`Delete ${r.athlete}? Only do this when the athlete truly leaves the operating population; otherwise mark Departing.`)) { deleteRecord(r.id); go('osroster'); } }}>Delete record</button>
    </div>
  </OsHead>;
}

/* ------------------------------------------------------------------ decision board (workflow) */
export function OsDecisions({ args }: { args: string[] }) {
  const m = useOsModel(); const [show, setShow] = useState<'action' | 'all'>(args[0] ? 'all' : 'action');
  const base = args[0] === 'overdue' ? m.recs.filter((d) => d.overdue) : args[0] === 'hc' ? m.recs.filter((d) => d.highCapital === 'YES') : m.recs;
  const rows = show === 'action' && !args[0] ? base.filter((d) => d.actionRequired === 'YES') : base;
  const stages = LISTS.decision;
  const advance = (d: RosterDerived, dir: 1 | -1) => { const i = stages.indexOf(d.rec.decision as typeof stages[number]); const n = stages[Math.min(stages.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))]; updateRecord(d.rec.id, { decision: n }); };
  return <OsHead title="Live Decision Board" q="Decision workflow from Observing to Closed. Move a record and the scorecard, exception queue and exports follow.">
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <span className="seg"><button className={show === 'action' ? 'on' : ''} onClick={() => setShow('action')}>Action required</button><button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All records</button></span>
      {args[0] && <span className="pill">{args[0] === 'overdue' ? 'Overdue decisions' : 'High-capital review'} <a href="#/osdecisions">×</a></span>}
      <span className="muted">{rows.length} records · {money(rows.reduce((a, d) => a + d.rec.caps2627, 0))} 2026-27 CAPS</span>
    </div>
    <div className="oskan">{stages.map((st) => {
      const col = rows.filter((d) => (d.rec.decision || 'Observing') === st).sort((a, b) => a.priority.localeCompare(b.priority) || b.rec.caps2627 - a.rec.caps2627);
      return <section key={st} className="pn"><h3><span>{st} <span className="muted num">{col.length}</span></span><span className="r muted num">{money(col.reduce((a, d) => a + d.rec.caps2627, 0))}</span></h3>
        <div className="bd">{col.slice(0, 60).map((d) => <div key={d.rec.id} className={`oscard ${d.overdue ? 'od' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}><a className="plink" href={`#/osrecord/${d.rec.id}`}>{d.rec.athlete}</a><span className="num">{money(d.rec.caps2627)}</span></div>
          <div className="muted" style={{ fontSize: 10.5 }}>{d.rec.pos || '—'} · {d.priority} · {d.rec.bsmClass}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}><CallTag c={d.rec.call} />
            <span><button className="iconbtn xs" disabled={st === stages[0]} onClick={() => advance(d, -1)} title="Move back">‹</button><button className="iconbtn xs" disabled={st === stages[stages.length - 1]} onClick={() => advance(d, 1)} title="Advance">›</button></span></div>
          {d.rec.trigger && <div className="warn" style={{ fontSize: 10.5 }}>⚑ {d.rec.trigger}</div>}{d.rec.nextDate && <div className={d.overdue ? 'down' : 'muted'} style={{ fontSize: 10.5 }}>Next decision {d.rec.nextDate}</div>}
        </div>)}{col.length > 60 && <div className="muted">+{col.length - 60} more</div>}</div></section>;
    })}</div>
  </OsHead>;
}

/* ------------------------------------------------------------------ position inventory */
export function OsPositions() {
  const m = useOsModel();
  return <OsHead title="Position Inventory" q="Baseline is the source-verified Appendix A; live columns are personnel-controlled inputs. Net need and status recalculate on every edit.">
    <Panel title="Live position inventory" n={m.positions.length} oda="ASSESS" right={<button className="iconbtn" onClick={() => { if (confirm('Reset all live columns to the baseline?')) resetPositions(); }}>Reset live to baseline</button>}>
      <Table rows={m.positions.map((p, i) => ({ ...p, i }))} cols={[
        { l: 'Position group', v: (p) => p.row.group, f: (p) => p.row.group },
        { l: 'Base cur / need / tgt', f: (p) => <span className="muted num">{p.row.baseCurrent} / {p.row.baseNeed} / {p.row.baseTargets}</span>, raw: (p) => `${p.row.baseCurrent}/${p.row.baseNeed}/${p.row.baseTargets}` },
        { l: 'Base status', v: (p) => p.baseStatus, f: (p) => <RagTag s={POS_RAG[p.baseStatus]}>{p.baseStatus}</RagTag> },
        { l: 'Live current', n: true, raw: (p) => p.row.current, f: (p) => <NumField v={p.row.current} w={50} onSave={(v) => updatePosition(p.i, { current: v ?? 0 })} /> },
        { l: 'Live need', n: true, raw: (p) => p.row.need, f: (p) => <NumField v={p.row.need} w={50} onSave={(v) => updatePosition(p.i, { need: v ?? 0 })} /> },
        { l: 'Live targets', n: true, raw: (p) => p.row.targets, f: (p) => <NumField v={p.row.targets} w={50} onSave={(v) => updatePosition(p.i, { targets: v ?? 0 })} /> },
        { l: 'Live target capital', n: true, raw: (p) => p.row.capital, f: (p) => <NumField v={p.row.capital} w={96} onSave={(v) => updatePosition(p.i, { capital: v ?? 0 })} /> },
        { l: 'Net need', n: true, v: (p) => p.net, f: (p) => <b className="num">{p.net}</b> },
        { l: 'Live status', v: (p) => p.status, f: (p) => <RagTag s={POS_RAG[p.status]}>{p.status}</RagTag> },
        { l: 'Priority', v: (p) => p.priority, f: (p) => p.priority },
        { l: 'Drift', f: (p) => (p.drift ? <span className="warn" title="Live inputs differ from the baseline">● edited</span> : <span className="muted">—</span>), raw: (p) => (p.drift ? 'edited' : '') },
        { l: 'Operating note', f: (p) => <span className="t2" style={{ whiteSpace: 'normal' }}>{p.row.note}</span>, raw: (p) => p.row.note },
      ]} />
    </Panel>
    <div className="grid g3" style={{ marginTop: 8 }}>
      <Kpi label="Live net remaining need" value={m.netNeed} prior={`baseline ${m.baseNetNeed}`} />
      <Kpi label="Live target capital" value={money(m.positions.reduce((a, p) => a + p.row.capital, 0))} prior={`baseline ${money(m.positions.reduce((a, p) => a + p.row.baseCapital, 0))}`} />
      <Kpi label="Critical / thin rooms" value={`${m.positions.filter((p) => p.status === 'CRITICAL').length} / ${m.positions.filter((p) => p.status === 'THIN').length}`} prior="CRITICAL at net need ≥ 3 (workbook rule)" />
    </div>
  </OsHead>;
}

/* ------------------------------------------------------------------ capital books, forecast, scenarios */
export function OsCapital() {
  const m = useOsModel(); const b = useOs((s) => s.book); const A = b.assume, I = b.inputs;
  const R = (k: keyof OsAssumptions, l: string) => <><label>{l}</label><NumField v={A[k] as number | null} step={25000} ph="INPUT REQUIRED" onSave={(v) => setAssume(k, v as never)} /></>;
  const line = (l: string, v: number | null, st: string, def: string) => ({ l, v, st, def });
  const book = [
    line('Projected FY2027-28 allocation', m.projected, 'PLANNING', `${pct(A.growth, 1)} growth planning assumption; not approved.`),
    line('Existing FY2027-28 CAPS', m.existing2728, 'VERIFIED', 'Exact ledger total from the Roster Master.'),
    line('Proposed FY2027-28 class obligation', I.classObligation2728, 'PROPOSED', 'Unsigned class planning amount.'),
    line('Gross uncommitted before reserves', m.gross, 'CALCULATED', 'Projected allocation less existing CAPS less proposed class.'),
    line(`Room to ${pct(A.utilFloor)} utilization`, m.room70, 'CALCULATED', 'Retention + acquisition room at the floor.'),
    line(`Room to ${pct(A.utilCeiling)} utilization`, m.room72, 'CALCULATED', 'Retention + acquisition room at the ceiling.'),
    line('Structural portal low case', m.portalView.structural.low, 'PLANNING', 'Structural-deficit low-case reserve from the Portal Board.'),
    line('Retention reserve', A.retentionReserve, A.retentionReserve == null ? 'INPUT REQUIRED' : 'ENTERED', 'Protected retention capital.'),
    line('Replacement reserve', A.replacementReserve, A.replacementReserve == null ? 'INPUT REQUIRED' : 'ENTERED', 'Protected replacement capital.'),
    line('Contingency reserve', A.contingencyReserve, A.contingencyReserve == null ? 'INPUT REQUIRED' : 'ENTERED', 'Protected uncertainty capital.'),
    line('Opportunity reserve', A.opportunityReserve, A.opportunityReserve == null ? 'INPUT REQUIRED' : 'ENTERED', 'Protected opportunity capital.'),
    line('TRUE OPEN-TO-BUY', m.trueOtb, m.trueOtb == null ? 'WITHHELD' : 'CALCULATED', 'Calculates only after all four reserve inputs are populated.'),
  ];
  const stTag = (s: string) => <span className={`tag ${s === 'VERIFIED' ? 'VERIFIED' : s === 'PROPOSED' || s === 'PLANNING' ? 'FORECAST' : s === 'INPUT REQUIRED' || s === 'WITHHELD' ? 'NEEDS' : s === 'ENTERED' ? 'RECONCILED' : 'ESTIMATED'}`}>{s}</span>;
  return <OsHead title="Capital Books · 2027 Forecast · Scenarios" q="True Open-to-Buy is withheld until every reserve is authorized. No reserve amount is invented by the system.">
    <div className="grid g21">
      <Panel title="2027 capital book" oda="ASSESS"><Table rows={book} opts={{ csv: true }} cols={[{ l: 'Line item', f: (r) => <b style={{ fontWeight: r.l.startsWith('TRUE') ? 700 : 400 }}>{r.l}</b>, raw: (r) => r.l },
        { l: 'Value', n: true, raw: (r) => r.v ?? r.st, f: (r) => <Val v={r.v} /> }, { l: 'Status', f: (r) => stTag(r.st), raw: (r) => r.st }, { l: 'Definition', f: (r) => <span className="t2">{r.def}</span>, raw: (r) => r.def }]} /></Panel>
      <div>
        <Panel title="Protected reserves · Decision Room inputs" oda="DECIDE"><div className="frm">{R('retentionReserve', 'Retention reserve ($)')}{R('replacementReserve', 'Replacement reserve ($)')}{R('contingencyReserve', 'Contingency reserve ($)')}{R('opportunityReserve', 'Opportunity reserve ($)')}</div>
          <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{m.reservesSet}/4 entered. Clear a field to withhold True OTB again.</div></Panel>
        <Panel title="Forecast inputs" oda="OBSERVE"><div className="frm">
          <label>FY26-27 football allocation ($)</label><NumField v={I.allocation2627} onSave={(v) => v != null && setInput('allocation2627', v)} />
          <label>FY27-28 growth (%)</label><NumField v={A.growth} asPct onSave={(v) => v != null && setAssume('growth', v)} />
          <label>Utilization floor (%)</label><NumField v={A.utilFloor} asPct onSave={(v) => v != null && setAssume('utilFloor', v)} />
          <label>Utilization ceiling (%)</label><NumField v={A.utilCeiling} asPct onSave={(v) => v != null && setAssume('utilCeiling', v)} />
          <label>Proposed FY27-28 class ($)</label><NumField v={I.classObligation2728} onSave={(v) => v != null && setInput('classObligation2728', v)} />
        </div></Panel>
      </div>
    </div>
    <Panel title="Capacity stack · projected FY27-28 allocation"><CapitalStack /></Panel>
    <Panel title="2027 scenario forecast · capacity discipline" oda="DECIDE" foot="Room = projected allocation × utilization − existing FY27-28 CAPS − class. Edit utilization or class per scenario.">
      <Table rows={m.scenarios.map((x, i) => ({ ...x, i }))} cols={[
        { l: 'Scenario', f: (x) => <b>{x.s.name}</b>, raw: (x) => x.s.name }, { l: 'Season signal', f: (x) => x.s.signal, raw: (x) => x.s.signal },
        { l: 'Utilization %', n: true, raw: (x) => x.s.utilization, f: (x) => <NumField v={x.s.utilization} asPct w={64} onSave={(v) => v != null && updateScenario(x.i, { utilization: v })} /> },
        { l: 'FY27-28 class', n: true, raw: (x) => x.s.classObligation, f: (x) => <NumField v={x.s.classObligation} w={96} onSave={(v) => v != null && updateScenario(x.i, { classObligation: v })} /> },
        { l: 'Retention + acquisition room', n: true, v: (x) => x.room, f: (x) => <Val v={x.room} /> }, { l: 'Held outside utilization', n: true, v: (x) => x.held, f: (x) => <Val v={x.held} /> },
        { l: 'Retention posture', f: (x) => <span className="t2" style={{ whiteSpace: 'normal' }}>{x.s.retention}</span>, raw: (x) => x.s.retention },
        { l: 'Primary risk', f: (x) => <span className="t2" style={{ whiteSpace: 'normal' }}>{x.s.risk}</span>, raw: (x) => x.s.risk }, { l: 'Required call', f: (x) => x.s.call, raw: (x) => x.s.call }]} />
    </Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ portal board */
const EMPTY_PORTAL: Omit<PortalRow, 'id'> = { priority: 'P1', pos: '', bodies: 1, needType: 'STRUCTURAL DEFICIT', why: '', role: 'Functional', low: null, high: null, timing: 'Winter portal', rule: '' };
export function OsPortal() {
  const m = useOsModel(); const [draft, setDraft] = useState<Omit<PortalRow, 'id'>>(EMPTY_PORTAL);
  const set = (p: Partial<PortalRow>, r: PortalRow) => upsertPortal({ ...r, ...p }); const V = m.portalView;
  return <OsHead title="2027 Transfer Portal Acquisition Board" q="Every target is tied to a role and a need type. Reserves are bodies × planning range; structural deficits feed True OTB.">
    <div className="grid g4" style={{ marginBottom: 8 }}>
      <Kpi label="Structural deficits (base plan)" value={`${money(V.structural.low)} – ${money(V.structural.high)}`} prior={`${V.structural.bodies} bodies · must be funded`} />
      <Kpi label="Replacement watches" value={`${money(V.replacement.low)} – ${money(V.replacement.high)}`} prior={`${V.replacement.bodies} bodies · reserve until certified`} />
      <Kpi label="Full gross board" value={`${money(m.grossBoard.low)} – ${money(m.grossBoard.high)}`} prior="Scenario ceiling — NOT simultaneous spend" cls="warn" />
      <Kpi label="Options + contingency" value={`${money(V.performance.low + V.contingency.low)} – ${money(V.performance.high + V.contingency.high)}`} prior="Outside the gross board" />
    </div>
    <Panel title="Portal targets" n={m.portal.length} oda="DECIDE">
      <Table rows={m.portal} cols={[
        { l: 'Pri', raw: (p) => p.row.priority, v: (p) => p.row.priority, f: (p) => <Pick v={p.row.priority} opts={LISTS.portalPriority} blank={false} w={52} onSave={(v) => set({ priority: v }, p.row)} /> },
        { l: 'Position', raw: (p) => p.row.pos, f: (p) => <TxtField v={p.row.pos} w={96} onSave={(v) => set({ pos: v }, p.row)} /> },
        { l: 'Bodies', n: true, raw: (p) => p.row.bodies ?? '', f: (p) => <NumField v={p.row.bodies} w={44} onSave={(v) => set({ bodies: v }, p.row)} /> },
        { l: 'Need type', raw: (p) => p.row.needType, f: (p) => <Pick v={p.row.needType} opts={LISTS.portalNeed} blank={false} w={150} onSave={(v) => set({ needType: v }, p.row)} /> },
        { l: 'Low / athlete', n: true, raw: (p) => p.row.low ?? '', f: (p) => <NumField v={p.row.low} w={84} onSave={(v) => set({ low: v }, p.row)} /> },
        { l: 'High / athlete', n: true, raw: (p) => p.row.high ?? '', f: (p) => <NumField v={p.row.high} w={84} onSave={(v) => set({ high: v }, p.row)} /> },
        { l: 'Low reserve', n: true, v: (p) => p.lowReserve, f: (p) => money(p.lowReserve) }, { l: 'High reserve', n: true, v: (p) => p.highReserve, f: (p) => money(p.highReserve) },
        { l: 'Why need exists', raw: (p) => p.row.why, f: (p) => <span className="t2" style={{ whiteSpace: 'normal' }}>{p.row.why}</span> },
        { l: 'Timing', raw: (p) => p.row.timing, f: (p) => <span className="t2">{p.row.timing}</span> },
        { l: '', f: (p) => <button className="iconbtn xs" onClick={() => { if (confirm(`Remove ${p.row.priority} ${p.row.pos}?`)) deletePortal(p.row.id); }}>×</button>, raw: () => '' },
      ]} />
    </Panel>
    <Panel title="Add portal target · need first, names later" oda="DECIDE"><div className="frm" style={{ gridTemplateColumns: 'repeat(4, auto 1fr)' }}>
      <label>Priority</label><Pick v={draft.priority} opts={LISTS.portalPriority} blank={false} onSave={(v) => setDraft({ ...draft, priority: v })} />
      <label>Position</label><input className="inp" value={draft.pos} onChange={(e) => setDraft({ ...draft, pos: e.target.value })} />
      <label>Bodies</label><input className="inp num" value={draft.bodies ?? ''} onChange={(e) => setDraft({ ...draft, bodies: e.target.value === '' ? null : +e.target.value })} />
      <label>Need type</label><Pick v={draft.needType} opts={LISTS.portalNeed} blank={false} onSave={(v) => setDraft({ ...draft, needType: v })} />
      <label>Planning low ($)</label><input className="inp num" value={draft.low ?? ''} onChange={(e) => setDraft({ ...draft, low: e.target.value === '' ? null : +e.target.value })} />
      <label>Planning high ($)</label><input className="inp num" value={draft.high ?? ''} onChange={(e) => setDraft({ ...draft, high: e.target.value === '' ? null : +e.target.value })} />
      <label>BSM role</label><Pick v={draft.role} opts={[...LISTS.bsmClass, 'Functional', 'Core / Functional', 'Functional / Core', 'Core']} blank={false} onSave={(v) => setDraft({ ...draft, role: v })} />
      <label>Timing</label><input className="inp" value={draft.timing} onChange={(e) => setDraft({ ...draft, timing: e.target.value })} />
      <label>Why need exists</label><input className="inp" value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} />
      <label>Decision rule</label><input className="inp" value={draft.rule} onChange={(e) => setDraft({ ...draft, rule: e.target.value })} />
    </div><button className="iconbtn" style={{ marginTop: 8 }} disabled={!draft.pos.trim() || !draft.why.trim()} onClick={() => { upsertPortal(draft); setDraft(EMPTY_PORTAL); }}>+ Add target</button>
      <span className="muted" style={{ marginLeft: 8, fontSize: 10.5 }}>Position and “why need exists” are required.</span></Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ incoming class */
export function OsClass() {
  const b = useOs((s) => s.book); const m = useOsModel(); const I = b.inputs;
  const prior = b.classTargets.reduce((a, t) => a + t.prior, 0);
  const I$ = (k: keyof OsInputs, l: string) => <><label>{l}</label><NumField v={I[k] as number} onSave={(v) => v != null && setInput(k, v as never)} /></>;
  return <OsHead title="2027 Incoming Class" q="The earlier target board and the newer aggregate class forecast are different source states. No athlete-level pro-rating is used.">
    <div className="grid g4" style={{ marginBottom: 8 }}>
      <Kpi label="Target count" value={I.targetCount || b.classTargets.length} /><Kpi label="Prior target board total" value={money(I.priorBoardTotal)} prior={`${b.classTargets.length} rows sum to ${money(prior)}`} />
      <Kpi label="FY27-28 class forecast" value={money(I.classObligation2728)} prior={I.classStatus} cls="warn" /><Kpi label="Difference between source states" value={money(m.classDiff)} prior="REVIEW — do not allocate by athlete" />
    </div>
    <div className="grid g21">
      <Panel title="Forecast windows" oda="OBSERVE"><Table rows={b.classWindows} cols={[{ l: 'Window', k: 'window' }, { l: 'Amount', n: true, v: (w) => w.amount, f: (w) => money(w.amount) }, { l: 'Fiscal year', k: 'fy' }, { l: 'Type', k: 'type' }, { l: 'Use', k: 'use' }, { l: 'Note', k: 'note' }]} /></Panel>
      <Panel title="Class controls"><div className="frm">{I$('classObligation2728', 'FY27-28 class obligation ($)')}{I$('priorBoardTotal', 'Prior target board total ($)')}{I$('springClassEntry', 'Spring 2027 entry ($)')}{I$('targetCount', 'Target count')}</div>
        <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>The class obligation drives the forecast, capital books, scenarios and scorecard.</div></Panel>
    </div>
    <Panel title="Prior target board · reconcile against current class forecast" n={b.classTargets.length}><Table rows={b.classTargets} cols={[{ l: 'Athlete', k: 'athlete' }, { l: 'Position', k: 'pos' },
      { l: 'Prior stated value', n: true, v: (t) => t.prior, f: (t) => money(t.prior) }, { l: 'Prior board state', f: (t) => <RagTag s={t.board === 'GREEN' ? 'GREEN' : 'YELLOW'}>{t.board}</RagTag>, raw: (t) => t.board }, { l: 'Prior rationale', k: 'rationale' }, { l: 'Current control', k: 'control' }]} /></Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ trigger log */
export function OsTriggers({ args }: { args: string[] }) {
  const b = useOs((s) => s.book);
  const init = { date: today(), rosterId: args[0] && b.roster.some((r) => r.id === args[0]) ? args[0] : '', subject: '', type: LISTS.trigger[0] as string, observed: '', newCall: '', effect: '', product: '', owner: 'Buy-Side' };
  const [f, setF] = useState(init); const [apply, setApply] = useState(true);
  const rec = b.roster.find((r) => r.id === f.rosterId);
  const submit = () => { logTrigger({ date: f.date, subject: rec?.athlete || f.subject, rosterId: rec?.id ?? null, type: f.type, observed: f.observed, priorCall: rec?.call ?? '', newCall: f.newCall, effect: f.effect, product: f.product, owner: f.owner, status: 'Open' }, apply); setF({ ...init, rosterId: '' }); };
  const open = b.triggers.filter((t) => t.status !== 'Closed').length;
  return <OsHead title="Event-Driven Re-Underwriting Log" q="Every material event gets a decision response. Logging a trigger can re-underwrite the master record in the same step.">
    <div className="grid g21">
      <Panel title="Log a trigger event" oda="DECIDE"><div className="frm">
        <label>Date</label><input className="inp" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <label>Athlete (master record)</label><select className="inp" value={f.rosterId} onChange={(e) => setF({ ...f, rosterId: e.target.value })}><option value="">— position-level event —</option>
          {[...b.roster].sort((x, y) => x.athlete.localeCompare(y.athlete)).map((r) => <option key={r.id} value={r.id}>{r.athlete}{r.pos ? ` · ${r.pos}` : ''}</option>)}</select>
        {!rec && <><label>Position / subject</label><input className="inp" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. DT room" /></>}
        <label>Trigger type</label><Pick v={f.type} opts={LISTS.trigger} blank={false} onSave={(v) => setF({ ...f, type: v })} />
        <label>Observed change</label><input className="inp" value={f.observed} onChange={(e) => setF({ ...f, observed: e.target.value })} />
        <label>Prior call</label><span className="mono" style={{ alignSelf: 'center' }}>{rec ? <CallTag c={rec.call} /> : '—'}</span>
        <label>New call</label><Pick v={f.newCall} opts={LISTS.call} onSave={(v) => setF({ ...f, newCall: v })} />
        <label>Capital effect</label><input className="inp" value={f.effect} onChange={(e) => setF({ ...f, effect: e.target.value })} placeholder="e.g. +$150K retention band" />
        <label>Required product</label><input className="inp" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="e.g. re-underwrite memo" />
        <label>Owner</label><Pick v={f.owner} opts={LISTS.owner} blank={false} onSave={(v) => setF({ ...f, owner: v })} />
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}><input type="checkbox" checked={apply} disabled={!rec} onChange={(e) => setApply(e.target.checked)} />
        Apply to master now (sets trigger flag{f.newCall ? `, call → ${f.newCall}` : ''}, decision → Under Review)</label>
      <button className="iconbtn" style={{ marginTop: 8 }} disabled={!(rec || f.subject.trim()) || !f.observed.trim()} onClick={submit}>Log trigger</button></Panel>
      <Panel title="Trigger rules"><dl className="kv"><dt>Open events</dt><dd>{open}</dd><dt>Applied to master</dt><dd>{b.triggers.filter((t) => t.applied).length}</dd><dt>Closing</dt><dd>Closing an event clears the trigger flag it raised on the master record.</dd>
        <dt>Rule</dt><dd>Do not wait for month-end.</dd></dl></Panel>
    </div>
    <Panel title="Trigger log" n={b.triggers.length}>{b.triggers.length ? <Table rows={b.triggers} cols={[
      { l: 'Date', k: 'date' }, { l: 'Athlete / position', f: (t) => (t.rosterId ? <a className="plink" href={`#/osrecord/${t.rosterId}`}>{t.subject}</a> : t.subject), raw: (t) => t.subject },
      { l: 'Type', k: 'type' }, { l: 'Observed change', k: 'observed' }, { l: 'Prior → new', f: (t) => <>{t.priorCall || '—'} → {t.newCall ? <CallTag c={t.newCall} /> : '—'}</>, raw: (t) => `${t.priorCall} → ${t.newCall}` },
      { l: 'Capital effect', k: 'effect' }, { l: 'Owner', k: 'owner' },
      { l: 'Status', raw: (t) => t.status, f: (t) => <Pick v={t.status} opts={LISTS.triggerStatus} blank={false} w={92} onSave={(v) => setTriggerStatus(t.id, v)} /> },
      { l: 'Master', raw: (t) => (t.applied ? 'applied' : ''), f: (t) => (t.applied ? <RagTag s="GREEN">APPLIED</RagTag> : t.rosterId ? <button className="iconbtn xs" onClick={() => applyTrigger(t.id)}>Apply</button> : <span className="muted">n/a</span>) },
      { l: '', raw: () => '', f: (t) => <button className="iconbtn xs" onClick={() => { if (confirm('Delete this trigger event?')) deleteTrigger(t.id); }}>×</button> },
    ]} /> : <div className="muted">No trigger events yet. Log the first one above.</div>}</Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ scorecard */
export function OsScorecard() {
  const m = useOsModel(); const rank: Record<Rag, number> = { RED: 0, YELLOW: 1, GRAY: 2, GREEN: 3 }; const [sorted, setSorted] = useState(true);
  const rows = sorted ? [...m.scorecard].sort((a, b) => rank[a.status] - rank[b.status]) : m.scorecard;
  return <OsHead title="CEO Scorecard" q="Only source-verified or explicitly labeled planning metrics. Status is computed from each guardrail, not painted.">
    <div style={{ marginBottom: 8 }}><span className="seg"><button className={sorted ? 'on' : ''} onClick={() => setSorted(true)}>Red → yellow → green</button><button className={!sorted ? 'on' : ''} onClick={() => setSorted(false)}>Workbook order</button></span></div>
    <Panel title="Scorecard" n={rows.length}><Table rows={rows} opts={{ go: (r) => '#/' + r.go }} cols={[{ l: 'Category', k: 'category' }, { l: 'Metric', f: (r) => <b>{r.metric}</b>, raw: (r) => r.metric },
      { l: 'Owner', k: 'owner' }, { l: 'Current', n: true, raw: (r) => r.value ?? 'WITHHELD', f: (r) => <Val v={r.value} fmt={r.fmt} /> }, { l: 'Guardrail', k: 'guardrail' }, { l: 'Type', k: 'type' },
      { l: 'Status', v: (r) => rank[r.status], raw: (r) => r.status, f: (r) => <RagTag s={r.status} /> }, { l: 'Decision', k: 'decision' }, { l: 'Source', k: 'source' }, { l: 'Update', k: 'cadence' }]} /></Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ assumptions */
export function OsAssumptions() {
  const A = useOs((s) => s.book.assume); const I = useOs((s) => s.book.inputs);
  const row = (k: keyof OsAssumptions, l: string, unit: string, owner: string, note: string, asPct = false) => ({ k, l, unit, owner, note, asPct });
  const rows = [
    row('growth', 'FY2027-28 growth assumption', '%', 'Finance / Buy-Side', 'Planning assumption until approved allocation is issued.', true),
    row('utilFloor', 'Target utilization floor', '%', 'Buy-Side', 'Planned commitment posture.', true),
    row('utilCeiling', 'Target utilization ceiling', '%', 'Buy-Side / Decision Room', 'Requires explicit exception above this line.', true),
    row('retentionReserve', 'Retention reserve', '$', 'Buy-Side', 'INPUT REQUIRED until an authorized value is supplied.'),
    row('replacementReserve', 'Replacement reserve', '$', 'Buy-Side + Personnel', 'INPUT REQUIRED until an authorized value is supplied.'),
    row('contingencyReserve', 'Contingency reserve', '$', 'Buy-Side', 'INPUT REQUIRED until an authorized value is supplied.'),
    row('opportunityReserve', 'Opportunity reserve', '$', 'Decision Room', 'INPUT REQUIRED until an authorized value is supplied.'),
    row('criticalGap', 'Critical gap threshold', 'Bodies', 'Player Personnel', 'Reference value; the room status rule (as in the workbook) flags CRITICAL at net need ≥ 3.'),
    row('highCapitalFloor', 'High capital review floor', '$', 'Buy-Side', 'Athletes at or above this current-year exposure receive weekly economic review.'),
    row('agingDays', 'Retention decision aging', 'Days', 'Buy-Side', 'Open decisions this many days past their date are escalated.'),
  ];
  const inputs: [keyof OsInputs, string][] = [['allocation2627', 'FY2026-27 football allocation'], ['forecastAvailable2627', 'FY2026-27 forecast available'], ['forecastCommitted2627', 'FY2026-27 forecast committed'],
    ['separateBuyout', 'Separate buyout line (outside athlete CAPS)'], ['classObligation2728', 'Proposed FY2027-28 class obligation'], ['basePortalBodies', 'Base portal priority bodies']];
  return <OsHead title="Control Assumptions & Thresholds" q="Blue inputs. Each change is logged, undoable and flows through every dependent view.">
    <div className="grid g21">
      <Panel title="Assumptions" oda="DECIDE"><Table rows={rows} opts={{ csv: false }} cols={[{ l: 'Assumption', f: (r) => r.l }, { l: 'Value', f: (r) => <NumField v={A[r.k] as number | null} asPct={r.asPct} w={120} ph={r.unit === '$' ? 'INPUT REQUIRED' : ''}
        onSave={(v) => { if (v == null && !String(r.k).endsWith('Reserve')) return; setAssume(r.k, v as never); }} /> }, { l: 'Unit', f: (r) => r.unit }, { l: 'Owner', f: (r) => r.owner }, { l: 'Operating note', f: (r) => <span className="t2">{r.note}</span> }]} /></Panel>
      <Panel title="Source-reported program inputs" oda="OBSERVE"><div className="frm">{inputs.map(([k, l]) => <span key={k} style={{ display: 'contents' }}><label>{l}</label><NumField v={I[k] as number} onSave={(v) => v != null && setInput(k, v as never)} /></span>)}
        <label>Base portal mix</label><TxtField v={I.basePortalMix} onSave={(v) => setInput('basePortalMix', v)} /><label>Class status</label><TxtField v={I.classStatus} onSave={(v) => setInput('classStatus', v)} /></div></Panel>
    </div>
    <Panel title="Status logic"><Table rows={[['GREEN', 'Within authorized operating range / no immediate exception required.', 'Continue / monitor', 'Owner accountable'], ['YELLOW', 'Near threshold, unresolved, or requires active plan.', 'Correct / resolve', 'Owner + Buy-Side'],
      ['RED', 'Threshold breached, material risk, or decision overdue.', 'Escalate / decide', 'Decision Room'], ['GRAY', 'Not enough verified information to classify.', 'Verify data', 'Data owner']]} opts={{ csv: false }}
      cols={[{ l: 'Status', f: (r) => <RagTag s={r[0]} /> }, { l: 'Definition', f: (r) => r[1] }, { l: 'Action', f: (r) => r[2] }, { l: 'Governance', f: (r) => r[3] }]} /></Panel>
  </OsHead>;
}

/* ------------------------------------------------------------------ guide, lineage, change log */
export function OsGuide() {
  const b = useOs((s) => s.book); const log = useOs((s) => s.log); const m = useOsModel(); const I = b.inputs;
  const lineage: [string, string, string, string][] = [
    ['FY2026-27 football allocation', 'Football-specific internal allocation for the current fiscal year.', 'Verified input', money(I.allocation2627)],
    ['2026-27 athlete CAPS total', 'Sum of 2026-27 CAPS across the master records.', 'Formula · Roster Master', money(m.capsTotal)],
    ['Separate buyout line', 'Held separate from the athlete CAPS total.', 'Verified input', money(I.separateBuyout)],
    ['CAPS ledger residual', 'Allocation less athlete CAPS total less the separate buyout.', 'Calculated', money(m.ledgerResidual)],
    ['FY2026-27 forecast committed', 'Fall 2026 plus Spring 2027 committed/forecast obligations.', 'Source-reported', money(I.forecastCommitted2627)],
    ['FY2026-27 forecast available', 'Available/uncommitted capacity after forecast obligations.', 'Source-reported', money(I.forecastAvailable2627)],
    ['Internal 2+ season inventory', 'Rows with internal eligibility ≥ 2, excluding REMOVED.', 'Formula count', String(m.counts.inv2plus)],
    ['1-season inventory', 'Rows with exactly 1 eligibility season remaining.', 'Formula count', String(m.counts.inv1)],
    ['Blank eligibility records', 'Rows with no internal eligibility value.', 'Formula count', String(m.counts.blankElig)],
    ['Existing FY2027-28 CAPS', 'Sum of 2027-28 CAPS across the master records.', 'Formula · Roster Master', money(m.existing2728)],
    ['Proposed FY2027-28 class obligation', 'Source-reported obligation for the proposed class.', 'Proposed', money(I.classObligation2728)],
    ['Prior target board total', 'Sum of stated values on the earlier target board.', 'Source-reported', money(I.priorBoardTotal)],
  ];
  return <OsHead title="Operating Guide · Metric Lineage · Change Log" q="How to run the Roster Capital OS.">
    <Panel title="Operating loop"><OperatingLoop /></Panel>
    <Panel title="Operating guide"><Table rows={b.guide} opts={{ csv: false }} cols={GUIDE_HEADER.map((h, i) => ({ l: h, f: (r: string[]) => <span style={{ whiteSpace: 'normal' }}>{r[i]}</span> }))} /></Panel>
    <div className="grid g2">
      <Panel title="Metric definitions · live values"><Table rows={lineage} opts={{ csv: false }} cols={[{ l: 'Metric', f: (r) => r[0] }, { l: 'Definition', f: (r) => <span className="t2" style={{ whiteSpace: 'normal' }}>{r[1]}</span> }, { l: 'Type', f: (r) => r[2] }, { l: 'Current', n: true, f: (r) => r[3] }]} /></Panel>
      <Panel title="Retention underwriting standard"><dl className="kv">{b.method.map(([k, v]) => <span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></span>)}</dl>
        {b.sources.length > 0 && <><h4 className="muted" style={{ margin: '10px 0 4px' }}>Sources</h4><dl className="kv">{b.sources.map(([k, v]) => <span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{/^https?:/.test(v) ? <a className="muted" href={v} target="_blank" rel="noopener">{v} ↗</a> : v}</dd></span>)}</dl></>}</Panel>
    </div>
    <Panel title="Change log · this browser" n={log.length}>{log.length ? <Table rows={log} opts={{ maxh: 360 }} cols={[{ l: 'Time', k: 't' }, { l: 'Change', k: 'msg' }]} /> : <div className="muted">No changes yet.</div>}</Panel>
    <Note>Data handling: an imported workbook is parsed in this browser and stored only in this browser's local storage. Nothing is uploaded and nothing is written to the repository. Use “Clear local data” on a shared machine.</Note>
  </OsHead>;
}
