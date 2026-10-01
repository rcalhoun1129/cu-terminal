/* Buy-side program screens built from the capital manager's Drive (reference "DR()" screens).
   Every Drive-derived figure carries its source. Figures the reference hard-coded (athlete names,
   buyout amounts, game counts, gaps) are derived from the dataset here. */
import { AS_OF } from '../engine/constants';
import { stats, type Holding } from '../engine/model';
import { daysTo } from '../engine/tape';
import { useModel } from '../state/store';
import { HBars, MonthBars, Stacked, Waterfall } from '../ui/charts';
import { Kpi, Lbl, Money, Panel, PLink, SrcLink, Table } from '../ui/components';
import { fmt$, fmt0, fmtM, monthLabel, pctf, sgn, sum } from '../ui/fmt';
import { bookEps, bookMonths, buyoutStatus, egBucket, gamesPerMonth, trEps, trHold, trMonth } from './shared';

const Src = SrcLink;
const goP = (id: string) => '#/player/' + encodeURIComponent(id);

/* ---------------------------------------------------------------- Games · game capital · EGR */
export function Games() {
  const M = useModel(); const D = M.data.drive, G = D.games, bm = bookMonths(M); const perMonth = gamesPerMonth(D);
  const done = G.schedule.filter((g) => g.result); const W = done.filter((g) => /^W/.test(g.result!)).length, L = done.length - W;
  const rows = G.schedule.map((g) => { const k = /^\d{4}-/.test(g.date) ? g.date.slice(0, 7) : null; const spend = k ? bm[k] || 0 : null; const n = k ? perMonth[k] : null; return { ...g, k, spend, n, rate: k && n ? spend! / n : null }; });
  const sep = rows.find((r) => r.k === '2026-09'); const E = G.egr; const sepN = perMonth['2026-09'];
  return <>
    <div className="ph"><h1>Game Capital · Economic Governance</h1><span className="q">What does each game cost, and what did the evidence say? · Record {W}–{L} · {done.length}/{G.schedule.filter((g) => g.status !== 'Postseason TBD').length} regular-season games complete</span></div>
    <div className="grid g6">
      <Kpi label="Record" value={`${W}–${L}`} prior={`${done.length} games complete · next ${G.schedule.find((g) => !g.result)?.opp || '—'}`} />
      <Kpi label="Sept roster spend (book)" value={<Money v={bm['2026-09']} items={trMonth(M, '2026-09')} label="Sept-26 book spend" fmt={fmt$} />} prior={`${sepN} games in month`} />
      <Kpi label="Sept game capital rate" value={sep ? <Money v={sep.rate!} items={trMonth(M, '2026-09').map((t) => ({ ...t, amount: t.amount / sep.n! }))} label="Sept game capital rate (book ÷ games)" fmt={fmt$} /> : '—'} prior={`book Sept ÷ ${sepN} games`} />
      <Kpi label={`${E.game} traveling capital`} value={fmt$(E.travelCap)} prior={`${pctf(E.pct, 2)} traveled · ${E.travelers} travelers`} />
      <Kpi label={`${E.game} travel rate`} value={fmt$(E.rate)} prior="EGR: travel capital ÷ 4" />
      <Kpi label="Capital traveled (season)" value={pctf(D.rooms.traveled, 0)} prior="Appendix C–G" />
    </div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Schedule, results and game capital rate" oda="OBSERVE" foot={<>{G.method} Future months use the book's scheduled spend. Postseason = N/A until scheduled. † Result from Appendix C–G / EGR where RCMS still shows PREGAME. Sources: <Src s={G.src} /> · <Src s={G.resultSrc} /> · <Src s={E.src} /></>}>
        <Table rows={rows} opts={{ csv: true }} cols={[{ l: 'G', n: true, k: 'g' }, { l: 'Date', k: 'date' }, { l: 'Opponent', f: (r) => <b>{r.opp}</b>, v: (r) => r.opp }, { l: 'Site', k: 'site' },
          { l: 'Conf', f: (r) => (r.conf === 'Conference' ? 'B12' : r.conf === 'Nonconference' ? 'NC' : '—') },
          { l: 'Result', f: (r) => (r.result ? <><span className={/^W/.test(r.result) ? 'up' : 'down'}>{r.result}</span>{r.resultSrc && <> <span className="muted" data-tip={r.dq || ''}>†</span></>}</> : <span className="muted">—</span>) },
          { l: 'EGR mark', f: (r) => (r.mark ? <span className={`tag ${/WEAK|IMPAIR|UNRESOLVED/.test(r.mark) ? 'NEEDS' : /STRENGTH|POSITIVE/.test(r.mark) ? 'VERIFIED' : 'ESTIMATED'}`} data-tip={r.note || ''}>{r.mark}</span> : '') },
          { l: 'Month spend (book)', n: true, v: (r) => r.spend, f: (r) => (r.spend != null ? <Money v={r.spend} items={trMonth(M, r.k!)} label={monthLabel(r.k!) + ' book spend'} /> : '—') }, { l: 'Games in month', n: true, f: (r) => r.n ?? '—' },
          { l: 'Game capital rate', n: true, v: (r) => r.rate, f: (r) => (r.rate != null ? <span className={r.result ? '' : 'muted'}>{fmt$(r.rate)}</span> : <span className="muted">N/A</span>) }, { l: 'Gamebook', k: 'gamebook' }, { l: 'Participation', k: 'participation' }]} /></Panel>
      <Panel title="EGR marking system" foot={`RCMS Season Timeline Sept spend is ${fmt0(G.rcmsSept - bm['2026-09'])} ${G.rcmsSept >= bm['2026-09'] ? 'above' : 'below'} the book; the EGR travel figures tie to the book. See Data Quality.`}>
        <dl className="kv">{G.marks.map((m, i) => [<dt key={i + 't'}>{i + 1}</dt>, <dd key={i + 'd'} style={{ textAlign: 'left' }}>{m}</dd>])}</dl><hr className="sep" />
        <dl className="kv"><dt>RCMS Sept rate (stale)</dt><dd className="warn">{fmt$(G.rcmsSept / sepN)}</dd><dt>Book Sept rate</dt><dd>{sep ? fmt$(sep.rate!) : '—'}</dd><dt>Difference / game</dt><dd>{fmt$((G.rcmsSept - bm['2026-09']) / sepN)}</dd></dl></Panel>
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title={`${E.game} · traveling capital by position (EGR)`} oda="OBSERVE" foot={<>Game-rate per position as reported. Traveling CAPS total {fmt$(E.total)}. <Src s={E.src} /></>}>
        <HBars fmt={fmt$} rows={E.rows.map((r) => ({ label: r[0], value: r[4], sub: fmtM(r[2]) + ' CAPS', tip: `${r[0]} · traveling CAPS ${fmt$(r[2])} · game rate ${fmt$(r[4])}${r[1] ? ' · ' + r[1] + ' travelers' : ''}` }))} /></Panel>
      <Panel title="Game marks · what changed the thesis" oda="ASSESS" foot={<Src s={G.resultSrc} />}>{done.map((g) => <div key={g.g} className={`note ${/WEAK|UNRESOLVED/.test(g.mark || '') ? '' : 'info'}`}><b>G{g.g} · {g.opp} · {g.result}</b> — {g.mark || ''}<br /><span className="muted">{g.note || ''}</span></div>)}</Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Room dispositions + shares vs references */
export function Dispositions() {
  const M = useModel(); const D = M.data.drive; const hs = M.holdings(2026).filter((h) => h.capital > 0); const tot = sum(hs.map((h) => h.capital)); const n = hs.length;
  const mine: Record<string, { c: number; n: number; hs: Holding[] }> = {}; hs.forEach((h) => { const b = egBucket(h.bs); mine[b] = mine[b] || { c: 0, n: 0, hs: [] }; mine[b].c += h.capital; mine[b].n++; mine[b].hs.push(h); });
  const big: Record<string, number> = {}; D.big12.rows.forEach((r) => { big[r[0]] = r[1]; });
  const rows = D.shares.rows.map(([g, cap, hc]) => ({ g, md: cap, mdh: hc, t: mine[g] ? mine[g].c / tot : 0, th: mine[g] ? mine[g].n / n : 0, c: mine[g] ? mine[g].c : 0, hs: mine[g] ? mine[g].hs : [], b12: big[g] as number | undefined }));
  const lines = ['OL', 'DL', 'EDGE', 'LB']; const lc = sum(lines.map((g) => (mine[g] ? mine[g].c : 0))), ln = sum(lines.map((g) => (mine[g] ? mine[g].n : 0)));
  const nRec = M.episodes.filter((e) => e.kind === 'FCST26').length;
  return <>
    <div className="ph"><h1>Room Dispositions & Allocation vs References</h1><span className="q">Where is the capital, what is each room's posture, and how does that compare with outside references?</span></div>
    <div className="grid g4"><Kpi label="Lines share of capital" value={<Money v={lc / tot} label="" fmt={(v) => pctf(v)} />} prior={`MD ${pctf(D.shares.lines.capital)} · ${D.shares.lines.def}`} />
      <Kpi label="Lines share of paid roster" value={pctf(ln / n)} prior={`MD ${pctf(D.shares.lines.roster)} (all ${nRec} records)`} /><Kpi label="Paid athletes FY26-27" value={n} prior="CAPS > $0" /><Kpi label="Rooms qualifying for performance replacement" value="0" prior="Appendix C–G" /></div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Room dispositions" oda="DECIDE" foot={<>Acquisition reasons: {D.rooms.reasons.join(' · ')}. {D.rooms.reasonNote} <Src s={D.rooms.src} /></>}>
        <Table rows={D.rooms.rows} opts={{ csv: false }} cols={[{ l: 'Room', f: (r) => r[0] }, { l: 'Disposition', f: (r) => <b className="warn">{r[1]}</b> }]} /></Panel>
      <Panel title="Capital share by room — terminal vs Master Deck vs Big 12 reference" oda="ASSESS" foot={<>Capital shares tie to the Master Deck to 0.1 pt. Headcount differs because the terminal counts paid athletes ({n}) and the Master Deck counts all {nRec} records. Big 12 = {D.big12.label}. <Src s={D.shares.src} /></>}>
        <Table rows={rows} cols={[{ l: 'Room', f: (r) => <b>{r.g}</b>, v: (r) => r.g }, { l: 'Terminal (live book)', n: true, v: (r) => r.t, f: (r) => <Money v={r.t} items={trHold(M, r.hs, 2026)} label={r.g + ' FY26-27'} fmt={(v) => pctf(v)} /> },
          { l: 'Master Deck', n: true, v: (r) => r.md, f: (r) => pctf(r.md) }, { l: 'Δ pts', n: true, v: (r) => r.t - r.md, f: (r) => <span className={Math.abs(r.t - r.md) > 0.01 ? 'warn' : 'muted'}>{((r.t - r.md) * 100).toFixed(1)}</span> },
          { l: 'Headcount (term.)', n: true, f: (r) => pctf(r.th) }, { l: 'Headcount (MD)', n: true, f: (r) => pctf(r.mdh) }, { l: 'Big 12 2025 ref.', n: true, f: (r) => (r.b12 != null ? <span className="t2">{pctf(r.b12)}</span> : <span className="muted">—</span>) }]} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="CU vs Big 12 2025 reference (4 rooms reported)" oda="ASSESS" foot="Reference, not a target: Big 12 figure is league-wide NIL distribution by position; CU is institutional revenue-share CAPS.">
      <Stacked rows={rows.filter((r) => r.b12 != null).flatMap((r) => [{ label: r.g + ' · CU', v: { Share: r.t * 100 } as Record<string, number> }, { label: r.g + ' · B12', v: { Reference: r.b12! * 100 } as Record<string, number> }])} keys={['Share', 'Reference']} colors={['#3987e5', '#6b717c']} abs fmt={(v) => v.toFixed(1) + '%'} /></Panel></div>
  </>;
}

/* ---------------------------------------------------------------- Buyouts */
const BO_TAG: Record<string, string> = { OPEN: 'ESTIMATED', PAID: 'VERIFIED', CLOSED: 'VERIFIED', BLOCKED: 'NEEDS', REMOVED: 'RECONCILED' };
export function Buyouts() {
  const M = useModel(); const D = M.data.drive.buyouts; const bk = M.buyouts;
  const open = buyoutStatus(M.data.drive, 'OPEN'), blocked = buyoutStatus(M.data.drive, 'BLOCKED'), removed = buyoutStatus(M.data.drive, 'REMOVED');
  // Installment note (reference hard-coded it): one athlete carried in both fiscal years.
  const byPid = new Map<string, typeof bk>(); bk.forEach((b) => byPid.set(b.pid, [...(byPid.get(b.pid) || []), b]));
  const split = [...byPid].filter(([, a]) => a.length > 1 && new Set(a.map((b) => b.season)).size > 1);
  return <>
    <div className="ph"><h1>Buyout Ledger</h1><span className="q">Money owed to and from other schools and counterparties — kept outside athlete CAPS</span></div>
    <div className="grid g4">
      <Kpi label="Buyouts in CU ledgers" value={<Money v={sum(bk.map((b) => b.capital))} items={trEps(bk)} label="Buyouts carried in CU files" fmt={fmt$} />} prior={`${bk.length} entries (FY25-26 AL192 + FY26-27 book)`} />
      <Kpi label="Open exposure (documented)" value={fmt$(open.total)} prior={open.with || 'none'} />
      <Kpi label="Blocked deal" value={fmt$(blocked.total)} prior={blocked.with || 'none'} />
      <Kpi label="Clauses removed" value={String(removed.n)} prior={removed.who || 'none'} />
    </div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Buyout register" oda="OBSERVE" foot={<Src s={D.src} />}><Table rows={D.rows} cols={[{ l: 'Athlete', f: (r) => r[0] }, { l: 'Counterparty', f: (r) => r[1] }, { l: 'Amount', n: true, v: (r) => r[2] || 0, f: (r) => (r[2] != null ? fmt$(r[2]) : '—') },
        { l: 'Detail', f: (r) => r[3], cls: 'wrap' }, { l: 'Status', f: (r) => <span className={`tag ${BO_TAG[r[4]] || 'ESTIMATED'}`}>{r[4]}</span> }]} /></Panel>
      <Panel title="Contract term" foot={split.map(([pid, a]) => `${pid}: the ${a.map((b) => (b.season === 2025 ? 'FY25-26' : 'FY26-27')).join(' and ')} lines are ${a.every((b) => b.capital === a[0].capital) ? `the ${a.length === 2 ? 'two' : a.length} ${fmt0(a[0].capital)} installments` : `${a.length} installments`} of the ${fmt0(sum(a.map((b) => b.capital)))} owed — not a double count.`).join(' ')}>
        <div className="note info">{D.term}</div>
        <dl className="kv">{bk.map((b) => [<dt key={b.id + 't'}>{b.src}</dt>, <dd key={b.id + 'd'}><Money v={b.capital} items={[{ pid: b.pid, eid: b.id, amount: b.capital }]} label={b.id} fmt={fmt$} /></dd>])}</dl></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Incentives */
