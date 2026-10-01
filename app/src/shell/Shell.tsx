/* Terminal chrome: top bar + ticker, command bar, sidebar nav, intelligence rail, tooltip and drill-down delegation. */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AS_OF, AS_OF_M, GROUPS, SEASON_FY, TICKERS } from '../engine/constants';
import type { Model } from '../engine/model';
import { dateLabel, daysTo } from '../engine/tape';
import { parseDatasetFile } from '../data/load';
import { logAudit, store, useModel, useStore } from '../state/store';
import { Money, Sel } from '../ui/components';
import { fmtM, monthLabel, pctf } from '../ui/fmt';
import { trEps, trHold } from '../screens/shared';
import { NAV } from './nav';

/* ---------------------------------------------------------------- top bar & ticker */
export function TopBar() {
  const M = useModel(); const fy = useStore((s) => s.fy); const imported = useStore((s) => s.imported); const S = M.settings;
  const cap = M.caps[fy], com = M.committed[fy], dry = cap - com; const nBook = M.episodes.filter((e) => e.kind === 'FCST26' && !e.imported).length;
  const fyKey = fy === 2025 ? 'FY25-26' : 'FY26-27';
  const comItems = trHold(M, M.holdings(fy), fy).concat(trEps(M.buyouts.filter((b) => b.season === fy || (fy === 2026 && b.kind === 'BUYOUT' && !!b.capsBy['FY26-27'])), fyKey));
  const items = [{ t: 'CUBSMI', v: M.A.cubsmi.price[2026].v, p: M.A.cubsmi.price[2025].v, go: '#/cubsmi', why: '', low: false }]
    .concat(TICKERS.map((T) => ({ t: T.t, v: M.A.index[T.g][2026].v, p: M.A.index[T.g][2025].v, go: '#/pos/' + T.t, why: M.A.index[T.g][2026].why, low: Math.min(M.A.market[T.g][2024].n, M.A.market[T.g][2026].n) < S.lowN })));
  const track = <>{items.map((x) => (x.v == null
    ? <span key={x.t} className="tk" data-go={x.go} data-tip={x.why || ''}><b>{x.t}</b><span className="muted">N/A — insufficient history</span></span>
    : <span key={x.t} className="tk" data-go={x.go}><b>{x.t}</b>{x.v.toFixed(1)}{x.low && <span className="low">LOW</span>} {x.p ? <span className={x.v >= x.p ? 'up' : 'down'}>{x.v >= x.p ? '▲' : '▼'}{Math.abs((x.v / x.p - 1) * 100).toFixed(1)}%</span> : null}</span>))}
    <span className="tk" data-go="#/drypowder"><b>DRY PWDR</b>{fmtM(M.caps[2026] - M.committed[2026])}</span><span className="tk" data-go="#/concentration"><b>TOP5</b>{pctf(M.A.conc[2026].top5)}</span></>;
  return <>
    <div id="capbar">
      <div className="cb"><small>Fiscal Year</small><span><Sel path="fy" opts={[[2025, 'FY25-26'], [2026, 'FY26-27']]} value={fy} /></span></div>
      <div className="cb"><small>Roster</small><span>{M.data.rosters[String(fy) as '2026'].length}</span></div>
      <div className="cb"><small>Cap</small><span><Money v={cap} items={[{ pid: '—', eid: null, amount: cap, src: fy === 2025 ? 'FB_RSLAs_25-26 › AL190 / AQ189' : 'FB_RSLAs_25-26 › AM190 / Sp26 forecasting A130' }]} label={'Cap ' + SEASON_FY[fy]} /></span></div>
      <div className="cb"><small>Committed</small><span><Money v={com} items={comItems} label={'Committed ' + SEASON_FY[fy]} /></span></div>
      <div className="cb"><small>Dry Powder</small><span className={dry < 0 ? 'down' : ''}>{fmtM(dry)}</span></div>
      <div className="cb"><small>Util</small><span>{pctf(com / cap)}</span></div>
      <div className="cb"><small>Book</small><span className="up" data-tip={fy === 2025 ? 'FY25-26 final/amended RSLA ledger' : imported ? 'Session import: ' + imported.file : `FY26-27 = current FB 26-27 Rev Share book (${nBook} records, ties to control block)`}>{fy === 2025 ? 'RSLA' : imported ? 'IMPORT' : '26-27 BOOK'}</span></div>
    </div>
    <div id="tape"><div className="track">{track}{track}</div></div>
  </>;
}

