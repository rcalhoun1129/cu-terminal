/* 02 MARKETS */
import { Fragment } from 'react';
import { INDEX_UNIVERSE, POSMAP, REGIME, SEASONS, SEASON_LABEL, TICKERS } from '../engine/constants';
import { acqBucket, inGroup, stats } from '../engine/model';
import { useModel, useStore } from '../state/store';
import { BoxPlot, CAT, Dots, HBars, Hist, Line, Scatter, SEAS_COLOR, Survival, Treemap } from '../ui/charts';
import { Chg, chgTxt, HeatTag, Kpi, LowTag, Money, NavSel, Panel, PLink, Sel, Seg, Table } from '../ui/components';
import { fmt0, fmtM, idx, median, pctf, sgn, sum } from '../ui/fmt';
import { bandLabel, BoardTable, boardRows, CubsmiChart, filtered, FilterBar, FlowCap, HeatTiles, Ladder, posF, QuoteBlock, RoomTable, seasonalIndex, SeasonStatsTable, trHold } from './shared';

const bandOpts: [string, string][] = [['pooled', 'All seasons'], ['inst', 'Institutional'], ['2026', '2026'], ['2025', '2025'], ['2024', '2024']];

export function Cubsmi() {
  const M = useModel(); const I = M.A.cubsmi, cur = I.price[2026].v, prev = I.price[2025].v; const vals = SEASONS.map((s) => I.price[s].v as number);
  const contrib = Object.entries(I.price[2026].contrib).map(([g, c]) => ({ g, ...c })).sort((a, b) => b.points - a.points);
  const rep = seasonalIndex(M, 'acq'), ret = seasonalIndex(M, 'ret');
  return <>
    <div className="ph"><h1>CUBSMI · CU Buy-Side Market Index</h1><span className="tick">CUBSMI</span><span className="q">Fixed-base (2024 = 100) position-weighted median-price index · regime {REGIME[2026]}</span></div>
    <div className="grid g4">
      <section className="pn"><div className="bd"><div className="muted" style={{ fontSize: 10, letterSpacing: '.1em' }}>CUBSMI · PRICE</div><div className="bigidx">{idx(cur)}</div><div className="bigchg"><Chg a={prev} b={cur} /> YoY</div>
        <dl className="kv" style={{ marginTop: 8 }}><dt>2024 baseline</dt><dd>100.0</dd><dt>2025</dt><dd>{idx(prev)}</dd><dt>2026 (current)</dt><dd>{idx(cur)}</dd><dt>Absolute change</dt><dd>{(cur! - prev! >= 0 ? '+' : '') + (cur! - prev!).toFixed(1)} pts</dd>
          <dt>Rolling 2Y</dt><dd>{sgn(cur! / 100 - 1)}</dd><dt>Historical high</dt><dd>{Math.max(...vals).toFixed(1)}</dd><dt>Historical low</dt><dd>{Math.min(...vals).toFixed(1)}</dd><dt>Regime</dt><dd>{REGIME[2026]}</dd></dl></div></section>
      <section className="pn span3"><h3><span>Index history</span><span className="r"><span className="seg">{['1M', '3M', '6M', 'YTD', '1Y', 'ALL'].map((k) => <button key={k} className={k === 'ALL' ? 'on' : ''} data-tip={k === 'ALL' ? 'All observations' : 'Unavailable — the finest real granularity is one observation per season; no interpolated points are drawn'} disabled={k !== 'ALL'} style={k === 'ALL' ? undefined : { opacity: 0.4 }}>{k}</button>)}</span></span></h3>
        <div className="bd"><CubsmiChart M={M} /></div><div className="foot">Solid: price &amp; capital. Dashed: term (median compensated months), replacement (median new-acquisition capital), retention (median retained-player capital). All 2024 = 100.</div></section>
    </div>
    <div className="grid g2" style={{ marginTop: 8 }}>
      <Panel title="Index components · 2026 contribution (index points)" oda="ASSESS" foot={`Positions need N ≥ ${M.settings.lowN} in 2024 and the comparison year. Excluded (low sample): ${INDEX_UNIVERSE.filter((g) => !(g in I.weights)).join(', ') || 'none'}.`}>
        <HBars fmt={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)} rows={contrib.map((c) => ({ label: c.g, value: c.points, color: c.points >= 0 ? 'var(--up)' : 'var(--down)', go: '#/pos/' + (TICKERS.find((t) => t.g === c.g) || { t: '' }).t,
          tip: `${c.g}: weight ${pctf(I.weights[c.g])} · price relative ${c.rel.toFixed(2)}× → ${c.points >= 0 ? '+' : ''}${c.points.toFixed(1)} pts`, sub: 'w ' + pctf(I.weights[c.g], 0) }))} />
      </Panel>
      <Panel title="Index breakdown" oda="OBSERVE"><Table opts={{ csv: false }} rows={[
        { k: 'PRICE', a: I.price[2025].v, b: I.price[2026].v, d: 'Comparable-player prices (median per position, 2024 capital weights)' },
        { k: 'CAPITAL', a: I.capital[2025].v, b: I.capital[2026].v, d: 'Total core capital deployed on in-season roster players' },
        { k: 'TERM', a: I.term[2025].v, b: I.term[2026].v, d: 'Median compensated months purchased' },
        { k: 'REPLACEMENT', a: rep[2025], b: rep[2026], d: 'Median capital of newly acquired players (portal / HS / JUCO)' },
        { k: 'RETENTION', a: ret[2025], b: ret[2026], d: 'Median capital of retained players' }]}
        cols={[{ l: 'Index', k: 'k' }, { l: '2024', n: true, f: () => '100.0' }, { l: '2025', n: true, f: (r) => idx(r.a) }, { l: '2026', n: true, f: (r) => idx(r.b) }, { l: 'YoY', n: true, f: (r) => <Chg a={r.a} b={r.b} /> }, { l: 'Measures', k: 'd', cls: 'wrap' }]} /></Panel>
    </div>
    <div style={{ marginTop: 8 }}><Panel title="Constituent position indexes"><BoardTable M={M} rows={boardRows(M)} /></Panel></div>
  </>;
}