const EXPOSURE_DEF: Record<string, string> = { Headline: 'Package as announced', Guaranteed: 'Base CAPS in the book', Expected: 'Probability-weighted incentives', Max: 'Every trigger hit', 'Present-Year': 'FY26-27 portion', 'Forward-Year': 'FY27-28+ portion' };
export function Incentives() {
  const M = useModel(); const DRv = M.data.drive; const D = DRv.incentives; const inc = M.episodes.filter((e) => e.kind === 'FCST26' && (e.incentives || 0) > 0);
  return <>
    <div className="ph"><h1>Incentive Exposure</h1><span className="q">Headline vs expected incentive capital (pre-season forecast) and what the book carries</span></div>
    <div className="grid g4"><Kpi label="Incentive packages (headline)" value={fmt$(D.pool)} prior="Max exposure" /><Kpi label="Expected payout" value={`${fmtM(D.expected[0])}–${fmtM(D.expected[1])}`} prior={`${pctf(D.expectedPct[0], 0)}–${pctf(D.expectedPct[1], 0)} of headline`} />
      <Kpi label="Planning floor / ceiling" value={`${fmtM(D.floor)} / ${fmtM(D.ceiling)}`} />
      <Kpi label="F26 incentives in book" value={<Money v={sum(inc.map((e) => e.incentives!))} items={inc.map((e) => ({ pid: e.pid, eid: e.id, amount: e.incentives! }))} label="F26 incentives (book)" fmt={fmt$} />} prior={`${inc.length} records`} /></div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Projected payout by athlete (forecast 2026-01-20)" oda="ASSESS" foot={<>{D.note} <Src s={D.src} /></>}><Table rows={D.rows} cols={[{ l: 'Athlete', f: (r) => (M.players.has(r[0]) ? <PLink pid={r[0]} /> : r[0]) }, { l: 'Package (headline)', n: true, v: (r) => r[1], f: (r) => fmt$(r[1]) }, { l: 'Projected earned', f: (r) => r[2] }]} /></Panel>
      <Panel title="Exposure types (BSM)" foot={<>Definitions paraphrased for the terminal; names from the BSM Reference Grid. <Src s={DRv.grid.src} /></>}>
        <dl className="kv">{DRv.exposureTypes.map((t) => [<dt key={t + 't'}>{t}</dt>, <dd key={t + 'd'} style={{ textAlign: 'left' }}>{EXPOSURE_DEF[t] ?? 'Net of buyout / rights recovery'}</dd>])}</dl></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- December decision set (live from the book) */
export interface DecRow { h: Holding; last: string; cls: 'CONTINUES' | 'EXHAUSTED' | 'RENEW / REPLACE'; fall: number; exhausted: boolean; f28: number; p: NonNullable<ReturnType<ReturnType<typeof useModel>['players']['get']>> }
export function decSet(M: ReturnType<typeof useModel>): DecRow[] {
  const out: DecRow[] = [];
  for (const h of M.holdings(2026)) {
    if (h.capital <= 0) continue; const eps = h.eps.map((id) => M.epById.get(id)!);
    const all = eps.flatMap((e) => Object.keys(e.months || {})).sort(); const last = all[all.length - 1]; if (!last) continue;
    const p = M.players.get(h.pid)!; const er = (p.book || ({} as { eligRem?: string })).eligRem; const exhausted = er === '1'; const spring = all.some((k) => k >= '2027-01' && k <= '2027-06');
    const fall = sum(Object.entries(h.monthMap).filter(([k]) => k <= '2026-12').map(([, v]) => v)); if (fall <= 0) continue;
    const cls = spring ? 'CONTINUES' : exhausted ? 'EXHAUSTED' : 'RENEW / REPLACE';
    out.push({ h, last, cls, fall, exhausted, f28: sum(eps.map((e) => +(e.capsBy['FY27-28'] || 0))), p });
  }
  return out;
}
export function December() {
  const M = useModel(); const D = M.data.drive.maturity; const rs = decSet(M); const f = (c: string) => rs.filter((r) => r.cls === c); const fallTot = sum(rs.map((r) => r.fall));
  const byG: Record<string, { g: string; ren: number; exh: number; cont: number; n: number }> = {};
  rs.forEach((r) => { const g = egBucket(r.h.bs); byG[g] = byG[g] || { g, ren: 0, exh: 0, cont: 0, n: 0 }; byG[g][r.cls === 'RENEW / REPLACE' ? 'ren' : r.cls === 'EXHAUSTED' ? 'exh' : 'cont'] += r.fall; byG[g].n++; });
  const ren = f('RENEW / REPLACE'), exh = f('EXHAUSTED'), con = f('CONTINUES'); const renV = sum(ren.map((r) => r.fall)), exhV = sum(exh.map((r) => r.fall));
  const dN = exh.length - D.shares.nExhausted, dV = exhV - D.total[3];
  return <>
    <div className="ph"><h1>December Decision Set</h1><span className="q">How much fall capital matures in December, and which of it is a real decision? · computed live from the 26-27 book</span></div>
    <div className="grid g6">
      <Kpi label="Fall-26 capital" value={<Money v={fallTot} items={trHold(M, rs.map((r) => r.h), 2026)} label="Jul–Dec 26" />} prior="Jul–Dec 2026 scheduled" />
      <Kpi label="Matures in December" value={pctf((renV + exhV) / fallTot)} prior={`${fmtM(renV + exhV)} · WA ${pctf(D.shares.maturing)}`} />
      <Kpi label="Renew / replace decision" value={<Money v={renV} items={trHold(M, ren.map((r) => r.h), 2026)} label="Renewal-eligible maturing" />} prior={`${ren.length} athletes · WA ${D.shares.nRenew} / ${fmtM(D.total[2])}`} />
      <Kpi label="Eligibility exhausted" value={<Money v={exhV} items={trHold(M, exh.map((r) => r.h), 2026)} label="Exhausted maturing" />} prior={`${exh.length} athletes · WA ${D.shares.nExhausted} / ${fmtM(D.total[3])}`} />
      <Kpi label="Continues into spring" value={fmtM(sum(con.map((r) => r.fall)))} prior={`${con.length} athletes · WA ${D.shares.nSpring}`} />
      <Kpi label="Renewal stress +25%" value={fmtM(D.stress[2][1])} prior={`+15% ${fmtM(D.stress[1][1])}`} />
    </div>
    <div className="note dq" style={{ marginTop: 8 }}>Live rule: fall-paid with no Jan–Jun 27 payment = matures in December; book “eligibility seasons remaining” = 1 = eligibility exhausted after 2026.
      {dN || Math.abs(dV) >= 1 ? ` The live exhausted set is ${Math.abs(dN)} athletes / ${fmt0(Math.abs(dV))} ${dV >= 0 ? 'larger' : 'smaller'} than the Working Analysis — compare with the open eligibility-flag conflicts in its Checks tab. Confirm with compliance to close.` : ' The live exhausted set matches the Working Analysis.'}</div>
    <div className="grid g2">
      <Panel title="Decision set by room (live)" oda="DECIDE"><Stacked rows={Object.values(byG).sort((a, b) => b.ren + b.exh + b.cont - (a.ren + a.exh + a.cont)).map((r) => ({ label: r.g, v: { 'Renew / replace': r.ren, Exhausted: r.exh, Continues: r.cont } }))} keys={['Renew / replace', 'Exhausted', 'Continues']} colors={['#f5a524', '#6b717c', '#3987e5']} abs /></Panel>
      <Panel title="Working Analysis · Position maturity" foot={<Src s={D.src} />}><Table rows={D.rows} cols={[{ l: 'Group', f: (r) => r[0] }, { l: 'HC', n: true, f: (r) => r[1] }, { l: 'Jul–Dec 26', n: true, v: (r) => r[2], f: (r) => fmtM(r[2]) },
        { l: 'Elig. remains', n: true, v: (r) => r[3], f: (r) => fmtM(r[3]) }, { l: 'Exhausted', n: true, v: (r) => r[4], f: (r) => fmtM(r[4]) }, { l: 'Total maturing', n: true, v: (r) => r[5], f: (r) => fmtM(r[5]) }]} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Athletes in the December decision set" oda="DECIDE" foot="Architecture recommendation (Outlook deck): treat December as the valuation point; 18-month freshman term.">
      <Table rows={rs.filter((r) => r.cls !== 'CONTINUES').sort((a, b) => b.fall - a.fall)} opts={{ tall: true, go: (r) => goP(r.h.pid) }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.h.pid} />, v: (r) => r.h.pid }, { l: 'Pos', f: (r) => r.h.bs, v: (r) => r.h.bs },
        { l: 'Class', v: (r) => r.cls, f: (r) => <span className={r.cls === 'RENEW / REPLACE' ? 'warn' : r.cls === 'EXHAUSTED' ? 'muted' : 't2'}>{r.cls}</span> }, { l: 'Final pay', v: (r) => r.last, f: (r) => monthLabel(r.last) },
        { l: 'FY27-28 signed', n: true, v: (r) => r.f28, f: (r) => (r.f28 > 0 ? <span className="warn" data-tip="Already carries a signed FY27-28 amount — decision is structure, not renewal">{fmtM(r.f28)}</span> : '—') },
        { l: 'Fall-26', n: true, v: (r) => r.fall, f: (r) => <Money v={r.fall} items={trHold(M, [r.h], 2026)} label={r.h.pid} /> }, { l: 'FY26-27', n: true, v: (r) => r.h.capital, f: (r) => fmtM(r.h.capital) },
        { l: 'Elig. seasons rem. (book)', f: (r) => r.p.book?.eligRem || '—' }, { l: 'Book status', f: (r) => r.p.book?.status || '—' }, { l: 'Band', f: (r) => M.bandOf(r.h.bs, r.h.capital) }]} /></Panel></div>
  </>;
}

