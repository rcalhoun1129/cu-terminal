/* 09 RESEARCH */
import { SEASONS, TICKERS } from '../engine/constants';
import { acqBucket } from '../engine/model';
import { useModel } from '../state/store';
import { CAT, Line, Spark, Survival } from '../ui/charts';
import { NavSel, Panel, PLink, Table, TLink } from '../ui/components';
import { fmtM, idx, median, pctf, sgn } from '../ui/fmt';
import { chF, kmBy } from './shared';
import { Tape } from './players';

export const Htx = () => <Tape args={['ALL', 'ALL']} title="Historical Transactions" />;

export function Studies() {
  const M = useModel();
  return <>
    <div className="ph"><h1>Position Studies</h1><span className="q">Each study opens the full position terminal</span></div>
    <div className="tiles">{TICKERS.map((T) => { const m = M.A.market[T.g]; return <div key={T.t} className="tile" data-go={`#/pos/${T.t}`}><div className="tt"><span className="warn">{T.t}</span><span className="muted">{T.g}</span></div>
      <div className="t2" style={{ fontSize: 11, margin: '4px 0' }}>{T.name}</div><div className="rw"><span>N {SEASONS.map((s) => m[s].n).join('/')}</span><span>med {fmtM(m[2026].median)}</span></div><Spark vals={SEASONS.map((s) => m[s].median)} /></div>; })}</div>
  </>;
}

export function Methodology() {
  const M = useModel(); const S = M.settings;
  return <>
    <div className="ph"><h1>Market Index Methodology</h1><span className="q">Version 1.0 · {M.data.meta.built} · methodology changes are logged in the Audit Log</span></div>
    <div className="grid g2">
      <Panel title="Units & regimes"><ul>
        <li><b>Holding</b> = one athlete × one season. 2024 = collective scheduled payments Jun-24→May-25 (5430 Foundation schedule); 2025 = FY25-26 institutional CAPS; 2026 = FY26-27 CAPS from the current FB 26-27 Rev Share book (the Spring-26 forecast tab is kept only as history).</li>
        <li><b>Contract episode</b> = each agreement / amendment row. Amendment rows carry only their own paid months, so summing episodes never double-counts.</li>
        <li><b>Never mixed</b>: third-party / Paradigma money is a separate ledger; total packages never replace CAPS; Spring-25 transition payments are shown as their own episodes and excluded from market statistics.</li>
        <li><b>Position</b> = the official CU roster position for that season → Buy-Side group (OT/OG/C→OL, DT/DL→DL, DE→EDGE, ILB→LB, CB, S, DB kept separate; SEC composite = CB+S+DB). Spring-26 early enrollees are priced with their 2026 roster position and belong to the 2026 cohort.</li></ul></Panel>
      <Panel title="Market statistics"><ul>
        <li><b>Core purchase market</b>: capital ≥ {fmtM(S.threshold)} (configurable) and on that season's official roster. Nominal $100 / $990 / $1,980 / $2,990 base payments stay in history and in totals but not in price statistics.</li>
        <li>Percentiles are linear-interpolated (Excel PERCENTILE.INC). N is always displayed; N &lt; {S.lowN} = LOW SAMPLE; N &lt; {S.minN} = N/A.</li>
        <li><b>Bands</b>: Development &lt; P25 · Depth P25–P40 · Rotation P40–P60 · Starter P60–P75 · Premium P75–P90 · Exception &gt; P90 (basis selectable).</li>
        <li><b>12-month equivalent</b> = capital ÷ compensated months in the FY × 12.</li></ul></Panel>
      <Panel title="Index formulas"><ul>
        <li><b>Position index</b>ₛ = 100 × median(core obs, season s) ÷ median(core obs, 2024). N/A when either N &lt; {S.minN}.</li>
        <li><b>CUBSMI price</b>ₛ = 100 × Σ wₚ · (medianₚ,ₛ ÷ medianₚ,₂₀₂₄) ÷ Σ wₚ, with wₚ = position share of 2024 core capital; positions enter only with N ≥ {S.lowN} in both years (outlier / small-sample control). Universe: QB RB WR TE OL DL EDGE LB SEC.</li>
        <li><b>Capital index</b> = total core capital ÷ 2024 total. <b>Term index</b> = median compensated months. <b>Replacement / retention index</b> = median capital of new / retained players.</li>
        <li>Contribution (points) = 100 · wₚ/Σw · (relativeₚ − 1).</li></ul></Panel>
      <Panel title="Lifecycle & flows"><ul>
        <li><b>Survival</b>: Kaplan–Meier at season grain. S(12) pooled over the 2024 and 2025 acquisition cohorts; S(24) = S(12) × conditional survival of the 2024 cohort. 6/18/36-month points are not observable.</li>
        <li><b>Half-life</b> = first horizon with survival &lt; 50%. Capital variant: still carrying core capital.</li>
        <li><b>Player churn</b> = departed ÷ prior paid population; <b>capital churn</b> = departed capital ÷ prior capital; <b>persistence</b> = prior capital of players paid again ÷ prior capital; <b>acquisition churn</b> = new-player capital ÷ current capital.</li>
        <li><b>Heat</b> = mean of observable component scores (≥3 of 7), each linearly scaled 0–100 (scales in the Heat table).</li></ul></Panel>
    </div>
  </>;
}