export function Positions() {
  const M = useModel();
  return <>
    <div className="ph"><h1>Position Markets</h1><span className="q">Every position as a security · click a ticker for its market terminal</span></div>
    <Panel title="Position Market Board" oda="OBSERVE"><BoardTable M={M} rows={boardRows(M)} maxh={900} /></Panel>
    <div style={{ marginTop: 8 }}><Panel title="Index history by position" foot="Positions without a valid 2024 base (TE, DB, specialists) cannot be indexed and are omitted.">
      <Line x={['2024', '2025', '2026']} base={100} h={260} w={720} series={TICKERS.filter((T) => M.A.index[T.g][2025].v || M.A.index[T.g][2026].v).map((T, i) => ({ name: T.t, color: CAT[i % 8],
        pts: SEASONS.map((s) => ({ y: M.A.index[T.g][s].v, go: '#/pos/' + T.t, tip: `${T.t} ${s}: ${idx(M.A.index[T.g][s].v)} · N=${M.A.index[T.g][s].n}` })) }))} /></Panel></div>
  </>;
}


export function Pos({ args }: { args: string[] }) {
  const M = useModel(); const metric = useStore((s) => s.metric); const band = useStore((s) => s.band);
  const [tk = 'CUOL', tab = 'PRICE'] = args;
  const T = TICKERS.find((t) => t.t === tk) || TICKERS[4]; const g = T.g, A = M.A, m = A.market[g], ix = A.index[g]; const S = M.settings;
  const tabs = ['PRICE', 'CAPITAL', 'TENURE', 'CHURN', 'ACQUISITION', 'RETENTION', 'REPLACEMENT'];
  const b = M.bands(g); const q = M.quote(g); const cur = m[2026]; const share = cur.roomCapital / sum(M.holdings(2026).map((h) => h.capital));
  let body: React.ReactNode = null;
  if (tab === 'PRICE') {
    body = <>
      <div className="grid g32">
        <Panel title={'Price history · ' + (metric === 'fy' ? 'FY capital' : metric === '12m' ? '12-month equivalent' : 'capital / month')} n={SEASONS.map((s) => m[s].n).join('/')} right={<Seg path="metric" opts={[['fy', 'FY CAPS'], ['12m', '12M EQ'], ['month', 'CAP/MO']]} value={metric} />}>
          <Line x={['2024', '2025', '2026']} yFmt={(v) => fmtM(v, 1)} h={230} series={([['Median', 'p50', '#e8e9eb'], ['P25', 'p25', '#6b717c'], ['P75', 'p75', '#3987e5'], ['P90', 'p90', '#d95926'], ['Max', 'max', '#4b5059']] as const).map(([n, k, c]) => ({ name: n, color: c, dash: k === 'max',
            pts: SEASONS.map((s) => ({ y: m[s].n ? m[s][k] : null, tip: `${T.t} ${s} ${n}: ${fmtM(m[s][k])} · N=${m[s].n}` })) }))} />
        </Panel>
        <Panel title={'Buy-Side price ladder · ' + bandLabel(band)} n={b.n} low={b.n < S.lowN} right={<Sel path="band" opts={bandOpts} value={band} />}><Ladder M={M} g={g} b={b} /></Panel>
      </div>
      <div className="grid g32" style={{ marginTop: 8 }}>
        <Panel title="Distribution · every transaction against the ladder" oda="OBSERVE"><Dots h={300} bands={b} minN={S.minN} cols={SEASONS.map((s) => ({ label: String(s), color: SEAS_COLOR[s], pts: m[s].obs.map((x) => ({ v: x.v, go: '#/player/' + encodeURIComponent(x.h.pid), tip: `${x.h.pid}\n${s} · ${x.h.pos} · ${acqBucket(x.h.acq)}\n${fmt0(x.v)} · ${x.h.months} comp. months · term ${x.h.term ?? '—'}` })) }))} /></Panel>
        <Panel title="Internal quote · BID / TARGET / AUTH / WALK" oda="DECIDE"><QuoteBlock M={M} g={g} q={q} /></Panel>
      </div>
      <div style={{ marginTop: 8 }}><Panel title="Market statistics by season"><SeasonStatsTable M={M} g={g} /></Panel></div>
    </>;
  } else if (tab === 'CAPITAL') {
    const room = cur.room.filter((h) => h.capital > 0).sort((a, b) => b.capital - a.capital);
    body = <>
      <div className="grid g2"><Panel title="Room capital by season"><HBars rows={SEASONS.map((s) => ({ label: String(s), value: m[s].roomCapital, sub: `${m[s].paidAll} paid`, tip: `${s}: ${fmt0(m[s].roomCapital)}` }))} /></Panel>
        <Panel title="Room portfolio · FY26-27 treemap"><Treemap items={room.map((h) => ({ label: M.players.get(h.pid)!.ticker.split('.')[0], v: h.capital, go: '#/player/' + encodeURIComponent(h.pid), tip: `${h.pid}: ${fmt0(h.capital)} · ${acqBucket(h.acq)}` }))} /></Panel></div>
      <div style={{ marginTop: 8 }}><Panel title="Room holdings · FY26-27"><RoomTable M={M} room={room} /></Panel></div></>;
  } else if (tab === 'TENURE') {
    const km = A.life.km(posF(M, g)), kmc = A.life.km(posF(M, g), true);
    const onr = M.data.rosters['2026'].filter((r) => inGroup({ bs: POSMAP[r.pos] }, g)).map((r) => M.players.get(r.name)).filter(Boolean);
    body = <div className="grid g2">
      <Panel title="Roster survival (season grain)" foot={`12-mo: N at risk ${km.n12} · 24-mo: ${km.n24}. 6/18/36-month points need join/leave dates and cannot be observed.`}><Survival series={[{ name: 'Roster', ...km }, { name: 'Paid capital', ...kmc, color: '#d95926' }]} /></Panel>
      <Panel title="Tenure metrics"><dl className="kv"><dt>12-month roster survival</dt><dd>{pctf(km.s12)}</dd><dt>24-month roster survival</dt><dd>{pctf(km.s24)}</dd><dt>Roster half-life</dt><dd>{km.half}</dd><dt>Capital half-life</dt><dd>{kmc.half}</dd>
        <dt>Median seasons at CU (2026 room)</dt><dd>{median(onr.map((p) => A.life.presence.get(p!.id)!.length)) || '—'}</dd><dt>Median compensated months (2026 core)</dt><dd>{median(cur.obs.map((x) => x.h.months)) || '—'}</dd>
        <dt>Median contract term (2026)</dt><dd>{median(cur.room.map((h) => +(h.term as number)).filter((x) => x > 0)) || '—'}</dd></dl></Panel></div>;
  } else if (tab === 'CHURN') {
    body = <div className="grid g2">{[2025, 2026].map((s) => { const f = A.flow[s][g]; return <Panel key={s} title={`${s - 1} → ${s}`} n={f.prev.length}>
      <div className="kv3"><div className="stat"><small>Player churn</small><b>{pctf(f.playerChurn)}</b></div><div className="stat"><small>Capital churn</small><b><Money v={f.capitalChurn} items={trHold(M, f.departed, s - 1)} label={'Departed capital ' + (s - 1)} fmt={(v) => pctf(v)} /></b></div>
        <div className="stat"><small>Persistence</small><b><Money v={f.persistence} items={trHold(M, f.retainedPaid, s - 1)} label="Persisting capital" fmt={(v) => pctf(v)} /></b></div></div>
      <div style={{ marginTop: 6 }}><FlowCap f={f} /></div>
      <Table rows={[...f.departed].sort((a, b) => b.capital - a.capital)} opts={{ maxh: 220 }} cols={[{ l: 'Departed', f: (r) => <PLink pid={r.pid} />, v: (r) => r.pid }, { l: 'Capital ' + (s - 1), n: true, v: (r) => r.capital, f: (r) => fmtM(r.capital) }]} />
    </Panel>; })}</div>;
  } else if (tab === 'ACQUISITION' || tab === 'RETENTION') {
    const rows = [2024, 2025, 2026].map((s) => { const o = m[s].obs; const by = (k: string) => o.filter((x) => acqBucket(x.h.acq) === k).map((x) => x.v); return { s, portal: by('PORTAL'), hs: by('HS'), juco: by('JUCO'), ret: by('RETAINED') }; });
    body = <div className="grid g2">
      <Panel title="Median by acquisition channel"><Table opts={{ csv: false }} rows={rows} cols={[{ l: 'Season', k: 's' }, ...(([['Portal', 'portal'], ['HS', 'hs'], ['JUCO', 'juco'], ['Retained', 'ret']] as const).map(([l, k]) => ({ l, n: true, v: (r: (typeof rows)[number]) => median(r[k]) || 0, f: (r: (typeof rows)[number]) => <>{fmtM(median(r[k]))} <span className="muted">N={r[k].length}</span></> })))]} /></Panel>
      <Panel title={tab === 'RETENTION' ? 'Retention premium (paid both years)' : 'Acquisition premium'}>
        {tab === 'RETENTION' ? <Table rows={[...A.flow[2025][g].premList, ...A.flow[2026][g].premList]} opts={{ maxh: 300 }} cols={[{ l: 'Player', f: (r) => <PLink pid={r.pid} /> }, { l: 'Prior', n: true, v: (r) => r.prev, f: (r) => fmtM(r.prev) }, { l: 'Renewal', n: true, v: (r) => r.cur, f: (r) => fmtM(r.cur) }, { l: 'Change', n: true, v: (r) => r.chg, f: (r) => <span className={r.chg >= 0 ? 'up' : 'down'}>{sgn(r.chg)}</span> }]} />
          : <dl className="kv">{[2025, 2026].map((s) => { const f = A.flow[s][g]; return <Fragment key={s}><dt>{s} new-acquisition median</dt><dd>{fmtM(f.medAcq)}</dd><dt>{s} retained median</dt><dd>{fmtM(f.medRetained)}</dd><dt>{s} acquisition premium</dt><dd className={f.acqPremium >= 0 ? 'up' : 'down'}>{isFinite(f.acqPremium) ? (f.acqPremium >= 0 ? '+' : '') + fmtM(f.acqPremium) : '—'}</dd></Fragment>; })}</dl>}
      </Panel></div>;
  } else if (tab === 'REPLACEMENT') {
    body = <div className="grid g2">{[2025, 2026].map((s) => { const f = A.flow[s][g]; return <Panel key={s} title={`Replacement market ${s - 1} → ${s}`} foot="Position-level: departures are not linked one-to-one to specific replacements in the source files.">
      <dl className="kv"><dt>Departed capital</dt><dd>{fmtM(f.depCap)}</dd><dt>New-acquisition capital</dt><dd>{fmtM(f.acqCap)}</dd><dt>Replacement ratio (acq ÷ departed)</dt><dd>{isFinite(f.replRatio) ? f.replRatio.toFixed(2) + '×' : '—'}</dd><dt>Median exit capital</dt><dd>{fmtM(f.medDeparted)}</dd><dt>Median replacement capital</dt><dd>{fmtM(f.medAcq)}</dd>
        <dt>Replacement premium</dt><dd className={f.replPremium >= 0 ? 'up' : 'down'}>{isFinite(f.replPremium) ? (f.replPremium >= 0 ? '+' : '') + fmtM(f.replPremium) + ' (' + sgn(f.replPremiumPct) + ')' : '—'}</dd><dt>Time to replacement</dt><dd className="muted">one offseason (season grain)</dd></dl></Panel>; })}</div>;
  }
  return <>
    <div className="ph"><span className="tick" style={{ fontSize: 16 }}>{T.t}</span><h1>Colorado {T.name} internal market</h1>{T.composite && <span className="tag">COMPOSITE — CB, S and DB kept separate in their own tickers</span>}</div>
    <div className="grid g6">
      <Kpi label="Index" value={ix[2026].v == null ? <span className="muted" style={{ fontSize: 13 }}>N/A</span> : ix[2026].v!.toFixed(1)} delta={ix[2025].v && ix[2026].v ? sgn(ix[2026].v / ix[2025].v - 1) : null} prior={ix[2026].v == null ? ix[2026].why : `2025 ${idx(ix[2025].v)}`} spark={SEASONS.map((s) => ix[s].v)} />
      <Kpi label="Room Capital" value={<Money v={cur.roomCapital} items={trHold(M, cur.room, 2026)} label={T.t + ' room FY26-27'} />} delta={chgTxt(m[2025].roomCapital, cur.roomCapital)} prior={'2025 ' + fmtM(m[2025].roomCapital)} spark={SEASONS.map((s) => m[s].roomCapital)} />
      <Kpi label="Players" value={cur.roomCount} prior={`${cur.paid} core-paid · ${cur.paidAll} any capital`} />
      <Kpi label="Median" value={<><Money v={cur.median} items={trHold(M, cur.obs.map((x) => x.h), 2026)} label={T.t + ' 2026 observations'} /><LowTag n={cur.n} minN={S.minN} lowN={S.lowN} /></>} delta={chgTxt(m[2025].median, cur.median)} prior={`N=${cur.n} · 2025 ${fmtM(m[2025].median)}`} spark={SEASONS.map((s) => m[s].median)} />
      <Kpi label="Capital Share" value={pctf(share)} prior="of FY26-27 athlete capital" />
      <Kpi label="Heat" value={<HeatTag h={A.heat[g]} />} prior={`${A.heat[g].n} of 7 components observable`} />
    </div>
    <div className="tabs" style={{ marginTop: 8 }}>{tabs.map((t) => <button key={t} className={t === tab ? 'on' : ''} data-go={`#/pos/${T.t}/${t}`}>{t}</button>)}</div>
    {body}
  </>;
}