/* ---------------------------------------------------------------- FY27-28 plan */
const isProp = (s: string) => /PROPOSED|variance/i.test(s);
function WTable({ rows }: { rows: [string, number, number][] }) {
  return <Table rows={rows} opts={{ csv: true }} cols={[{ l: 'Line', f: (r) => r[0], cls: 'wrap' }, { l: 'Amount', n: true, v: (r) => r[1], f: (r) => <span style={{ color: isProp(r[0]) ? '#b7a8ff' : 'inherit' }}>{fmt$(r[1])}</span> },
    { l: '% of window', n: true, v: (r) => r[2], f: (r) => <><span className="pbar"><i style={{ width: Math.min(100, r[2] * 100).toFixed(1) + '%', background: isProp(r[0]) ? '#9085e9' : '#3987e5' }} /></span> {pctf(r[2])}</> }]} />;
}
export function Plan2728() {
  const M = useModel(); const D = M.data.drive, u = D.utilization, w = D.windows, a = D.architecture; const cap = M.caps[2026]; const bm = bookMonths(M);
  const inSpring = (k: string) => k >= '2027-01' && k <= '2027-06';
  const spring = sum(Object.entries(bm).filter(([k]) => inSpring(k)).map(([, v]) => v));
  const f27 = sum(Object.entries(bm).filter(([k]) => k >= '2027-07' && k <= '2028-06').map(([, v]) => v));
  const classShare = w.w1[3] && w.w1[2] && w.w1[2][1] ? w.w1[3][1] / w.w1[2][1] : NaN;
  return <>
    <div className="ph"><h1>Forward Plan · Spring-27 window & FY27-28</h1><span className="q">How much of the next cap year is already spoken for, and how much room is left inside the 70–72% target? <Lbl t="PLANNING — NOT APPROVED" /></span></div>
    <div className="grid g6">
      <Kpi label="Spring-27 owed (book)" value={<Money v={spring} items={bookEps(M).filter((e) => Object.keys(e.months || {}).some(inSpring)).map((e) => ({ pid: e.pid, eid: e.id, amount: sum(Object.entries(e.months).filter(([k]) => inSpring(k)).map(([, v]) => v)) }))} label="Jan–Jun 27 book" fmt={fmt$} />} prior={`WA ${fmt$(w.w1[1][1])}`} />
      <Kpi label="FY26-27 remaining" value={fmt$(cap - M.committed[2026])} prior={`book control ${fmt$(M.data.reference.current2627Book.available)}`} />
      <Kpi label="FY27-28 signed (scheduled)" value={<Money v={f27} items={bookEps(M).filter((e) => +(e.capsBy['FY27-28'] || 0) > 0).map((e) => ({ pid: e.pid, eid: e.id, amount: +e.capsBy['FY27-28'] }))} label="FY27-28 book" fmt={fmt$} />} prior={`CAPS column ${fmt$(M.fy2728)}`} />
      <Kpi label="Planning allocation" value={fmtM(u.alloc)} prior={`cap × ${1 + u.growth} — not approved`} />
      <Kpi label="Spoken for (signed + proposed)" value={pctf((u.executed + u.proposed) / u.alloc)} prior={`${fmtM(u.executed + u.proposed)} · excl. $${(u.variance2728 / 1e3).toFixed(1)}K variance`} />
      <Kpi label="Room to 70–72% target" value={`${fmtM(u.allowLow)}–${fmtM(u.allowHigh)}`} prior={`covers ${pctf(u.allowLow / D.maturity.total[2], 0)}–${pctf(u.allowHigh / D.maturity.total[2], 0)} of renewal pool`} />
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Window 1 · Jan–Jun 2027 (rest of FY26-27)" oda="ASSESS" foot={<>Class spring installments = {pctf(classShare)} of verified capacity. <Src s={w.src} /></>}><WTable rows={w.w1} /></Panel>
      <Panel title="Windows 2–3 · FY27-28 cap year" oda="ASSESS" foot={`Denominator = ${fmt0(u.alloc)} planning allocation (projection, not approved). Purple = proposed / unreconciled.`}><WTable rows={w.w23} /></Panel>
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Utilization target" oda="DECIDE" foot={<Src s={u.src} />}><dl className="kv"><dt>Target band</dt><dd>{pctf(u.low)}–{pctf(u.high)}</dd><dt>Uncommitted reserve</dt><dd>{pctf(1 - u.high)}–{pctf(1 - u.low)}</dd>
        <dt>Obligation ceiling</dt><dd>{fmtM(u.ceilLow)}–{fmtM(u.ceilHigh)}</dd><dt>Reserve held</dt><dd>{fmtM(u.reserveLow)}–{fmtM(u.reserveHigh)}</dd><dt>Executed FY27-28</dt><dd>{fmtM(u.executed)}</dd>
        <dt>Proposed freshmen (60%+35%)</dt><dd>{fmtM(u.proposed)}</dd><dt>Cash Jul–Dec 27 (exec. + proposed)</dt><dd>{fmtM(u.cashJulDec27)}</dd><dt>Carried into Jan–Jun 28</dt><dd>{fmtM(u.carryJanJun28)}</dd></dl></Panel>
      <Panel title="Payment architecture standards" foot={<>{a.status}. <Src s={a.src} /></>}>
        <table className="t"><thead><tr><th>Type</th><th className="n">1st spring</th><th className="n">Following fall</th><th className="n">2nd spring</th></tr></thead><tbody>
          <tr><td>Early enrollee</td>{a.ee.map((v, i) => <td key={i} className="n">{pctf(v)}</td>)}</tr><tr><td>Spring transfer</td>{a.transfer.map((v, i) => <td key={i} className="n">{pctf(v)}</td>)}</tr></tbody></table>
        <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 11.5 }} className="t2">{a.recs.map((r, i) => <li key={i}>{r}</li>)}</ul></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Season scenarios" foot={`${D.seasonScen.label}. 2027 schedule: ${D.schedule2027.text}.`}><Table rows={D.seasonScen.rows} opts={{ csv: false }} cols={[{ l: 'Wins', f: (r) => r[0] }, { l: 'Acquisition need', f: (r) => r[1], cls: 'wrap' }, { l: 'Retention pressure', f: (r) => r[2], cls: 'wrap' }, { l: 'Primary reserve claim', f: (r) => r[3], cls: 'wrap' }]} /></Panel></div>
  </>;
}

