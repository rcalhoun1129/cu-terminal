/* 01 COMMAND CENTER */
import { AS_OF, AS_OF_M, SEASON_FY } from '../engine/constants';
import { daysTo } from '../engine/tape';
import { useModel, useStore } from '../state/store';
import { CapStack, HBars, Treemap, Stacked } from '../ui/charts';
import { Chg, chgTxt, Kpi, Money, Note, Panel, PLink, Table, TLink } from '../ui/components';
import { fmt$, fmt0, fmtM, idx, median, pctf, sgn, sum } from '../ui/fmt';
import { acqBucket } from '../engine/model';
import { allocRows, BoardTable, boardRows, bookMonths, CapStackBlock, CubsmiChart, gamesPerMonth, HeatTiles, TapeTable, trEps, trHold } from './shared';

export function Home() {
  const M = useModel(); const fy = useStore((s) => s.fy); const reserve = useStore((s) => s.assume.reserve);
  const A = M.A, prevFy = fy - 1, cap = M.caps[fy], com = M.committed[fy], dry = cap - com, D = M.data;
  const r26 = D.rosters[String(fy) as '2026'].length;
  const paid = M.holdings(fy).filter((h) => h.capital >= M.settings.threshold).length, paidAll = M.holdings(fy).filter((h) => h.capital > 0).length;
  const paidPrev = M.holdings(prevFy).filter((h) => h.capital >= M.settings.threshold).length;
  const ix = A.cubsmi.price; const alloc = allocRows(M, fy); const conc = A.conc[fy]; const fl = (A.flow[fy] || A.flow[2026]).ALL;
  const wall = A.maturity.wall.filter((w) => w.b !== 'MATURED' && w.b !== 'NONE');
  const tapeRows = A.tape.filter((t) => t.date <= AS_OF && t.prec !== 'fy').slice(0, 14);
  const res = reserve || 0;
  // forward strip (Drive program)
  const DR = D.drive; const u = DR.utilization; const done = DR.games.schedule.filter((x) => x.result); const W = done.filter((x) => /^W/.test(x.result!)).length; const nx = DR.calendar.events.find((e) => e[0] > AS_OF);
  const rosterLens = (['2024', '2025', '2026'] as const).map((s) => D.rosters[s].length);
  return <>
    <div className="ph"><h1>What is the state of the portfolio right now?</h1><span className="q">As of {AS_OF} · {SEASON_FY[fy]} · {fy === 2026 ? 'FY26-27 current 26-27 book · VERIFIED to control block' : 'institutional ledger'}</span></div>
    <div className="grid g6">
      <Kpi label={'Roster Capital · ' + SEASON_FY[fy]} value={<Money v={com} items={trHold(M, M.holdings(fy), fy).concat(trEps(M.buyouts.filter((b) => (fy === 2025 ? b.season === 2025 : !!b.capsBy['FY26-27'])), SEASON_FY[fy]))} label={'Roster capital ' + SEASON_FY[fy]} />}
        delta={chgTxt(M.committed[prevFy], com)} prior={`prior ${fmtM(M.committed[prevFy])}`} spark={[M.committed[2024], M.committed[2025], M.committed[2026]]} />
      <Kpi label="Cap Utilization" value={pctf(com / cap)} prior={`${fmtM(com)} / ${fmtM(cap)}`} delta={fy === 2026 ? sgn(com / cap - M.committed[2025] / M.caps[2025]).replace('%', ' pts') : null} spark={[M.committed[2025] / M.caps[2025], M.committed[2026] / M.caps[2026]]} />
      <Kpi label="Dry Powder" value={<span className={dry < res ? 'down' : ''}>{fmtM(dry)}</span>} prior={fy === 2026 ? `FY25-26 closed at ${fmtM(M.caps[2025] - M.committed[2025])}` : ''} delta={`${pctf(dry / cap)} of cap`} />
      <Kpi label="Active Assets" value={r26} prior={`${D.rosters[String(fy - 1) as '2025'].length} on ${fy - 1} roster`} delta={chgTxt(D.rosters[String(fy - 1) as '2025'].length, r26)} spark={rosterLens.slice(0, fy === 2026 ? 3 : 2)} />
      <Kpi label="Paid Assets (core)" value={paid} prior={`${paidAll} with any capital · prior ${paidPrev}`} delta={chgTxt(paidPrev, paid)} />
      <Kpi label="CUBSMI" value={<a href="#/cubsmi">{idx(ix[fy].v)}</a>} delta={chgTxt(ix[fy - 1].v, ix[fy].v)} prior={`prior ${idx(ix[fy - 1].v)} · 2024 = 100`} spark={[ix[2024].v, ix[2025].v, ix[2026].v]} />
    </div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title={'Roster Capital Allocation · ' + SEASON_FY[fy]} oda="OBSERVE" right={<span className="muted">capital · share · YoY</span>} foot="CU relabelled most CB/S as DB on the 2026 roster, so the DB / CB / S YoY moves reflect the relabel. The SEC composite is the like-for-like view.">
        <HBars rows={alloc.map((r) => ({ label: r.g, value: r.v, go: '#/pos/' + r.T.t, tip: `${r.T.name}: ${fmt0(r.v)} · ${pctf(r.share)} of capital · YoY ${sgn(r.yoy)}`, sub: <>{pctf(r.share, 1)} · <span className={r.yoy >= 0 ? 'up' : 'down'}>{sgn(r.yoy, 0)}</span></> }))} />
      </Panel>
      <Panel title={'Capital Stack · ' + SEASON_FY[fy]} oda="ASSESS"><CapStackBlock M={M} fy={fy} reserve={reserve} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Position Market Board" oda="OBSERVE" right={<a href="#/positions" className="muted">full board ›</a>}><BoardTable M={M} rows={boardRows(M)} maxh={420} /></Panel></div>
    <div className="grid g4" style={{ marginTop: 8 }}>
      <Panel title="Capital Concentration" right={<a href="#/concentration" className="muted">›</a>}>
        <div className="kv3">{([['Top 1', conc.top1, 1], ['Top 5', conc.top5, 5], ['Top 10', conc.top10, 10]] as const).map(([l, v, n]) => <div key={l} className="stat"><small>{l}</small><b><Money v={v} items={trHold(M, conc.hs.slice(0, n), fy)} label={l + ' players'} fmt={(x) => pctf(x)} /></b></div>)}</div>
        <div style={{ marginTop: 6 }}><HBars rows={conc.hs.slice(0, 5).map((h) => ({ label: M.players.get(h.pid)!.ticker.split('.')[0], value: h.capital, tip: `${h.pid} · ${h.bs} · ${fmt0(h.capital)}`, go: '#/player/' + encodeURIComponent(h.pid) }))} /></div>
      </Panel>
      <Panel title="Contract Maturity · remaining obligation" right={<a href="#/maturity" className="muted">wall ›</a>} foot="Final scheduled payment month, from Oct-26 · count = contracts">
        <HBars rows={wall.map((w) => ({ label: w.b.replace(' · DEC', ''), value: w.remaining, sub: `${w.rows.length}`, go: '#/maturity', tip: `${w.b}: ${w.rows.length} contracts · ${fmt0(w.remaining)} remaining scheduled` }))} />
      </Panel>
      <Panel title="Capital Churn · FY25-26 → FY26-27" right={<a href="#/pos/CUSEC/CHURN" className="muted">›</a>} foot="Base: FY25-26 core capital of in-season 2025 players">
        <div className="kv3"><div className="stat"><small>Capital churn</small><b>{pctf(fl.capitalChurn)}</b></div><div className="stat"><small>Player churn</small><b>{pctf(fl.playerChurn)}</b></div><div className="stat"><small>Acq. share</small><b>{pctf(fl.acqChurn)}</b></div></div>
        <CapStack segs={[{ k: 'Exited roster', v: fl.depCap, color: '#ff5a5a' }, { k: 'Returned', v: fl.prevCap - fl.depCap, color: '#3987e5' }]} total={fl.prevCap} />
      </Panel>
      <Panel title="Capital Persistence" right={<a href="#/survival" className="muted">›</a>}>
        <div className="bigidx" style={{ fontSize: 28 }}><Money v={fl.persistence} items={trHold(M, fl.retainedPaid, 2025)} label="FY25-26 capital attached to players paid again in FY26-27" fmt={(v) => pctf(v)} /></div>
        <div className="t2" style={{ margin: '4px 0 6px' }}>of FY25-26 capital is attached to players carrying capital again in FY26-27</div>
        <HBars rows={allocRows(M, 2025).slice(0, 6).map((r) => { const f = A.flow[2026][r.g]; return { label: r.g, value: f.persistence, go: '#/pos/' + r.T.t, tip: `${r.g}: ${pctf(f.persistence)} persistence` }; })} fmt={(v) => pctf(v, 0)} max={1} />
      </Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Transaction Tape · latest" right={<a href="#/tape" className="muted">full blotter ›</a>}><TapeTable M={M} rows={tapeRows} maxh={360} /></Panel></div>
    <div className="grid g6" style={{ marginTop: 8 }}>
      <Kpi label="Season record" value={`${W}–${done.length - W}`} prior={`last: ${(done.slice(-1)[0] || {}).mark || ''}`} />
      <Kpi label="Sept game capital rate" value={fmt$(bookMonths(M)['2026-09'] / gamesPerMonth(DR)['2026-09'])} prior={`book ÷ ${gamesPerMonth(DR)['2026-09']} games`} />
      <Kpi label="December decision set" value={fmtM(DR.maturity.total[2])} prior={`${DR.maturity.shares.nRenew} renewal-eligible · ${pctf(DR.maturity.shares.renew)} of fall`} />
      <Kpi label="FY27-28 spoken for" value={pctf((u.executed + u.proposed) / u.alloc)} prior={`signed + proposed class · plan ${fmtM(u.alloc)}`} />
      <Kpi label="Room to 70–72% target" value={fmtM(u.allowHigh)} prior={`low ${fmtM(u.allowLow)}`} />
      <Kpi label="Next board item" value={nx ? `T-${daysTo(nx[0])}d` : '—'} prior={nx ? nx[1] : ''} />
    </div>
  </>;
}