export function HeatScreen() {
  const M = useModel(); const keys = Object.keys(M.A.heat.QB.comp);
  return <>
    <div className="ph"><h1>Market Heat Map</h1><span className="q">Score 0–100 = mean of observable component scores (min 3). The factors stay visible.</span></div>
    <Panel title="Positions" oda="OBSERVE"><HeatTiles M={M} /></Panel>
    <div style={{ marginTop: 8 }}><Panel title="Heat components"><Table rows={TICKERS.map((T) => ({ T, h: M.A.heat[T.g] }))} opts={{ go: (r) => '#/pos/' + r.T.t, note: '0–20 LOW · 21–40 MODERATE · 41–60 ACTIVE · 61–80 TIGHT · 81–100 EXTREME' }} cols={[
      { l: 'Ticker', f: (r) => <span className="mono warn">{r.T.t}</span> },
      ...keys.map((k) => ({ l: k, n: true, t: M.A.heat.QB.comp[k].scale, v: (r: { h: typeof M.A.heat.QB }) => r.h.comp[k].score ?? -1,
        f: (r: { h: typeof M.A.heat.QB }) => { const c = r.h.comp[k]; return c.raw != null && isFinite(c.raw) ? <>{sgn(c.raw, 0).replace(/^\+/, k.includes('change') || k.includes('growth') || k.includes('premium') ? '+' : '')} <span className="muted">→{c.score ?? '—'}</span></> : '—'; } })),
      { l: 'Score', n: true, v: (r) => r.h.score ?? -1, f: (r) => <HeatTag h={r.h} /> }]} /></Panel></div>
  </>;
}

