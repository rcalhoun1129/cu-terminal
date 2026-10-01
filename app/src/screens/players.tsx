/* 04 PLAYERS · 05 TRANSACTIONS */
import { useEffect, useRef, useState } from 'react';
import { AS_OF_M, POSMAP } from '../engine/constants';
import { acqBucket, stats, type Holding } from '../engine/model';
import { logAudit, store, useModel, useStore } from '../state/store';
import { MonthBars, PctBar } from '../ui/charts';
import { chgTxt, Kpi, Money, NavSel, Panel, PLink, Table, Tag } from '../ui/components';
import { fmt$, fmt0, fmtM, monthLabel, monthRange, norm, pctf, rank, sum } from '../ui/fmt';
import { allPlayerRows, bandLabel, TapeTable, trHold } from './shared';

const goP = (id: string) => '#/player/' + encodeURIComponent(id);

/** Comparison set toggle (reference ACT.cmp): max 5, oldest dropped, persisted. */
export function toggleCompare(pid: string) {
  const c = [...store.get().compare]; const i = c.indexOf(pid);
  if (i >= 0) c.splice(i, 1); else { if (c.length >= 5) c.shift(); c.push(pid); }
  store.set({ compare: c }, { persist: true }); logAudit('Comparison set: ' + c.join(', '));
}

export function Securities() {
  const M = useModel(); const rows = allPlayerRows(M).filter((r) => r.c24 || r.c25 || r.c26).sort((a, b) => b.c26 - a.c26 || b.c25 - a.c25);
  return <>
    <div className="ph"><h1>Player Securities</h1><span className="q">{rows.length} athletes with CU capital 2024–2026 · each is an individual security</span></div>
    <Panel title="Security master"><Table rows={rows} opts={{ tall: true, go: (r) => goP(r.p.id) }} cols={[
      { l: 'Ticker', v: (r) => r.p.ticker, f: (r) => <span className="mono warn">{r.p.ticker}</span> }, { l: 'Player', v: (r) => r.p.id, f: (r) => <PLink pid={r.p.id} /> },
      { l: 'Pos (latest)', f: (r) => r.p.lastPos || '—', v: (r) => r.p.lastPos }, { l: 'On 2026 roster', f: (r) => (r.p.seasons['2026'].onRoster ? <span className="up">YES</span> : <span className="muted">no</span>), v: (r) => (r.p.seasons['2026'].onRoster ? 1 : 0) },
      { l: '2024 coll.', n: true, v: (r) => r.c24, f: (r) => fmtM(r.c24) }, { l: 'FY25-26', n: true, v: (r) => r.c25, f: (r) => fmtM(r.c25) }, { l: 'FY26-27', n: true, v: (r) => r.c26, f: (r) => fmtM(r.c26) },
      { l: 'Lifetime CU (scheduled)', n: true, v: (r) => r.life, f: (r) => fmtM(r.life) }, { l: 'Identity', f: (r) => <Tag conf={r.p.identity} />, v: (r) => r.p.identity }]} /></Panel>
  </>;
}

export function Search({ args }: { args: string[] }) {
  const M = useModel(); const [q, setQ] = useState(args[0] || ''); const ref = useRef<HTMLInputElement>(null); const [deb, setDeb] = useState(q);
  useEffect(() => { const i = ref.current; if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, []);
  useEffect(() => { const t = setTimeout(() => { setDeb(q); history.replaceState(null, '', '#/search/' + encodeURIComponent(q)); }, 250); return () => clearTimeout(t); }, [q]);
  const n = norm(deb);
  const rows = n ? allPlayerRows(M).filter((r) => norm(r.p.id + ' ' + r.p.aliases.join(' ') + ' ' + r.p.legal.join(' ') + ' ' + r.p.ticker).includes(n) || r.p.ticker.toLowerCase().includes(deb.toLowerCase())) : [];
  return <>
    <div className="ph"><h1>Player Search</h1></div>
    <div className="filt"><input ref={ref} className="inp" id="psq" style={{ maxWidth: 420 }} placeholder="Name, legal name, alias or ticker…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <Panel title="Results">{rows.length ? <Table rows={rows} opts={{ go: (r) => goP(r.p.id) }} cols={[
      { l: 'Ticker', f: (r) => <span className="mono warn">{r.p.ticker}</span> }, { l: 'Player', f: (r) => <PLink pid={r.p.id} /> },
      { l: 'Aliases / legal', f: (r) => [...r.p.legal, ...r.p.aliases].filter((a) => a !== r.p.id).slice(0, 4).join(' · '), cls: 'wrap' },
      { l: 'FY26-27', n: true, v: (r) => r.c26, f: (r) => fmtM(r.c26) }, { l: 'Lifetime', n: true, v: (r) => r.life, f: (r) => fmtM(r.life) }]} /> : <div className="empty">Type at least one character</div>}</Panel>
  </>;
}