/* ---------------------------------------------------------------- dataset badge (source / swap) */
export function DatasetBadge() {
  const source = useStore((s) => s.source); const label = useStore((s) => s.sourceLabel); const ref = useRef<HTMLInputElement>(null);
  const cls = source === 'sample' ? 'ESTIMATED' : 'VERIFIED';
  const onFile = async (f?: File) => {
    if (!f) return;
    try { const d = await parseDatasetFile(f); store.set({ data: d.data, source: d.source, sourceLabel: d.label, imported: null, loadError: null }); logAudit('Dataset loaded from file ' + f.name); }
    catch (e) { alert((e as Error).message); }
  };
  return <div className="dsbar"><span className={`tag ${cls}`} data-tip={source === 'sample' ? 'Synthetic data — no real athletes. Load the local dataset file to see real figures.' : 'Loaded locally in this browser; nothing is uploaded.'} onClick={() => ref.current?.click()}>
    {source === 'sample' ? 'SAMPLE DATA' : 'DATA'} · {label}</span><input ref={ref} type="file" accept=".json,.html,.htm" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} /></div>;
}

/* ---------------------------------------------------------------- nav */
export function SideNav({ cur }: { cur: string }) {
  const min = useStore((s) => s.sidebarMin); const base = cur.split('/')[0];
  const alias = (r: string) => (base === 'pos' && r === 'positions') || (base === 'player' && r === 'securities') || (base === 'room' && r === 'rooms');
  return <nav id="side" className={min ? 'min' : ''}>{NAV.map(([n, l, subs]) => {
    const on = subs.some(([, r]) => r === cur || r === base || (base === 'tape' && r.startsWith('tape')) || alias(r));
    return <div key={n}><div className={`nh ${on ? 'act' : ''}`} data-go={`#/${subs[0][1]}`}><span className="nn">{n}</span><span className="nl">{l}</span></div>
      <div className="sub">{subs.map(([sl, r]) => <a key={r} href={`#/${r}`} className={r === cur || (r === base && !cur.includes('/')) || alias(r) ? 'act' : ''}>{sl}</a>)}</div></div>;
  })}</nav>;
}

/* ---------------------------------------------------------------- rail */
export function Rail() {
  const M = useModel(); const on = useStore((s) => s.rail); const A = M.A; const al = A.alerts;
  const dec = A.maturity.rows.filter((r) => r.final && r.final > AS_OF_M && r.final <= '2026-12').sort((a, b) => b.remaining - a.remaining).slice(0, 8);
  const ev = A.tape.filter((t) => t.date <= AS_OF && t.prec === 'day').slice(0, 8);
  const Item = ({ lvl, go, c, x }: { lvl: string; go: string; c: ReactNode; x: ReactNode }) => <div className={`al lv-${lvl}`} data-go={go}><i></i><div><div className="c">{c}</div><div className="x">{x}</div></div></div>;
  return <aside id="rail" className={on ? '' : 'off'}>
    <div className="rsec"><h4><span>Market Alerts</span><a href="#/alerts" className="muted">{al.length}</a></h4>{al.slice(0, 9).map((a, i) => <Item key={i} lvl={a.lvl} go={a.go} c={a.code} x={a.txt} />)}</div>
    <div className="rsec"><h4><span>Operating Calendar</span><a href="#/calendar" className="muted">all</a></h4>{M.data.drive.calendar.events.filter((e) => e[0] > AS_OF).slice(0, 5).map((e, i) => <Item key={i} lvl={e[2] === 'BOARD' ? 'crit' : 'info'} go="#/calendar" c={`T-${daysTo(e[0])}d · ${e[0].slice(5)}`} x={e[1]} />)}</div>
    <div className="rsec"><h4><span>Upcoming Decisions · ≤ Dec-26</span><a href="#/maturity" className="muted">wall</a></h4>{dec.length ? dec.map((r) => <Item key={r.h.pid} lvl="warn" go={`#/player/${encodeURIComponent(r.h.pid)}`} c={`${M.players.get(r.h.pid)!.ticker} · ${monthLabel(r.final!)}`} x={`${r.h.pid} — renew / replace / walk · ${fmtM(r.remaining)} left`} />) : <div className="muted">None</div>}</div>
    <div className="rsec"><h4><span>Capital Events</span><a href="#/tape" className="muted">tape</a></h4>{ev.map((t, i) => <Item key={i} lvl="info" go={`#/player/${encodeURIComponent(t.pid)}`} c={<><span className={`act ${t.action}`}>{t.action}</span> {t.pid}</>}
      x={`${dateLabel(t)} · ${t.nu != null ? fmtM(t.nu) : '—'}${t.delta != null ? ` (${t.delta >= 0 ? '+' : ''}${fmtM(t.delta)})` : ''}`} />)}</div>
  </aside>;
}