export function Portfolio() {
  const M = useModel(); const fy = useStore((s) => s.fy); const rows = allocRows(M, fy), tot = sum(rows.map((r) => r.v));
  const acqK = ['RETAINED', 'PORTAL', 'JUCO', 'HS', 'UNKNOWN'], cols = ['#3987e5', '#d95926', '#c98500', '#199e70', '#6b717c'];
  const T0 = M.settings.threshold;
  return <>
    <div className="ph"><h1>Portfolio Overview</h1><span className="q">What do I own · what am I paying · {SEASON_FY[fy]}</span></div>
    <div className="grid g2">
      <Panel title="Capital by position (treemap)" oda="OBSERVE"><Treemap h={300} items={rows.map((r) => ({ label: r.g, v: r.v, go: '#/room/' + r.g, color: '#3987e5', tip: `${r.T.name}: ${fmt0(r.v)} · ${pctf(r.share)} · ${r.hs.filter((h) => h.capital > 0).length} paid` }))} /></Panel>
      <Panel title="Acquisition mix by position" oda="ASSESS" foot="Channel from official rosters: prior-season presence → RETAINED; listed previous school → PORTAL/JUCO; else HS.">
        <Stacked keys={acqK} colors={cols} rows={rows.map((r) => ({ label: r.g, go: '#/room/' + r.g, v: Object.fromEntries(acqK.map((k) => [k, sum(r.hs.filter((h) => acqBucket(h.acq) === k).map((h) => h.capital))])) }))} />
      </Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Position rooms" right={<span className="muted num">Total {fmtM(tot)}</span>}>
      <Table rows={rows} opts={{ go: (r) => '#/room/' + r.g }} cols={[
        { l: 'Room', f: (r) => <TLink g={r.g} />, v: (r) => r.g }, { l: 'Capital', n: true, v: (r) => r.v, f: (r) => <Money v={r.v} items={trHold(M, r.hs, fy)} label={r.g + ' room'} /> }, { l: 'Share', n: true, v: (r) => r.share, f: (r) => pctf(r.share) },
        { l: 'YoY', n: true, v: (r) => r.yoy || 0, f: (r) => (isFinite(r.yoy) ? <span className={r.yoy >= 0 ? 'up' : 'down'}>{sgn(r.yoy)}</span> : '—') },
        { l: 'Paid', n: true, v: (r) => r.hs.filter((h) => h.capital >= T0).length, f: (r) => r.hs.filter((h) => h.capital >= T0).length },
        { l: 'Median', n: true, v: (r) => median(r.hs.filter((h) => h.capital >= T0).map((h) => h.capital)) || 0, f: (r) => fmtM(median(r.hs.filter((h) => h.capital >= T0).map((h) => h.capital))) },
        { l: 'Top asset', f: (r) => { const t = [...r.hs].sort((a, b) => b.capital - a.capital)[0]; return t ? <><PLink pid={t.pid} /> <span className="muted num">{fmtM(t.capital)}</span></> : ''; } },
        { l: 'Top-1 share', n: true, v: (r) => M.A.conc[fy].byPos[r.g].top1 || 0, f: (r) => pctf(M.A.conc[fy].byPos[r.g].top1) },
        { l: 'Retained cap.', n: true, v: (r) => sum(r.hs.filter((h) => h.acq === 'RETAINED').map((h) => h.capital)), f: (r) => fmtM(sum(r.hs.filter((h) => h.acq === 'RETAINED').map((h) => h.capital))) },
        { l: 'Acquired cap.', n: true, v: (r) => sum(r.hs.filter((h) => h.acq !== 'RETAINED').map((h) => h.capital)), f: (r) => fmtM(sum(r.hs.filter((h) => h.acq !== 'RETAINED').map((h) => h.capital))) }]} />
    </Panel></div>
  </>;
}