export function PlayerScreen({ args }: { args: string[] }) {
  const M = useModel(); const compare = useStore((s) => s.compare); const band = useStore((s) => s.band);
  const pid = args[0] || ''; const p = M.players.get(pid);
  if (!p) return <div className="note">Unknown player {pid}</div>;
  const eps = M.epsByPlayer.get(pid) || []; const h26 = M.h[2026].get(pid), h25 = M.h[2025].get(pid), h24 = M.h[2024].get(pid);
  const cur = h26 || h25 || h24; const g = cur ? cur.bs : POSMAP[p.lastPos as string] || 'UNK';
  const months = M.pMonths.get(pid) || {}; const keys = Object.keys(months).sort(); const life = sum(Object.values(months));
  const pool = M.bandPool(g); const pr = cur ? rank(pool, cur.capital) : NaN; const st = { ...stats(pool), _a: pool };
  const pres = M.A.life.presence.get(pid)!; const tp = M.third.filter((t) => t.pid === pid);
  const mat = M.A.maturity.rows.find((r) => r.h.pid === pid);
  const tapeRows = M.A.tape.filter((t) => t.pid === pid);
  const allM = keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
  const evMonth = new Map<string, string[]>(); tapeRows.forEach((t) => { const k = t.date.slice(0, 7); if (!evMonth.has(k)) evMonth.set(k, []); evMonth.get(k)!.push(t.action); });
  const inCmp = compare.includes(pid);
  const lifeItems = eps.filter((e) => e.kind !== 'COLLECTIVE_SP25' && e.kind !== 'BUYOUT').map((e) => ({ pid, eid: e.id, amount: sum(Object.entries(e.months || {}).filter(([k]) => !(e.kind === 'RSLA' && k >= '2026-07')).map(([, v]) => v)) }));
  const life6 = [['ACQUIRED', pres.length ? pres[0] + ' (' + acqBucket(p.seasons[String(pres[0]) as '2024'].acq) + ')' : '—'], ['SIGNED', eps.find((e) => e.signed)?.signed || '—'], ['FIRST PAYMENT', keys[0] ? monthLabel(keys[0]) : '—'],
    ['AMENDED', eps.filter((e) => (e.amend || 0) > 0).length + ' amendment rows'], ['RENEWED', h25 && h26 ? 'FY26-27 agreement' : '—'], ['CURRENT', p.seasons['2026'].onRoster ? '2026 roster' : '—'], ['MATURITY', mat && mat.final ? monthLabel(mat.final) : '—']];
  return <>
    <div className="ph"><span className="tick" style={{ fontSize: 16 }}>{p.ticker}</span><h1>{p.name}</h1><span className="q">{p.lastPos || '—'} · {p.seasons['2026'].onRoster ? 'Current (2026 roster)' : 'Not on 2026 roster'} · {cur ? acqBucket(cur.acq) : ''} <Tag conf={p.identity} /></span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button className={`iconbtn ${inCmp ? 'on' : ''}`} onClick={() => toggleCompare(pid)}>{inCmp ? '✓ In comparison' : '+ Compare'}</button><a className="iconbtn" href={`#/replace/${encodeURIComponent(pid)}`}>Replacement ›</a><a className="iconbtn" href={`#/icomps/${encodeURIComponent(pid)}`}>Comparables ›</a></span></div>
    {p.offRosterNote && <div className="note">{p.offRosterNote}</div>}
    <div className="grid g6">
      <Kpi label="Current CAPS · FY26-27" value={h26 ? <Money v={h26.capital} items={trHold(M, [h26], 2026)} label={pid + ' FY26-27'} /> : '—'} prior={h25 ? `FY25-26 ${fmtM(h25.capital)}` : ''} delta={h25 && h26 ? chgTxt(h25.capital, h26.capital) : null} />
      <Kpi label="Contract face" value={fmtM(Math.max(0, ...eps.filter((e) => e.face).map((e) => e.face as number)))} prior={`${eps.length} episodes`} />
      <Kpi label="Position percentile" value={isFinite(pr) ? 'P' + pr.toFixed(0) : '—'} prior={`${g} · ${bandLabel(band)} · N=${pool.length}`} />
      <Kpi label="Roster / economic months" value={`${pres.length * 12} / ${keys.length}`} prior={`seasons ${pres.join(', ') || '—'} · ${keys.length ? monthLabel(keys[0]) + '–' + monthLabel(keys[keys.length - 1]) : ''}`} />
      <Kpi label="Maturity" value={mat && mat.final ? monthLabel(mat.final) : '—'} prior={mat ? `${fmtM(mat.remaining)} remaining · elig ${p.elig || '—'}` : `elig ${p.elig || '—'}`} />
      <Kpi label="Lifetime CU capital" value={<Money v={life} items={lifeItems} label={pid + ' lifetime (scheduled)'} />} prior={`cap/month ${fmtM(keys.length ? life / keys.length : NaN)} · ${h26 ? pctf(h26.capital / M.committed[2026], 2) + ' of portfolio' : ''}`} />
    </div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Capital history · month by month (scheduled)" oda="OBSERVE" foot="Grey = scheduled on or before the as-of date · orange = month with a contract event · Spring-25 transition payments are shown as their own episode in the table below.">
        <MonthBars mark={AS_OF_M} entries={allM.map((k) => ({ k, v: months[k] || 0, color: evMonth.has(k) ? '#d95926' : undefined, tip: `${monthLabel(k)}: ${fmt0(months[k] || 0)}${evMonth.has(k) ? '\nEvents: ' + evMonth.get(k)!.join(', ') : ''}` }))} /></Panel>
      <Panel title={'Market position · ' + g} oda="ASSESS">
        <PctBar st={st} v={cur ? cur.capital : null} />
        <dl className="kv"><dt>Location</dt><dd>{cur ? M.bandOf(g, cur.capital) : '—'}</dd><dt>P25 / P50 / P75 / P90</dt><dd>{[st.p25, st.p50, st.p75, st.p90].map((v) => fmtM(v)).join(' / ')}</dd><dt>Position share</dt><dd>{h26 ? pctf(h26.capital / M.A.market[g][2026].roomCapital) : '—'}</dd></dl>
        <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>Describes where the capital sits in CU's historical {g} distribution. It is not an evaluation of the athlete.</div></Panel>
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Lifecycle"><dl className="kv">{life6.map(([a, b]) => [<dt key={a + 't'}>{a}</dt>, <dd key={a + 'd'}>{b}</dd>])}</dl>
        <hr className="sep" /><dl className="kv"><dt>Roster age</dt><dd>{pres.length} season(s)</dd><dt>Economic age</dt><dd>{keys.length} compensated months</dd><dt>Contract age (latest term)</dt><dd>{(cur && cur.term) || '—'} months</dd></dl></Panel>
      <Panel title="Roster history · official" foot={`Legal / RSLA: ${p.legal.join(' · ') || '—'} · aliases: ${p.aliases.filter((a) => a !== p.id).join(' · ') || '—'}`}>
        <Table opts={{ csv: false }} rows={(['2024', '2025', '2026'] as const).map((s) => ({ s, ...p.seasons[s] })).filter((r) => r.onRoster)} cols={[{ l: 'Season', k: 's' }, { l: 'Position', k: 'pos' }, { l: 'Group', f: (r) => POSMAP[r.pos as string] || '—' }, { l: 'Class', k: 'cls' }, { l: 'Previous school', k: 'school' }, { l: 'Channel', k: 'acq' }]} /></Panel>
    </div>
    <BookRecord pid={pid} />
    <div style={{ marginTop: 8 }}><Panel title="Contract episodes"><Table rows={eps} cols={[{ l: 'Episode', k: 'id' }, { l: 'Regime', k: 'regime' }, { l: 'Type', k: 'kind' }, { l: 'Amend #', n: true, f: (r) => r.amend ?? '—' },
      { l: 'Face', n: true, v: (r) => r.face || 0, f: (r) => (r.face ? fmtM(r.face) : r.faceRaw || '—') }, { l: 'Fiscal capital', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={[{ pid, eid: r.id, amount: r.capital }]} label={r.id} /> },
      { l: 'Term', f: (r) => String(r.term ?? r.termRaw ?? '—') }, { l: 'Signed', f: (r) => r.signed || '—' }, { l: 'Status', f: (r) => r.status || '', cls: 'wrap' }, { l: 'Source', f: (r) => <span className="muted">{r.src}</span>, cls: 'wrap' }, { l: 'Conf', f: (r) => <Tag conf={r.conf} /> }]} /></Panel></div>
    {tp.length > 0 && <div style={{ marginTop: 8 }}><Panel title="Total economic package · third-party (separate ledger, unverified)" foot="Never added to institutional CAPS. Shown only because external dollars are documented.">
      <Table opts={{ csv: false }} rows={tp} cols={[{ l: 'Source', k: 'src' }, { l: 'Package', n: true, f: (r) => fmt0(r.package) }, { l: 'CU base', n: true, f: (r) => fmt0(r.cuBase) }, { l: 'Paradigma', n: true, f: (r) => fmt0(r.paradigma) }, { l: 'Incentives', n: true, f: (r) => fmt0(r.incentives) }, { l: 'Conf', f: (r) => <Tag conf={r.conf} /> }]} /></Panel></div>}
    <div style={{ marginTop: 8 }}><Panel title="Transactions"><TapeTable M={M} rows={tapeRows} /></Panel></div>
  </>;
}