export function Curves() {
  const M = useModel(); const F = useStore((s) => s.filters); const s = F.season;
  const rows = TICKERS.map((T) => ({ label: T.t, st: stats(M.obs(s, T.g).map((x) => x.v)), go: '#/pos/' + T.t }));
  const fh = filtered(M, F, s); const all = fh.map((h) => M.metricVal(h)).filter(isFinite);
  const palette = ['QB', 'WR', 'OL', 'DL', 'EDGE', 'LB', 'DB', 'RB'];
  return <>
    <div className="ph"><h1>Price Curves</h1><span className="q">Position price distributions · box = P25–P75, white tick = median, whisker = min–max</span></div><FilterBar />
    <div className="grid g2"><Panel title={`Box plots · ${SEASON_LABEL[s]}`} oda="OBSERVE"><BoxPlot rows={rows} lowN={M.settings.lowN} /></Panel><Panel title="Transaction distribution (filtered)" n={all.length}><Hist vals={all} bins={14} /></Panel></div>
    <div style={{ marginTop: 8 }}><Panel title="Capital vs contract term" foot="Colour by position (QB blue · WR orange · OL aqua · DL yellow · EDGE magenta · LB green · DB violet · RB red · other grey)">
      <Scatter xLabel="contract term (months)" xFmt={(v) => v.toFixed(0)} pts={fh.filter((h) => +(h.term as number) > 0).map((h) => ({ x: +(h.term as number), y: M.metricVal(h), tip: `${h.pid} · ${h.bs} · term ${h.term} · ${fmt0(M.metricVal(h))}`, go: '#/player/' + encodeURIComponent(h.pid), color: CAT[palette.indexOf(h.bs) % 8] || '#6b717c' }))} /></Panel></div>
  </>;
}