/* ---------------------------------------------------------------- Budget scenarios + stress */
export function Budget() {
  const M = useModel(); const D = M.data.drive; const b = D.budget, s = D.scenarios, st = D.stress;
  const f = (v: number) => (v <= 1.5 && v >= 0 && !Number.isInteger(v) ? pctf(v) : fmt$(v));
  return <>
    <div className="ph"><h1>FY27-28 Budget Scenarios & Stress Tests</h1><span className="q">What does next year look like at $17.4M, $20M and $25M, and what breaks the 70–72% target? <Lbl t="SCENARIOS — NONE APPROVED" /></span></div>
    <Panel title="Allocation scenarios" oda="DECIDE" foot={<>{b.label}. <Src s={b.src} /></>}><Table rows={b.rows} cols={[{ l: 'Line', f: (r) => r[0] }, ...b.cols.map((c, i) => ({ l: c, n: true, v: (r: (typeof b.rows)[number]) => r[i + 1] as number, f: (r: (typeof b.rows)[number]) => f(r[i + 1] as number) }))]} /></Panel>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Renewal scenarios S0–S3" oda="DECIDE" foot={`${s.label}. Premium cost S2 vs S1 = ${fmt$(s.premium)}.`}><Table rows={s.rows} cols={[{ l: 'Scenario', f: (r) => r[0], cls: 'wrap' }, { l: 'Renewal / replacement', n: true, v: (r) => r[1], f: (r) => fmtM(r[1]) },
        { l: 'Total exposure', n: true, v: (r) => r[2], f: (r) => fmtM(r[2]) }, { l: 'Remaining', n: true, v: (r) => r[3], f: (r) => fmtM(r[3]) }, { l: 'Remaining %', n: true, v: (r) => r[4], f: (r) => <span className={r[4] < 0.05 ? 'down' : ''}>{pctf(r[4])}</span> }]} /></Panel>
      <Panel title="Stress tests (plan at 71% midpoint)" oda="DECIDE" foot={<>Red = above the 72% ceiling. <Src s={st.src} /></>}><Table rows={st.rows} cols={[{ l: 'Condition', f: (r) => r[0], cls: 'wrap' }, { l: 'Added FY27-28', n: true, v: (r) => r[1], f: (r) => fmtM(r[1]) },
        { l: 'Utilization', n: true, v: (r) => r[2], f: (r) => <span className={r[2] > 0.72 ? 'down' : ''}>{pctf(r[2])}</span> }, { l: 'Uncommitted', n: true, f: (r) => pctf(r[3]) }, { l: 'Spring-28 owed', n: true, v: (r) => r[4], f: (r) => fmtM(r[4]) }, { l: 'Pre-committed to 28-29', n: true, v: (r) => r[5], f: (r) => fmtM(r[5]) }]} /></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Pipeline: incoming class + live offer */