export function IComps({ args }: { args: string[] }) {
  const M = useModel(); const list = M.holdings(2026).filter((h) => h.capital >= M.settings.threshold).sort((a, b) => a.pid.localeCompare(b.pid));
  const pid = args[0] || list[0]?.pid; const h = pid ? M.h[2026].get(pid) || M.h[2025].get(pid) || M.h[2024].get(pid) : undefined;
  if (!h) return <div className="note">No holdings.</div>;
  const comps = SEASONS.flatMap((s) => M.obs(s, h.bs).map((x) => ({ ...x.h, s, v: x.v }))).filter((x) => x.pid !== pid).map((x) => ({ ...x, dist: Math.abs(Math.log(x.v / h.capital)) })).sort((a, b) => a.dist - b.dist).slice(0, 15);
  return <>
    <div className="ph"><h1>Internal Comparables</h1><span className="q"><NavSel prefix="#/icomps/" opts={list.map((x) => [x.pid, `${x.pid} · ${x.bs}`])} value={pid} /></span></div>
    <div className="note info">Nearest CU transactions at {h.bs} by capital (log distance), all seasons. Subject: {pid} · {fmtM(h.capital)} · {M.bandOf(h.bs, h.capital)}</div>
    <Panel title="Comparable transactions"><Table rows={comps} cols={[{ l: 'Season', k: 's' }, { l: 'Player', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Pos', k: 'pos' }, { l: 'Channel', f: (r) => acqBucket(r.acq) },
      { l: 'Capital', n: true, v: (r) => r.v, f: (r) => fmtM(r.v) }, { l: 'vs subject', n: true, v: (r) => r.v / h.capital, f: (r) => sgn(r.v / h.capital - 1) }, { l: 'Comp. months', n: true, k: 'months' },
      { l: 'Still on roster 2026', f: (r) => (M.players.get(r.pid)!.seasons['2026'].onRoster ? 'yes' : 'no') }]} /></Panel>
  </>;
}

export function Yoy() {
  const M = useModel(); const S = M.settings; const A = M.A;
  const rows = TICKERS.map((T) => { const m = A.market[T.g]; return { T, m24: m[2024].median, m25: m[2025].median, m26: m[2026].median, idx: A.index[T.g][2026].v, n: SEASONS.map((s) => m[s].n) }; });
  const ser = (f: (g: string, s: number) => number | null, fmt: (v: number) => string) => <Line x={['2024', '2025', '2026']} yFmt={fmt} h={200}
    series={TICKERS.filter((T) => ['QB', 'WR', 'OL', 'DL', 'EDGE', 'LB', 'SEC', 'RB'].includes(T.g)).map((T, i) => ({ name: T.g, color: CAT[i % 8], pts: SEASONS.map((s) => ({ y: f(T.g, s) })) }))} />;
  const dec = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'SEC'].map((g) => {
    const a = A.market[g][2025], b = A.market[g][2026], f = A.flow[2026][g]; const d = b.total - a.total; const price = (b.median - a.median) * a.n || 0, pop = (b.n - a.n) * b.median || 0;
    const term = (median(b.obs.map((x) => x.h.months)) - median(a.obs.map((x) => x.h.months))) * median(b.obs.map((x) => x.h.perMonth)) * b.n || 0; const turn = f.acqCap - f.depCap;
    return { g, d, price, pop, term, turn, res: d - price - pop };
  });
  const m1 = (v: number) => fmtM(v, 1);
  return <>
    <div className="ph"><h1>Year-over-Year Market Dashboard</h1><span className="q">Did the position get more expensive, or did CU simply buy more players?</span></div>
    <Panel title="Median by season"><Table rows={rows} opts={{ go: (r) => '#/pos/' + r.T.t }} cols={[{ l: 'Position', f: (r) => <span className="mono warn">{r.T.t}</span> },
      { l: '2024 median', n: true, v: (r) => r.m24 || 0, f: (r) => fmtM(r.m24) }, { l: '2025 median', n: true, v: (r) => r.m25 || 0, f: (r) => fmtM(r.m25) }, { l: '2026 median', n: true, v: (r) => r.m26 || 0, f: (r) => fmtM(r.m26) },
      { l: '2Y change', n: true, v: (r) => r.m26 / r.m24 || 0, f: (r) => (isFinite(r.m26 / r.m24) ? <span className={r.m26 >= r.m24 ? 'up' : 'down'}>{sgn(r.m26 / r.m24 - 1)}</span> : '—') },
      { l: 'Index', n: true, v: (r) => r.idx || 0, f: (r) => idx(r.idx) }, { l: 'N 24/25/26', f: (r) => r.n.join(' / ') }]} /></Panel>
    <div className="grid g3" style={{ marginTop: 8 }}>
      <Panel title="Price growth (median)">{ser((g, s) => (A.market[g][s].n >= S.minN ? A.market[g][s].median : null), m1)}</Panel>
      <Panel title="Total capital growth">{ser((g, s) => A.market[g][s].roomCapital, m1)}</Panel>
      <Panel title="Roster population (paid core)">{ser((g, s) => A.market[g][s].paid, (v) => v.toFixed(0))}</Panel>
      <Panel title="Capital / player">{ser((g, s) => (A.market[g][s].paid ? A.market[g][s].total / A.market[g][s].n : null), m1)}</Panel>
      <Panel title="Capital / month (median)">{ser((g, s) => median(A.market[g][s].obs.map((x) => x.h.perMonth)), m1)}</Panel>
      <Panel title="Tenure (median comp. months)">{ser((g, s) => median(A.market[g][s].obs.map((x) => x.h.months)), (v) => v.toFixed(0))}</Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="YoY decomposition 2025 → 2026"><Table rows={dec} opts={{ note: 'Core-market totals. Price and population sum with the residual to Δ; term and turnover are shown as separate lenses on the same change.' }} cols={[
      { l: 'Pos', f: (r) => <TLink g={r.g} /> }, { l: 'Δ room capital', n: true, v: (r) => r.d, f: (r) => fmtM(r.d) }, { l: 'Price effect', n: true, v: (r) => r.price, f: (r) => fmtM(r.price), t: '(median₂₆ − median₂₅) × paid₂₅' },
      { l: 'Population effect', n: true, v: (r) => r.pop, f: (r) => fmtM(r.pop), t: '(paid₂₆ − paid₂₅) × median₂₆' }, { l: 'Term effect', n: true, v: (r) => r.term, f: (r) => fmtM(r.term), t: 'Change in median comp. months × median monthly rate × paid₂₆' },
      { l: 'Turnover effect', n: true, v: (r) => r.turn, f: (r) => fmtM(r.turn), t: 'New-player capital − departed capital' }, { l: 'Mix / residual', n: true, v: (r) => r.res, f: (r) => fmtM(r.res) }]} /></Panel></div>
  </>;
}