export function Historical({ args }: { args: string[] }) {
  const M = useModel(); const fs = useStore((s) => s.filters.season); const s = +(args[0] || fs); const g = args[1];
  const rows = TICKERS.map((T) => ({ T, s, ...M.A.market[T.g][s] })); const focus = g ? TICKERS.find((t) => t.g === g) : null; const S = M.settings;
  return <>
    <div className="ph"><h1>Historical Markets · {SEASON_LABEL[s]}</h1><span className="q"><NavSel prefix="#/historical/" opts={[[2024, '2024'], [2025, '2025'], [2026, '2026']]} value={s} /></span></div>
    {focus && <div className="note info">{focus.t} · {s}: N={M.A.market[g!][s].n} · median {fmtM(M.A.market[g!][s].median)} · P75 {fmtM(M.A.market[g!][s].p75)} · room {fmtM(M.A.market[g!][s].roomCapital)} — <a href={`#/pos/${focus.t}`} className="warn">open terminal ›</a></div>}
    <Panel title="Market by position"><Table rows={rows} opts={{ go: (r) => '#/pos/' + r.T.t }} cols={[
      { l: 'Ticker', f: (r) => <span className="mono warn">{r.T.t}</span> }, { l: 'N', n: true, k: 'n' }, { l: 'Total', n: true, v: (r) => r.total, f: (r) => <Money v={r.total} items={trHold(M, r.obs.map((x) => x.h), s)} label={r.T.t + ' ' + s} /> },
      { l: 'Mean', n: true, v: (r) => r.mean || 0, f: (r) => fmtM(r.mean) }, { l: 'Median', n: true, v: (r) => r.median || 0, f: (r) => <>{fmtM(r.median)}<LowTag n={r.n} minN={S.minN} lowN={S.lowN} /></> },
      { l: 'P25', n: true, v: (r) => r.p25 || 0, f: (r) => fmtM(r.p25) }, { l: 'P75', n: true, v: (r) => r.p75 || 0, f: (r) => fmtM(r.p75) }, { l: 'P90', n: true, v: (r) => r.p90 || 0, f: (r) => fmtM(r.p90) },
      { l: 'Max', n: true, v: (r) => r.max || 0, f: (r) => fmtM(r.max) }, { l: 'Room capital', n: true, v: (r) => r.roomCapital, f: (r) => fmtM(r.roomCapital) }, { l: 'Index', n: true, v: (r) => M.A.index[r.T.g][s].v || 0, f: (r) => idx(M.A.index[r.T.g][s].v) }]} /></Panel>
  </>;
}