export function Pipeline() {
  const M = useModel(); const D = M.data.drive, K = D.klass, F = D.liveOffer;
  const rows = K.rows.map(([l, f, st, sp, ph, ol]) => ({ n: `${f} ${l}`, l, st, sp, ph, ol, var: ol - st, spPct: st ? sp / st : 0, std: st * 0.05 }));
  const varWho = rows.filter((r) => r.var).map((r) => r.l).join(', ');
  const fm = Object.entries(F.months).map(([k, v]) => ({ k, v })); const fm26 = sum(fm.filter((x) => x.k <= '2027-06').map((x) => x.v)), fm27 = sum(fm.filter((x) => x.k >= '2027-07').map((x) => x.v));
  return <>
    <div className="ph"><h1>Pipeline · Proposed Commitments</h1><span className="q">Incoming 2027 class and live offers — tracked separately; nothing here is in committed capital <Lbl t="PROPOSED" /></span></div>
    <div className="grid g6"><Kpi label="Class stated total" value={fmtM(K.stated)} prior={`${K.rows.length} athletes · status blank`} /><Kpi label="Payment outline" value={fmtM(K.outline)} prior={`variance ${fmtM(K.variance)}${varWho ? ` (${varWho})` : ''}`} />
      <Kpi label="Spring-27 installments" value={fmtM(K.spring)} prior={`standard 5% = ${fmtM(K.propJan27)}`} /><Kpi label="“July 2027” placeholder" value={pctf(K.placeholder / K.outline)} prior={fmtM(K.placeholder) + ' unstructured'} />
      <Kpi label="Under 5/60/35 · FY27-28" value={fmtM(K.propJulDec27 + K.propJanJun28)} prior={`Jan–Jun 28 carry ${fmtM(K.propJanJun28)}`} /><Kpi label="Off-standard agreements" value={`${K.above} above · ${K.below} below`} prior="spring share vs 5%" /></div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Incoming class (Spring 2027 forecasting)" oda="DECIDE" foot={<>{K.status}. Not matched to any roster or book record (0 duplicates). <Src s={K.src} /></>}>
        <Table rows={rows} opts={{ tall: true }} cols={[{ l: 'Athlete', f: (r) => <b>{r.n}</b>, v: (r) => r.n }, { l: 'Stated total', n: true, v: (r) => r.st, f: (r) => fmt$(r.st) }, { l: 'Spring-27', n: true, v: (r) => r.sp, f: (r) => fmt$(r.sp) },
          { l: 'Spring %', n: true, v: (r) => r.spPct, f: (r) => <span className={Math.abs(r.spPct - 0.05) > 0.005 ? 'warn' : ''}>{pctf(r.spPct)}</span> }, { l: '5% standard', n: true, v: (r) => r.std, f: (r) => fmt$(r.std) },
          { l: 'Placeholder', n: true, v: (r) => r.ph, f: (r) => fmt$(r.ph) }, { l: 'Outline', n: true, v: (r) => r.ol, f: (r) => fmt$(r.ol) }, { l: 'Variance', n: true, v: (r) => r.var, f: (r) => (r.var ? <span className="down">{fmt$(r.var)}</span> : '—') }, { l: 'Status', f: () => <Lbl t="PROPOSED" /> }]} /></Panel>
      <Panel title={'Live offer · ' + F.name} oda="DECIDE" foot={<Src s={F.src} />}>
        <dl className="kv"><dt>Status</dt><dd><Lbl t={F.status} /></dd><dt>Class</dt><dd>{F.cls}</dd><dt>Institutional revenue share</dt><dd>{fmt$(F.rs)}</dd><dt>→ FY26-27 (Jan–Jun 27)</dt><dd>{fmt$(fm26)} ({pctf(fm26 / F.rs)})</dd>
          <dt>→ FY27-28 (Jul 27–Jun 28)</dt><dd>{fmt$(fm27)} ({pctf(fm27 / F.rs)})</dd><dt>BSP NIL (third-party, up to)</dt><dd>{fmt$(F.bspNil)}</dd><dt>Activation pool (up to)</dt><dd>{fmt$(F.activation)}</dd><dt>Maximum package</dt><dd>{fmt$(F.max)}</dd></dl>
        <MonthBars entries={fm.map((x) => ({ k: x.k, v: x.v, color: '#9085e9' }))} h={150} w={420} /><div className="muted" style={{ fontSize: 10.5 }}>{F.note} Spring share {pctf(fm26 / F.rs)} vs 5% early-enrollee standard.</div></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Forecast vs Book */
export function Fvb() {
  const M = useModel(); const snap = M.episodes.filter((e) => e.kind === 'SNAP26'); const sm = new Map<string, number>(); snap.forEach((e) => { sm.set(e.pid, (sm.get(e.pid) || 0) + e.snap!['FY26-27']); });
  const ids = new Set([...sm.keys(), ...M.h[2026].keys()]);
  const rows = [...ids].map((pid) => { const b = M.playerSeasonCap(pid, 2026) + sum(M.buyouts.filter((x) => x.season === 2026 && x.pid === pid).map((x) => x.capital)); const s = sm.get(pid) || 0; return { pid, s, b, d: b - s }; }).filter((r) => r.s || r.b);
  const S0 = sum(rows.map((r) => r.s)), B0 = sum(rows.map((r) => r.b)); const add = rows.filter((r) => !r.s && r.b), drop = rows.filter((r) => r.s && !r.b), chg = rows.filter((r) => r.s && r.b && Math.abs(r.d) >= 1);
  const sorted = [...rows].sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return <>
    <div className="ph"><h1>Forecast vs Book · FY26-27</h1><span className="q">How far did the Spring-26 forecast move before the season? Historical forecast (snapshot) → current book</span></div>
    <div className="grid g6"><Kpi label="Spring-26 snapshot" value={fmtM(S0)} prior="Sp26 forecasting tab, incl. buyout" /><Kpi label="Current book" value={fmtM(B0)} prior="incl. F26 buyout" /><Kpi label="Net change" value={fmtM(B0 - S0)} delta={sgn(B0 / S0 - 1)} />
      <Kpi label="Added after snapshot" value={add.length} prior={fmtM(sum(add.map((r) => r.b)))} /><Kpi label="Dropped from book" value={drop.length} prior={fmtM(sum(drop.map((r) => r.s)))} /><Kpi label="Re-priced" value={chg.length} prior={'net ' + fmtM(sum(chg.map((r) => r.d)))} /></div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Bridge: snapshot → book" oda="ASSESS"><Waterfall steps={[{ label: 'Snapshot', v: S0, type: 'start' }, { label: 'Dropped', v: -sum(drop.map((r) => r.s)) }, { label: 'Re-priced', v: sum(chg.map((r) => r.d)) }, { label: 'Added', v: sum(add.map((r) => r.b)) }, { label: 'Current book', v: B0, type: 'end' }]} /></Panel>
      <Panel title="Largest moves"><HBars rows={sorted.filter((r) => r.d).slice(0, 14).map((r) => ({ label: r.pid, value: r.d, color: r.d < 0 ? 'var(--down)' : 'var(--up)', go: goP(r.pid), tip: `${r.pid}: snapshot ${fmt$(r.s)} → book ${fmt$(r.b)}` }))} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Player detail"><Table rows={sorted} opts={{ tall: true, go: (r) => goP(r.pid) }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Snapshot FY26-27', n: true, v: (r) => r.s, f: (r) => fmt$(r.s) },
      { l: 'Book FY26-27', n: true, v: (r) => r.b, f: (r) => fmt$(r.b) }, { l: 'Change', n: true, v: (r) => r.d, f: (r) => <span className={r.d < 0 ? 'down' : r.d > 0 ? 'up' : 'muted'}>{fmt$(r.d)}</span> },
      { l: 'Type', f: (r) => (!r.s ? 'ADDED' : !r.b ? 'DROPPED' : Math.abs(r.d) >= 1 ? 'RE-PRICED' : 'UNCHANGED') }]} /></Panel></div>
  </>;
}