/** 26-27 book record panel (reference: injected before "Contract episodes"). */
function BookRecord({ pid }: { pid: string }) {
  const M = useModel(); const all = M.epsByPlayer.get(pid) || [];
  const bk = all.filter((e) => e.book); const sn = all.filter((e) => e.kind === 'SNAP26'); if (!bk.length && !sn.length) return null;
  const e = bk[0]; const snapV = sum(sn.map((x) => x.snap!['FY26-27']));
  return <div style={{ marginTop: 8 }}><Panel title="26-27 book record" foot={e?.src ? e.src + ' · VERIFIED' : ''}><div className="grid g4">
    <dl className="kv"><dt>Fall-26 status</dt><dd>{e?.status || '—'}</dd><dt>Elig. seasons remaining</dt><dd>{e?.eligRem || '—'}</dd><dt>RSLA version</dt><dd>{e?.rslaVersion || '—'}</dd></dl>
    <dl className="kv"><dt>Contract compensation</dt><dd>{e?.face != null ? fmt$(e.face) : e?.faceRaw || '—'}</dd><dt>Term</dt><dd>{e?.termRaw || '—'}</dd><dt>$ history</dt><dd>{e?.history || '—'}</dd></dl>
    <dl className="kv"><dt>FY26-27 CAPS</dt><dd>{e?.capsBy ? fmt$(e.capsBy['FY26-27']) : '—'}</dd><dt>Fall-26 / Spring-27</dt><dd>{e?.capsBy ? fmtM(e.capsBy.F26) + ' / ' + fmtM(e.capsBy.S27) : '—'}</dd><dt>FY27-28 CAPS</dt><dd>{e?.capsBy ? fmt$(e.capsBy['FY27-28']) : '—'}</dd></dl>
    <dl className="kv"><dt>Spring-26 forecast</dt><dd>{sn.length ? fmt$(snapV) : 'not in snapshot'}</dd><dt>Book vs forecast</dt><dd>{sn.length && e?.capsBy ? fmt$(e.capsBy['FY26-27'] - snapV) : '—'}</dd><dt>Note</dt><dd>{e?.note || '—'}</dd></dl>
  </div></Panel></div>;
}