export function Brief() {
  const M = useModel(); const A = M.A, cap = M.caps[2026], com = M.committed[2026], dry = cap - com;
  const b = boardRows(M).filter((r) => isFinite(r.yoy) && r.n >= M.settings.lowN).sort((a, c) => c.yoy - a.yoy);
  const mat = A.maturity.rows.filter((r) => r.final! > AS_OF_M && r.final! <= '2026-12');
  const f = A.flow[2026].ALL, c = A.conc[2026]; const recent = A.tape.filter((t) => t.prec === 'day' && t.date <= AS_OF).slice(0, 8); const km = A.life.km();
  const mv = (r: (typeof b)[number]) => <li key={r.g}><TLink g={r.g} /> median {fmtM(r.m.median)} — {sgn(r.yoy)} YoY (N={r.n}).</li>;
  return <>
    <div className="ph"><h1>Daily Capital Brief</h1><span className="q">{AS_OF} · generated from the loaded ledger — every line links to its evidence</span></div>
    <div className="grid g2">
      <Panel title="What do I have · what have I committed" oda="OBSERVE"><ul>
        <li>FY26-27 cap {fmt$(cap)}; committed <Money v={com} items={trHold(M, M.holdings(2026), 2026)} label="FY26-27 committed" fmt={fmt$} /> ({pctf(com / cap)} utilization); dry powder <b className="num">{fmt$(dry)}</b> <span className="muted">(book control: {fmt$(M.data.reference.current2627Book.available)} remaining)</span>.</li>
        <li>FY27-28 already carries {fmtM(M.fy2728)} of contractual obligations against an estimated cap of {fmtM(M.caps[2027])}.</li>
        <li>Top-5 athletes hold {pctf(c.top5)} of FY26-27 capital; top-10 hold {pctf(c.top10)}.</li></ul></Panel>
      <Panel title="Where is the market moving" oda="OBSERVE"><ul>
        <li>CUBSMI price index {idx(A.cubsmi.price[2026].v)} (<Chg a={A.cubsmi.price[2025].v} b={A.cubsmi.price[2026].v} /> vs FY25-26); capital index {idx(A.cubsmi.capital[2026].v)}.</li>
        {b.slice(0, 3).map(mv)}{b.slice(-2).reverse().map(mv)}</ul></Panel>
      <Panel title="What is maturing · what is leaving" oda="ASSESS"><ul>
        <li>{mat.length} agreements make their final scheduled payment by Dec-26, carrying {fmtM(sum(mat.map((r) => r.remaining)))} of remaining obligation — the spring renewal / replacement decision set.</li>
        <li>Between 2025 and 2026, {pctf(f.capitalChurn)} of core FY25-26 capital left with departing players ({f.departed.length} of {f.prev.length} paid players). {pctf(f.persistence)} of that capital stayed attached to players paid again.</li>
        <li>Acquisition 12-month roster survival is {pctf(km.s12)} (N={km.n12}); capital half-life {km.half}.</li></ul></Panel>
      <Panel title="Alerts requiring a decision" oda="DECIDE"><ul>{A.alerts.slice(0, 8).map((a, i) => <li key={i}><a href={a.go}><b className="mono">{a.code}</b></a> — {a.txt}</li>)}</ul></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Latest dated capital events"><TapeTable M={M} rows={recent} /></Panel></div>
  </>;
}