/* ---------------------------------------------------------------- BSM Reference Grid vs CU observed */
export function BsmGrid() {
  const M = useModel(); const D = M.data.drive, G = D.grid, cc = D.capacityClass; const S = M.settings;
  const cu = (bsList: string[]) => { const a = M.holdings(2026).filter((h) => bsList.includes(h.bs) && h.capital >= S.threshold).map((h) => h.capital); return { n: a.length, st: stats(a), a }; };
  type GRow = (typeof G.rows)[number];
  const tierOf = (v: number, r: GRow) => { for (let i = 0; i < 4; i++) { const x = r[i + 1] as [number, number] | null; if (x && v >= x[0]) return G.cols[i]; } return 'Below'; };
  const rows = G.rows.map((r) => { const c = cu(G.gridToBs[r[0]]); const cnt: Record<string, number> = {}; c.a.forEach((v) => { const t = tierOf(v, r); cnt[t] = (cnt[t] || 0) + 1; }); return { r, c, cnt }; });
  const rng = (x: [number, number] | null) => (x ? `${fmtM(x[0], 1)}–${fmtM(x[1], 1)}` : '—');
  return <>
    <div className="ph"><h1>BSM Reference Grid · Tiers</h1><span className="q">Where does CU's book sit against the Buy-Side Method's illustrative P4 grid? <Lbl t="ILLUSTRATIVE — NOT CU PRICES" cls="ESTIMATED" /></span></div>
    <div className="grid g4"><Kpi label="Portfolio capacity class" value={cc.class} prior={`${cc.range} · ${cc.basis}`} /><Kpi label="Tier scale" value="A · B · C · D · E · PASS" />
      <Kpi label="CU core holdings (≥ threshold)" value={M.holdings(2026).filter((h) => h.capital >= S.threshold).length} prior="FY26-27 book" /><Kpi label="Grid basis" value="P4 illustrative" prior="Not a target; ranges are reference only" /></div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Illustrative grid vs CU FY26-27 observed" oda="ASSESS" foot={<>{G.label}. OT and G/C both map to CU OL; Edge and DE both map to CU EDGE, so their CU counts repeat. CU counts use the FY26-27 book at the core threshold. <Src s={G.src} /></>}>
        <Table rows={rows} opts={{ csv: false }} cols={[{ l: 'Position', f: (x) => <b>{x.r[0]}</b> }, ...G.cols.map((c, i) => ({ l: c, n: true, f: (x: (typeof rows)[number]) => <>{rng(x.r[i + 1] as [number, number] | null)}<br /><span className="muted">{x.cnt[c] || 0} CU</span></> })),
          { l: 'Below grid', n: true, f: (x) => x.cnt.Below || 0 }, { l: 'CU P50 · N', n: true, f: (x) => (x.c.n ? `${fmtM(x.c.st.p50)} · ${x.c.n}` : 'N/A') }, { l: 'CU P90', n: true, f: (x) => (x.c.n >= S.lowN ? fmtM(x.c.st.p90) : 'N/A') }]} /></Panel>
      <Panel title="Tiers & capacity classes" foot={<Src s={cc.src} />}>
        <dl className="kv">{D.tiers.map((t) => [<dt key={t[0] + 't'}>{t[0]}</dt>, <dd key={t[0] + 'd'} style={{ textAlign: 'left' }}>{t[1]}</dd>])}</dl><hr className="sep" />
        <dl className="kv">{cc.classes.map((c) => [<dt key={c[0] + 't'}>{c[0] === cc.class ? <b className="warn">{c[0]} ◀ CU</b> : c[0]}</dt>, <dd key={c[0] + 'd'}>{c[1]}</dd>])}</dl></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Operating calendar */
const phaseOf = (d: string) => { const m = +d.slice(5, 7); return m >= 8 && m <= 9 ? 'OBSERVE' : m === 10 ? 'OBSERVE → ASSESS' : m >= 11 ? 'ASSESS' : m <= 6 ? 'DECIDE' : 'RESET'; };
const eventRoute = (t: string) => (/maturity/i.test(t) ? '#/maturity' : /eligib/i.test(t) ? '#/eligibility' : /replacement/i.test(t) ? '#/replace' : /retention/i.test(t) ? '#/retrep' : /allocation/i.test(t) ? '#/allocation'
  : /buy box|portal/i.test(t) ? '#/bsmgrid' : /reforecast|reserve/i.test(t) ? '#/plan2728' : /re-underwrite/i.test(t) ? '#/posunderwrite' : /snapshot|portfolio review/i.test(t) ? '#/portfolio' : '#/december');
export function Calendar() {
  const M = useModel(); const D = M.data.drive.calendar; const up = D.events.filter((e) => e[0] > AS_OF), past = D.events.filter((e) => e[0] <= AS_OF);
  return <>
    <div className="ph"><h1>Operating Calendar · Decision Boards</h1><span className="q">What is due next? · As of {AS_OF} · phase {phaseOf(AS_OF)}</span></div>
    <div className="grid g4">{D.phases.map((p) => <Kpi key={p[0]} label={p[0]} value={p[1]} cls={phaseOf(AS_OF).startsWith(p[0]) ? 'warn' : ''} />)}</div>
    <div className="grid g21" style={{ marginTop: 8 }}>
      <Panel title="Upcoming" oda="DECIDE" foot={<Src s={D.src} />}><Table rows={up} opts={{ tall: true }} cols={[{ l: 'Date', f: (r) => r[0] }, { l: 'T-minus', n: true, v: (r) => daysTo(r[0]), f: (r) => <span className={daysTo(r[0]) <= 30 ? 'warn' : ''}>T-{daysTo(r[0])}d</span> },
        { l: 'Event', f: (r) => <b>{r[1]}</b> }, { l: 'Type', f: (r) => <span className={`tag ${r[2] === 'BOARD' ? 'NEEDS' : r[2] === 'EXTERNAL' ? 'RECONCILED' : 'ESTIMATED'}`}>{r[2]}</span> }, { l: 'Terminal view', f: (r) => <a href={eventRoute(r[1])}>open ›</a> }]} /></Panel>
      <Panel title="Standing structure"><dl className="kv"><dt>Reserves</dt><dd style={{ textAlign: 'left' }}>{D.reserves.join(' · ')}</dd>{D.ccir.map((c) => [<dt key={c[0] + 't'}>{c[0]}</dt>, <dd key={c[0] + 'd'} style={{ textAlign: 'left' }}>{c[1]}</dd>])}
        <dt>Readiness</dt><dd style={{ textAlign: 'left' }}>{D.readiness.join(' / ')}</dd></dl><hr className="sep" /><div className="muted" style={{ fontSize: 11 }}>{past.length} calendar items dated on or before {AS_OF}.</div></Panel>
    </div>
  </>;
}

/* ---------------------------------------------------------------- Drive sources */
export function Sources() {
  const M = useModel(); const D = M.data.drive;
  return <>
    <div className="ph"><h1>Drive Source Catalog</h1><span className="q">Which Drive files feed the terminal, and which are catalogued only</span></div>
    <div className="note info">Files were read on {AS_OF}. Uploaded workbooks (book, RSLA, Forecast Master, TP) are listed in Source Reconciliation. Restricted, athlete-level material stays in the local dataset file; contact details, SIDs and agent information are never carried.</div>
    <Panel title="Sources"><Table rows={D.sources} cols={[{ l: 'Key', k: 'key' }, { l: 'Title', f: (r) => <a href={r.url} target="_blank" rel="noopener">{r.title}</a>, v: (r) => r.title }, { l: 'Modified', k: 'modified' }, { l: 'Used for', k: 'use', cls: 'wrap' },
      { l: 'Status', f: (r) => (/catalogued/.test(r.use) ? <span className="muted">catalogued</span> : <span className="up">integrated</span>) }]} /></Panel>
  </>;
}

/* ---------------------------------------------------------------- Tracking registry */
export function Tracking() {
  const M = useModel(); const D = M.data.drive; const c = M.A.conc[2026]; const u = D.utilization; const C0 = M.data.controls; const sepN = gamesPerMonth(D)['2026-09'];
  const nx = D.calendar.events.find((e) => e[0] > AS_OF); const cp = M.A.cubsmi.price[2026];
  const T: [string, string, string, string, string][] = [
    ['HISTORICAL', 'CUBSMI (2024 = 100)', cp && cp.v != null && isFinite(cp.v) ? cp.v.toFixed(1) : 'N/A', 'Fixed-base position index from CU holdings', '#/cubsmi'],
    ['HISTORICAL', 'Year-over-year position medians', 'by position', 'Holdings 2024 → 2026', '#/yoy'],
    ['HISTORICAL', 'Roster survival & capital half-life', 'KM S12', 'Official rosters 2023–26', '#/survival'],
    ['HISTORICAL', 'Forecast vs book drift', fmtM(M.committed[2026] - (C0['Fall 26 contractually committed (forecast tab)'] + C0['Spring 27 contractually committed (forecast tab)'])), 'Spring-26 snapshot → current book', '#/fvb'],
    ['CURRENT', 'FY26-27 committed / utilization', `${fmtM(M.committed[2026])} · ${pctf(M.committed[2026] / M.caps[2026])}`, 'Current 26-27 book', '#/portfolio'],
    ['CURRENT', 'FY26-27 remaining (dry powder)', fmt$(M.caps[2026] - M.committed[2026]), 'Book control block', '#/drypowder'],
    ['CURRENT', 'Top-5 concentration', pctf(c.top5), 'Book', '#/concentration'],
    ['CURRENT', 'Game capital rate (Sept)', fmt$(bookMonths(M)['2026-09'] / sepN), 'Book ÷ RCMS schedule', '#/games'],
    ['CURRENT', 'EGR mark (latest game)', D.games.schedule.filter((g) => g.mark).slice(-1)[0]?.mark ?? '—', 'Appendix C–G', '#/games'],
    ['CURRENT', 'Room dispositions', `${D.rooms.rows.length} rooms`, 'Appendix C–G', '#/dispositions'],
    ['CURRENT', 'Buyout exposure', fmt$(buyoutStatus(D, 'OPEN').total) + ' open', 'Buyout Extraction', '#/buyouts'],
    ['CURRENT', 'Incentive exposure', `${fmtM(D.incentives.expected[0])}–${fmtM(D.incentives.expected[1])} exp.`, 'Incentive forecast', '#/incentives'],
    ['FORWARD', 'December decision set', fmtM(D.maturity.total[2]) + ' renew-eligible', 'Book + WA', '#/december'],
    ['FORWARD', 'Maturity wall 30/60/90D', 'buckets', 'Book schedule', '#/maturity'],
    ['FORWARD', 'Spring-27 window', fmtM(D.windows.w1[0][1]), 'WA Windows', '#/plan2728'],
    ['FORWARD', 'FY27-28 spoken-for', pctf((u.executed + u.proposed) / u.alloc), 'Book + proposed class', '#/plan2728'],
    ['FORWARD', 'Utilization vs 70–72% target', `${fmtM(u.allowLow)}–${fmtM(u.allowHigh)} room`, 'WA Utilization', '#/plan2728'],
    ['FORWARD', 'Budget scenarios $17.4M / $20M / $25M', '3 cases', 'WA Budget_Scenario', '#/budget'],
    ['FORWARD', 'Stress tests A–D', `max ${pctf(Math.max(...D.stress.rows.map((r) => r[2])))}`, 'WA Stress', '#/budget'],
    ['FORWARD', 'Pipeline (proposed)', `${D.klass.rows.length} + 1 offer`, 'Class workbook + live offer draft', '#/pipeline'],
    ['FORWARD', 'Operating calendar / boards', nx ? `next T-${daysTo(nx[0])}d` : '—', 'BSM calendar', '#/calendar'],
  ];
  const tagCls = (h: string) => (h === 'HISTORICAL' ? 'RECONCILED' : h === 'CURRENT' ? 'VERIFIED' : 'FORECAST');
  return <>
    <div className="ph"><h1>Tracking Registry</h1><span className="q">Every measure the capital manager tracks — historical, current and forward — with its live value and where it comes from</span></div>
    <Panel title="Measures"><Table rows={T} opts={{ tall: true, go: (r) => r[4] }} cols={[{ l: 'Horizon', f: (r) => <span className={`tag ${tagCls(r[0])}`}>{r[0]}</span>, v: (r) => r[0] }, { l: 'Measure', f: (r) => <b>{r[1]}</b>, v: (r) => r[1] },
      { l: 'Now', n: true, f: (r) => r[2] ?? '—' }, { l: 'Source', f: (r) => r[3] }, { l: '', f: (r) => <a href={r[4]}>open ›</a> }]} /></Panel>
  </>;
}
