/* 06 LIFECYCLE */
import { POSMAP, TICKERS } from '../engine/constants';
import { useModel } from '../state/store';
import { HBars, Hist, Scatter, Survival } from '../ui/charts';
import { Panel, PLink, Table, TLink } from '../ui/components';
import { by, fmt0, fmtM, mean, median, pctf, sum, uniq } from '../ui/fmt';
import { allPlayerRows, chF, kmBy, posF } from './shared';

const NO = () => <span className="muted">n/o</span>;

export function Tenure() {
  const M = useModel();
  const onr = M.data.rosters['2026'].map((r) => ({ ...r, p: M.players.get(r.name) })).filter((r) => r.p);
  const byG = by(onr, (r) => POSMAP[r.pos] || 'UNK');
  const bars = [...byG].map(([g, a]) => ({ label: g, value: median(a.map((r) => { const pr = M.A.life.presence.get(r.name)!; return pr.length + (r.p!.seasons['2024'].acq === 'RETAINED' && pr[0] === 2024 ? 1 : 0); })), sub: 'N=' + a.length })).sort((a, b) => b.value - a.value);
  return <>
    <div className="ph"><h1>Roster Tenure</h1><span className="q">Program tenure = seasons on the official CU roster (2024–26 observed; 2023 roster used for 2024 entry)</span></div>
    <div className="grid g2">
      <Panel title="Median seasons at CU · 2026 roster" foot="Adds one season for players already on the 2023 roster"><HBars rows={bars} fmt={(v) => v.toFixed(1) + ' szn'} /></Panel>
      <Panel title="Roster survival · all acquisitions" foot="Season-grain Kaplan–Meier: 12-mo from 2024 & 2025 cohorts; 24-mo conditional on the 2024 cohort">
        <Survival series={kmBy(M, [['All acquisitions', () => true], ['Portal', chF(M, 'PORTAL')], ['HS', chF(M, 'HS')]])} /></Panel>
    </div>
  </>;
}

export function Economic() {
  const M = useModel(); const T0 = M.settings.threshold;
  const rows = TICKERS.filter((t) => !t.composite).map((T) => {
    const hs = M.holdings(2025).filter((h) => h.bs === T.g && h.capital >= T0).concat(M.holdings(2026).filter((h) => h.bs === T.g && h.capital >= T0));
    const eco = uniq(hs.map((h) => h.pid)).map((pid) => Object.values(M.pMonths.get(pid) || {}).filter((v) => v > 0).length);
    return { T, n: eco.length, med: median(eco), mean: mean(eco), max: eco.length ? Math.max(...eco) : NaN };
  }).filter((r) => r.n);
  const sorted = [...rows].sort((a, b) => b.med - a.med);
  return <>
    <div className="ph"><h1>Economic Tenure</h1><span className="q">First compensated month → last compensated month (scheduled), institutional-era core players</span></div>
    <div className="grid g2">
      <Panel title="Median compensated months by position"><HBars fmt={(v) => (isFinite(v) ? v.toFixed(0) + ' mo' : '—')} rows={sorted.map((r) => ({ label: r.T.g, value: r.med, sub: 'N=' + r.n, go: '#/pos/' + r.T.t + '/TENURE' }))} /></Panel>
      <Panel title="Capital vs economic tenure"><Scatter xLabel="compensated months" xFmt={(v) => v.toFixed(0)} pts={allPlayerRows(M).filter((r) => r.life >= T0).map((r) => { const n = Object.values(M.pMonths.get(r.p.id) || {}).filter((v) => v > 0).length; return { x: n, y: r.life, tip: `${r.p.id}: ${n} months · ${fmt0(r.life)}`, go: '#/player/' + encodeURIComponent(r.p.id) }; })} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Table"><Table rows={sorted} cols={[{ l: 'Position', f: (r) => <TLink g={r.T.g} /> }, { l: 'N', n: true, k: 'n' }, { l: 'Median', n: true, v: (r) => r.med, f: (r) => (isFinite(r.med) ? r.med.toFixed(0) : '—') },
      { l: 'Mean', n: true, v: (r) => r.mean, f: (r) => (isFinite(r.mean) ? r.mean.toFixed(1) : '—') }, { l: 'Max', n: true, k: 'max' }]} /></Panel></div>
  </>;
}

export function CTenure() {
  const M = useModel(); const T0 = M.settings.threshold;
  const rows = [2025, 2026].flatMap((s) => M.holdings(s).filter((h) => +(h.term as number) > 0 && h.capital >= T0).map((h) => ({ ...h, s })));
  const byG = by(rows, (h) => h.bs);
  return <>
    <div className="ph"><h1>Contract Tenure</h1><span className="q">Term length (months) of institutional agreements · core market</span></div>
    <div className="grid g2">
      <Panel title="Median contract term by position"><HBars fmt={(v) => v.toFixed(0) + ' mo'} rows={[...byG].map(([g, a]) => ({ label: g, value: median(a.map((h) => +(h.term as number))), sub: 'N=' + a.length })).sort((a, b) => b.value - a.value)} /></Panel>
      <Panel title="Term distribution" n={rows.length}><Hist vals={rows.map((h) => +(h.term as number))} bins={10} fmt={(v) => v.toFixed(0) + 'mo'} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Contracts by term"><Table rows={rows} opts={{ maxh: 400 }} cols={[{ l: 'Season', k: 's' }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Group', k: 'bs' },
      { l: 'Term', n: true, v: (r) => +(r.term as number), f: (r) => r.term }, { l: 'Comp. months in FY', n: true, k: 'months' }, { l: 'Capital', n: true, v: (r) => r.capital, f: (r) => fmtM(r.capital) }, { l: '12M equivalent', n: true, v: (r) => r.m12, f: (r) => fmtM(r.m12) }]} /></Panel></div>
  </>;
}