export function Movers() {
  const M = useModel(); const b = boardRows(M);
  const price = b.filter((r) => isFinite(r.yoy) && r.n >= M.settings.minN).sort((a, c) => c.yoy - a.yoy);
  const capR = TICKERS.map((T) => { const a = M.A.market[T.g][2025].roomCapital, c = M.A.market[T.g][2026].roomCapital; return { T, a, c, v: a ? c / a - 1 : NaN }; }).filter((r) => isFinite(r.v)).sort((x, y) => y.v - x.v);
  const churn = TICKERS.map((T) => { const a = M.A.flow[2025][T.g].capitalChurn, c = M.A.flow[2026][T.g].capitalChurn; return { T, a, c, v: c - a }; }).filter((r) => isFinite(r.v)).sort((x, y) => y.v - x.v);
  const list = <R extends { T: (typeof TICKERS)[number] }>(rows: R[], f: (r: R) => number, sub: (r: R) => string) =>
    <HBars fmt={(v) => sgn(v, 0)} rows={rows.map((r) => ({ label: r.T.t, value: f(r), color: f(r) >= 0 ? 'var(--up)' : 'var(--down)', go: '#/pos/' + r.T.t, sub: sub(r), tip: r.T.name }))} />;
  return <>
    <div className="ph"><h1>Market Movers</h1><span className="q">2025 → 2026</span></div>
    <div className="grid g2">
      <Panel title="Price risers">{list(price.filter((r) => r.yoy > 0), (r) => r.yoy, (r) => `N=${r.n}`)}</Panel>
      <Panel title="Price decliners">{list(price.filter((r) => r.yoy <= 0).reverse(), (r) => r.yoy, (r) => `N=${r.n}`)}</Panel>
      <Panel title="Capital risers">{list(capR, (r) => r.v, (r) => fmtM(r.c))}</Panel>
      <Panel title="Churn risers (Δ capital churn, pts)"><HBars fmt={(v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(0)} rows={churn.map((r) => ({ label: r.T.t, value: r.v, color: r.v >= 0 ? 'var(--warn)' : 'var(--info)', go: '#/pos/' + r.T.t + '/CHURN', sub: `${pctf(r.a, 0)}→${pctf(r.c, 0)}` }))} /></Panel>
    </div>
  </>;
}

export function Comparables() {
  const M = useModel(); const s = useStore((st) => st.filters.season); const ch = ['PORTAL', 'HS', 'JUCO', 'RETAINED'];
  const rows = TICKERS.filter((T) => !T.composite).map((T) => { const o = M.obs(s, T.g); return { T, by: Object.fromEntries(ch.map((c) => [c, o.filter((x) => acqBucket(x.h.acq) === c).map((x) => x.v)])), all: o.map((x) => x.v) }; });
  const ratio = (r: (typeof rows)[number]) => median(r.by.PORTAL) / median(r.by.RETAINED);
  return <>
    <div className="ph"><h1>Market Comparables</h1><span className="q">Median capital by position × acquisition channel · {SEASON_LABEL[s]}</span></div><FilterBar />
    <Panel title="Channel matrix"><Table rows={rows} opts={{ go: (r) => '#/pos/' + r.T.t + '/ACQUISITION' }} cols={[
      { l: 'Ticker', f: (r) => <span className="mono warn">{r.T.t}</span> },
      ...ch.map((c) => ({ l: c, n: true, v: (r: (typeof rows)[number]) => median(r.by[c]) || 0, f: (r: (typeof rows)[number]) => (r.by[c].length ? <>{fmtM(median(r.by[c]))} <span className="muted">({r.by[c].length})</span></> : '—') })),
      { l: 'All', n: true, v: (r) => median(r.all) || 0, f: (r) => <>{fmtM(median(r.all))} <span className="muted">({r.all.length})</span></> },
      { l: 'Portal ÷ Retained', n: true, v: (r) => ratio(r) || 0, f: (r) => { const v = ratio(r); return isFinite(v) ? v.toFixed(2) + '×' : '—'; } }]} /></Panel>
  </>;
}