export function Monitor() {
  const M = useModel();
  return <>
    <div className="ph"><h1>Market Monitor</h1><span className="q">Internal CU markets — 2024 → 2026</span></div>
    <div className="grid g12"><Panel title="CUBSMI" right={<a href="#/cubsmi" className="muted">›</a>}><CubsmiChart M={M} /></Panel><Panel title="Heat" right={<a href="#/heat" className="muted">›</a>}><HeatTiles M={M} /></Panel></div>
    <div style={{ marginTop: 8 }}><Panel title="Position Market Board"><BoardTable M={M} rows={boardRows(M)} /></Panel></div>
  </>;
}

export function Alerts() {
  const M = useModel(); const a = M.settings.assume;
  return <>
    <div className="ph"><h1>Alerts</h1><span className="q">Computed from the dataset. Management thresholds are set in <a href="#/assumptions" className="warn">Assumptions</a>.</span></div>
    <Panel title="Active alerts"><Table rows={M.A.alerts} opts={{ go: (r) => r.go }} cols={[
      { l: 'Level', v: (r) => r.lvl, f: (r) => <span className={`tag ${r.lvl === 'crit' ? 'NEEDS' : r.lvl === 'warn' ? 'ESTIMATED' : r.lvl === 'dq' ? 'FORECAST' : 'RECONCILED'}`}>{r.lvl.toUpperCase()}</span> },
      { l: 'Alert', v: (r) => r.code, f: (r) => <span className="mono">{r.code}</span> }, { l: 'Detail', k: 'txt', cls: 'wrap' }]} /></Panel>
    <Note cls="info" style={{ marginTop: 8 }}>Rules: position median change beyond ±{a.yoyAlert}% YoY · athlete above his position's pooled P90 (exception pricing) · contracts maturing within {a.maturityDays} days · top-5 concentration &gt; {a.top5 ?? '(not set)'}% · dry powder &lt; reserve {a.reserve != null ? fmtM(a.reserve) : '(not set)'} · room share &gt; {a.roomShare ?? '(not set)'}%.</Note>
  </>;
}