export function SurvivalScreen() {
  const M = useModel(); const gs = ['QB', 'WR', 'OL', 'DL', 'EDGE', 'LB', 'SEC', 'RB'];
  const tbl = kmBy(M, [['All', () => true], ...gs.map((g) => [g, posF(M, g)] as [string, (pid: string) => boolean]), ['Portal', chF(M, 'PORTAL')], ['HS', chF(M, 'HS')], ['JUCO', chF(M, 'JUCO')]]);
  return <>
    <div className="ph"><h1>Roster Survival</h1><span className="q">Kaplan–Meier at season grain (the finest real granularity in the rosters)</span></div>
    <div className="grid g2">
      <Panel title="By position · roster"><Survival series={kmBy(M, gs.slice(0, 4).map((g) => [g, posF(M, g)]))} /></Panel>
      <Panel title="By position · roster (cont.)"><Survival series={kmBy(M, gs.slice(4).map((g) => [g, posF(M, g)]))} /></Panel>
      <Panel title="By channel"><Survival series={kmBy(M, [['Portal', chF(M, 'PORTAL')], ['HS', chF(M, 'HS')], ['JUCO', chF(M, 'JUCO')]])} /></Panel>
      <Panel title="Survival table"><Table rows={tbl} opts={{ note: 'n/o = not observable with season-grain roster data' }} cols={[{ l: 'Cohort', k: 'name' }, { l: 'N (12)', n: true, k: 'n12' }, { l: '6 mo', n: true, f: NO },
        { l: '12 mo', n: true, v: (r) => r.s12, f: (r) => pctf(r.s12) }, { l: '18 mo', n: true, f: NO }, { l: 'N (24)', n: true, k: 'n24' }, { l: '24 mo', n: true, v: (r) => r.s24, f: (r) => pctf(r.s24) }, { l: '36 mo', n: true, f: NO }, { l: 'Half-life', k: 'half' }]} /></Panel>
    </div>
  </>;
}

export function HalfLife() {
  const M = useModel(); const gs = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'SEC'];
  const rows = gs.map((g) => ({ g, r: M.A.life.km(posF(M, g)), c: M.A.life.km(posF(M, g), true) })).sort((a, b) => a.c.s12 - b.c.s12);
  return <>
    <div className="ph"><h1>Capital Half-Life Board</h1><span className="q">Months until 50% of an acquisition cohort is no longer on the roster (roster) / no longer carries core capital (capital)</span></div>
    <Panel title="Leaderboard" oda="ASSESS" foot={'Shortest capital duration at the top. Season grain: "≤ 12 mo" means under 50% survived to the next season.'}>
      <Table rows={rows} opts={{ go: (r) => '#/pos/' + TICKERS.find((t) => t.g === r.g)!.t + '/TENURE' }} cols={[{ l: 'Position', f: (r) => <TLink g={r.g} />, v: (r) => r.g }, { l: 'Roster half-life', f: (r) => r.r.half, v: (r) => r.r.s12 },
        { l: '12-mo roster survival', n: true, v: (r) => r.r.s12, f: (r) => <>{pctf(r.r.s12)} <span className="muted">N={r.r.n12}</span></> }, { l: 'Capital half-life', f: (r) => r.c.half, v: (r) => r.c.s12 },
        { l: '12-mo capital survival', n: true, v: (r) => r.c.s12, f: (r) => <>{pctf(r.c.s12)} <span className="muted">N={r.c.n12}</span></> }, { l: '24-mo capital survival', n: true, v: (r) => r.c.s24 || 0, f: (r) => pctf(r.c.s24) }]} /></Panel>
  </>;
}

export function Cohorts() {
  const M = useModel(); const T0 = M.settings.threshold;
  const rows = [2024, 2025, 2026].map((s) => {
    const co = M.A.life.cohorts[s]; const cap = sum(co.map((pid) => M.playerSeasonCap(pid, s)));
    const next = s < 2026 ? co.filter((pid) => M.players.get(pid)!.seasons[String(s + 1) as '2025'].onRoster).length : null;
    const byc = (c: string) => co.filter((pid) => M.players.get(pid)!.seasons[String(s) as '2024'].acq === c).length;
    return { s, n: co.length, cap, next, portal: byc('PORTAL'), hs: byc('HS'), juco: byc('JUCO'), med: median(co.map((pid) => M.playerSeasonCap(pid, s)).filter((v) => v >= T0)) };
  });
  return <>
    <div className="ph"><h1>Cohort Analysis</h1><span className="q">Acquisition cohorts = players new to the CU roster in a season</span></div>
    <Panel title="Cohorts"><Table rows={rows} cols={[{ l: 'Cohort', k: 's' }, { l: 'Players', n: true, k: 'n' }, { l: 'Portal', n: true, k: 'portal' }, { l: 'HS', n: true, k: 'hs' }, { l: 'JUCO', n: true, k: 'juco' },
      { l: 'Entry-season capital', n: true, v: (r) => r.cap, f: (r) => fmtM(r.cap) }, { l: 'Median core capital', n: true, v: (r) => r.med || 0, f: (r) => fmtM(r.med) },
      { l: 'On next roster', n: true, f: (r) => (r.next == null ? '—' : `${r.next} (${pctf(r.next / r.n)})`) }]} /></Panel>
  </>;
}