export function PCompare() {
  const M = useModel(); const compare = useStore((s) => s.compare); const ids = compare.filter((id) => M.players.has(id));
  const opts = [...M.players.values()].filter((p) => M.h[2026].has(p.id) || M.h[2025].has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
  const H = (id: string): Partial<Holding> => M.h[2026].get(id) || M.h[2025].get(id) || M.h[2024].get(id) || {};
  const rows: [string, (id: string) => React.ReactNode][] = [
    ['Position', (id) => H(id).pos || '—'], ['Acquisition', (id) => acqBucket(H(id).acq as string)], ['FY26-27 CAPS', (id) => fmtM(M.playerSeasonCap(id, 2026))], ['FY25-26 CAPS', (id) => fmtM(M.playerSeasonCap(id, 2025))],
    ['Contract face', (id) => fmtM(Math.max(0, ...(M.epsByPlayer.get(id) || []).map((e) => e.face || 0)))], ['Contract months', (id) => H(id).term ?? '—'], ['Roster months', (id) => M.A.life.presence.get(id)!.length * 12],
    ['Capital / month', (id) => fmtM(H(id).perMonth as number)], ['Position percentile', (id) => { const h = H(id); const v = rank(M.bandPool(h.bs as string), h.capital as number); return isFinite(v) ? 'P' + v.toFixed(0) : '—'; }],
    ['Band', (id) => M.bandOf(H(id).bs as string, H(id).capital as number)], ['Eligibility', (id) => M.players.get(id)!.elig || '—'], ['Retention status', (id) => (M.players.get(id)!.seasons['2026'].onRoster ? 'On 2026 roster' : 'Departed')],
    ['Historical comparable range', (id) => { const b = M.bands(H(id).bs as string); return b.n >= M.settings.minN ? fmtM(b.st.p25) + '–' + fmtM(b.st.p75) : '—'; }]];
  return <>
    <div className="ph"><h1>Player Comparables</h1><span className="q">Up to 5 athletes side by side</span></div>
    <div className="filt"><label>Add</label><select className="inp" style={{ maxWidth: 320 }} id="cmpadd" value="" onChange={(e) => { if (e.target.value) toggleCompare(e.target.value); }}><option value="">— choose —</option>{opts.map((p) => <option key={p.id}>{p.id}</option>)}</select>
      {ids.map((id) => <span key={id} className="pill">{id}<button onClick={() => toggleCompare(id)}>✕</button></span>)}</div>
    {ids.length ? <Panel title="Comparison"><div className="tw"><table className="t"><thead><tr><th></th>{ids.map((id) => <th key={id} className="n"><a href={goP(id)}>{id}</a></th>)}</tr></thead>
      <tbody>{rows.map(([l, f]) => <tr key={l}><th style={{ position: 'static' }}>{l}</th>{ids.map((id) => <td key={id} className="n">{f(id)}</td>)}</tr>)}</tbody></table></div></Panel>
      : <div className="empty">Add athletes above or use “+ Compare” on any player security</div>}
  </>;
}

export function Contracts() {
  const M = useModel(); const rows = M.episodes;
  return <>
    <div className="ph"><h1>Contract History</h1><span className="q">{rows.length} contract episodes · agreement → amendment → renewal</span></div>
    <Panel title="Episodes"><Table rows={rows} opts={{ tall: true, go: (r) => goP(r.pid) }} cols={[{ l: 'Episode', k: 'id' }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Regime', k: 'regime' }, { l: 'Type', k: 'kind' },
      { l: 'Amend', n: true, f: (r) => r.amend ?? '', v: (r) => r.amend || 0 }, { l: 'Face', n: true, v: (r) => r.face || 0, f: (r) => (r.face ? fmtM(r.face) : r.faceRaw || '—') },
      { l: 'Fiscal capital', n: true, v: (r) => r.capital, f: (r) => <Money v={r.capital} items={[{ pid: r.pid, eid: r.id, amount: r.capital }]} label={r.id} /> },
      { l: 'Term', f: (r) => String(r.term ?? r.termRaw ?? ''), v: (r) => +(r.term as number) || 0 }, { l: 'Signed', f: (r) => r.signed || '', v: (r) => r.signed || '' }, { l: 'Status', f: (r) => r.status || '', cls: 'wrap' },
      { l: 'Source', f: (r) => <span className="muted">{r.src}</span> }, { l: 'Conf', f: (r) => <Tag conf={r.conf} />, v: (r) => r.conf }]} /></Panel>
  </>;
}

export function PLifecycle() {
  const M = useModel();
  const rows = allPlayerRows(M).filter((r) => r.life > 0).map((r) => { const pm = M.pMonths.get(r.p.id) || {}; const k = Object.keys(pm).filter((x) => (pm[x] || 0) > 0).sort(); return { ...r, first: k[0], last: k[k.length - 1], comp: k.length, pres: M.A.life.presence.get(r.p.id)! }; });
  return <>
    <div className="ph"><h1>Player Lifecycle</h1><span className="q">Program tenure (season grain) · economic tenure (months) · contract tenure</span></div>
    <Panel title="Lifecycle clocks"><Table rows={rows} opts={{ tall: true, go: (r) => goP(r.p.id) }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.p.id} />, v: (r) => r.p.id }, { l: 'Seasons on roster', f: (r) => r.pres.join(', ') || '—', v: (r) => r.pres.length },
      { l: 'Program tenure (mo)', n: true, v: (r) => r.pres.length * 12, f: (r) => r.pres.length * 12 }, { l: 'First paid', f: (r) => (r.first ? monthLabel(r.first) : ''), v: (r) => r.first }, { l: 'Last paid (sched.)', f: (r) => (r.last ? monthLabel(r.last) : ''), v: (r) => r.last },
      { l: 'Compensated months', n: true, k: 'comp' }, { l: 'Lifetime capital', n: true, v: (r) => r.life, f: (r) => fmtM(r.life) }, { l: 'Cap / comp. month', n: true, v: (r) => r.life / r.comp, f: (r) => fmtM(r.life / r.comp) }]} /></Panel>
  </>;
}