/* ---------------------------------------------------------------- command bar */
export interface Cmd { k: string; d: string; go: string }
export function cmdIndex(M: Model): Cmd[] {
  const out: Cmd[] = [];
  TICKERS.forEach((T) => out.push({ k: T.t, d: 'Open ' + T.name + ' market', go: '#/pos/' + T.t }));
  out.push({ k: 'CUBSMI', d: 'CU Buy-Side Market Index', go: '#/cubsmi' }, { k: 'PORT', d: 'Portfolio', go: '#/portfolio' }, { k: 'CAP', d: 'Capital allocation', go: '#/allocation' },
    { k: 'INDEX', d: 'All position indexes', go: '#/positions' }, { k: 'HEAT', d: 'Market heat map', go: '#/heat' }, { k: 'MAT 30', d: '30-day maturities', go: '#/maturity/30' }, { k: 'MAT 60', d: '60-day maturities', go: '#/maturity/60' }, { k: 'MAT 90', d: '90-day maturities', go: '#/maturity/90' },
    { k: 'TAPE', d: 'Transaction tape', go: '#/tape' }, { k: 'DQ', d: 'Data quality', go: '#/dq' }, { k: 'SCEN', d: 'Scenario manager', go: '#/scenarios' }, { k: 'DEAL', d: 'Deal builder', go: '#/deal' }, { k: 'IMPORT', d: 'Load current 26-27 book', go: '#/recon' });
  GROUPS.concat(['SEC']).forEach((g) => { out.push({ k: 'CHURN ' + g, d: g + ' churn', go: '#/pos/' + (TICKERS.find((t) => t.g === g)?.t ?? 'undefined') + '/CHURN' }, { k: 'UNDERWRITE ' + g, d: 'Underwrite ' + g, go: '#/underwrite/' + g }, { k: '2025 CU' + g, d: 'Historical 2025 ' + g + ' market', go: '#/historical/2025/' + g }, { k: '2024 CU' + g, d: 'Historical 2024 ' + g + ' market', go: '#/historical/2024/' + g }); });
  for (const p of M.players.values()) { out.push({ k: p.ticker.split('.')[0], d: p.name, go: '#/player/' + encodeURIComponent(p.id) }); out.push({ k: 'REPLACE ' + p.name.toUpperCase(), d: 'Replacement analysis', go: '#/replace/' + encodeURIComponent(p.id) }); }
  const words: Record<string, string> = { QUARTERBACKS: 'CUQB', 'RUNNING BACKS': 'CURB', 'WIDE RECEIVERS': 'CUWR', 'TIGHT ENDS': 'CUTE', 'OFFENSIVE LINE': 'CUOL', 'DEFENSIVE LINE': 'CUDL', EDGE: 'CUEDGE', LINEBACKERS: 'CULB', CORNERBACKS: 'CUCB', SAFETIES: 'CUS', SECONDARY: 'CUSEC', SPECIALISTS: 'CUPK' };
  Object.entries(words).forEach(([w, t]) => out.push({ k: w, d: 'Open ' + t, go: '#/pos/' + t }));
  [2024, 2025, 2026].forEach((y) => out.push({ k: y + ' TRANSACTIONS', d: y + ' transaction tape', go: '#/tape/ALL/' + y }));
  return out;
}
export function cmdSearch(cmds: Cmd[], q0: string): Cmd[] {
  const q = q0.trim().toUpperCase(); if (!q) return [];
  const mp = q.match(/^MAT\s*(\d+)$/); if (mp) return [{ k: q, d: `Maturities ≤ ${mp[1]} days`, go: '#/maturity/' + mp[1] }];
  const pl = q.replace(/^PLAYER\s+/, '');
  return cmds.map((c) => { const K = c.k, Dd = c.d.toUpperCase(); const s = K === q ? 100 : K.startsWith(q) ? 80 : Dd.startsWith(pl) ? 70 : K.includes(q) ? 50 : Dd.includes(pl) ? 40 : 0; return { ...c, s }; })
    .filter((c) => c.s > 0).sort((a, b) => b.s - a.s).slice(0, 14);
}
export function CmdBar() {
  const M = useModel(); const cmds = useMemo(() => cmdIndex(M), [M]);
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0); const [open, setOpen] = useState(false); const inp = useRef<HTMLInputElement>(null);
  const r = cmdSearch(cmds, q); const cur = Math.min(sel, r.length - 1);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const t = (document.activeElement?.tagName || ''); if (e.key === '/' && t !== 'INPUT' && t !== 'SELECT') { e.preventDefault(); inp.current?.focus(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const close = () => { setQ(''); setOpen(false); inp.current?.blur(); };
  return <div id="cmd"><input ref={inp} placeholder="CUOL · MAT 90 · CHURN WR · UNDERWRITE QB · PLAYER NAME OR TICKER …  ( / )" autoComplete="off" spellCheck={false} value={q}
    onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
    onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { setSel(Math.min(r.length - 1, cur + 1)); setOpen(true); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { setSel(Math.max(0, cur - 1)); setOpen(true); e.preventDefault(); }
      else if (e.key === 'Enter') { if (r[cur]) { location.hash = r[cur].go; close(); } }
      else if (e.key === 'Escape') close();
    }} />
    <div id="cmdlist" style={{ display: open && r.length ? 'block' : 'none' }}>{r.map((c, i) => <div key={c.k + c.go} className={i === cur ? 'on' : ''} data-go={c.go}><span className="mono">{c.k}</span><span>{c.d}</span></div>)}</div></div>;
}