export function CohortRes() {
  const M = useModel();
  const groups: [string, (pid: string) => boolean][] = [['All acquisitions', () => true], ...[2024, 2025].map((s) => [s + ' cohort', (pid: string) => M.A.life.cohorts[s].includes(pid)] as [string, (pid: string) => boolean]), ...['PORTAL', 'HS', 'JUCO'].map((c) => [c, chF(M, c)] as [string, (pid: string) => boolean])];
  const rows = groups.map(([name, f]) => ({ name, a: M.A.life.km(f), b: M.A.life.km(f, true) }));
  return <>
    <div className="ph"><h1>Cohort Research</h1><span className="q">Roster vs capital survival by cohort and channel</span></div>
    <div className="grid g2"><Panel title="Roster survival"><Survival series={kmBy(M, groups)} /></Panel><Panel title="Capital survival (still ≥ core threshold)"><Survival series={kmBy(M, groups, true)} /></Panel></div>
    <div style={{ marginTop: 8 }}><Panel title="Table"><Table rows={rows} cols={[{ l: 'Cohort', k: 'name' }, { l: 'Roster S12', n: true, f: (r) => pctf(r.a.s12) }, { l: 'Roster S24', n: true, f: (r) => pctf(r.a.s24) },
      { l: 'Capital S12', n: true, f: (r) => pctf(r.b.s12) }, { l: 'Capital S24', n: true, f: (r) => pctf(r.b.s24) }, { l: 'N', n: true, f: (r) => r.a.n12 }]} /></Panel></div>
  </>;
}