export function Eligibility() {
  const M = useModel(); const rows = [...M.players.values()].filter((p) => p.seasons['2026'].onRoster || M.h[2026].has(p.id));
  const f27 = (id: string) => sum((M.epsByPlayer.get(id) || []).filter((e) => e.kind !== 'RSLA').map((e) => +(e.capsBy['FY27-28'] || 0)));
  return <>
    <div className="ph"><h1>Eligibility</h1><span className="q">2026 roster class + RSLA eligibility (years to play – seasons) recovered from date-coerced cells</span></div>
    <div className="note">The RSLA eligibility column was auto-converted to dates by the spreadsheet (e.g. "5-4" stored as 2025-05-04). Values were recovered as month-day. Confirm against compliance before relying on them.</div>
    <Panel title="Eligibility register"><Table rows={rows} opts={{ tall: true, go: (r) => goP(r.id) }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.id} />, v: (r) => r.id }, { l: 'Pos', f: (r) => r.seasons['2026'].pos || r.lastPos || '', v: (r) => r.lastPos },
      { l: '2026 class (roster)', f: (r) => r.seasons['2026'].cls || '—', v: (r) => r.seasons['2026'].cls || '' }, { l: 'RSLA elig (yrs-seasons)', f: (r) => r.elig || '—', v: (r) => r.elig || '' },
      { l: 'RSLA status', f: (r) => r.rslaStatus || '', v: (r) => r.rslaStatus }, { l: 'FY26-27', n: true, v: (r) => M.playerSeasonCap(r.id, 2026), f: (r) => fmtM(M.playerSeasonCap(r.id, 2026)) },
      { l: 'FY27-28 committed', n: true, v: (r) => f27(r.id), f: (r) => fmtM(f27(r.id)) }]} /></Panel>
  </>;
}