/* ---------------------------------------------------------------- global delegation: data-go drill-down + data-tip tooltip */
export function useGlobalDelegation() {
  useEffect(() => {
    const tipEl = () => document.getElementById('tip');
    const click = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest('a[href^="#"]')) return;
      const go = t.closest<HTMLElement>('[data-go]');
      if (go && !t.closest('select,input,button:not([data-go])')) { location.hash = go.dataset.go!; store.set({ trace: null }); }
    };
    const over = (e: MouseEvent) => { const tip = tipEl(); if (!tip) return; const t = (e.target as Element).closest<HTMLElement>('[data-tip]'); if (!t || !t.dataset.tip) { tip.style.display = 'none'; return; } tip.textContent = t.dataset.tip; tip.style.display = 'block'; };
    const move = (e: MouseEvent) => { const tip = tipEl(); if (tip && tip.style.display === 'block') { const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; tip.style.top = Math.min(innerHeight - h - 8, e.clientY + 14) + 'px'; } };
    document.addEventListener('click', click); document.addEventListener('mouseover', over); document.addEventListener('mousemove', move);
    return () => { document.removeEventListener('click', click); document.removeEventListener('mouseover', over); document.removeEventListener('mousemove', move); };
  }, []);
}

/* ---------------------------------------------------------------- per-screen error boundary */
export class ScreenBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(err); }
  render() { return this.state.err ? <div className="note">Screen error: {this.state.err.message}</div> : this.props.children; }
}