export function Tape({ args, title = 'Transaction Tape' }: { args: string[]; title?: string }) {
  const M = useModel(); const action = args[0] || 'ALL', year = args[1] || 'ALL';
  let rows = M.A.tape;
  if (action && action !== 'ALL') rows = rows.filter((t) => (action === 'RENEW' ? ['RENEW', 'INCREASE', 'REDUCE'].includes(t.action) : action === 'TERMINATE' ? t.action === 'TERMINATE' : t.action === action));
  if (year && year !== 'ALL') rows = rows.filter((t) => t.date.startsWith(year) || (year === '2026' && t.prec === 'fy'));
  const acts = ['ALL', 'BUY', 'RETAIN', 'RENEW', 'AMEND', 'EXPIRE', 'TERMINATE', 'EXIT', 'BUYOUT'];
  return <>
    <div className="ph"><h1>{title}</h1><span className="q">Securities-style blotter · {rows.length} events · derived from contract episodes and official roster exits</span></div>
    <div className="filt"><label>Action</label><NavSel prefix="#/tape/" opts={acts} value={action} /><label>Year</label><NavSel prefix={`#/tape/${action}/`} opts={['ALL', '2024', '2025', '2026']} value={year} />
      <span className="muted">RENEW includes INCREASE / REDUCE. Dates: signed date when present, else first scheduled month; FY-dated = FY26-27 book (no signed date in file); offseason = roster exit.</span></div>
    <Panel><TapeTable M={M} rows={rows} tall /></Panel>
  </>;
}
