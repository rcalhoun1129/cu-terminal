/* Chart primitives — React ports of the reference SVG/HTML builders (geometry unchanged).
   Every mark can carry data-tip (hover tooltip) and data-go (drill-down route). */
import { Fragment, type ReactNode } from 'react';
import type { Stats } from '../engine/model';
import { fmtM, median, monthLabel, pctf, rank, sum } from './fmt';

export const CAT = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const SEAS_COLOR: Record<number, string> = { 2024: '#8a8f98', 2025: '#3987e5', 2026: '#e8e9eb' };
const at = (tip?: string | null, go?: string | null) => ({ ...(tip ? { 'data-tip': tip } : {}), ...(go ? { 'data-go': go } : {}) });
export function niceMax(v: number) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
export function ticks(max: number, n = 4) { const m = niceMax(max); return Array.from({ length: n + 1 }, (_, i) => (m * i) / n); }
const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
type Fmt = (v: number) => string;

/* ---------------------------------------------------------------- horizontal bars (HTML) */
export interface HBar { label: string; value: number; go?: string; tip?: string; sub?: ReactNode; color?: string }
export function HBars({ rows, fmt = fmtM, max = null, color = 'var(--bar)', right }: { rows: HBar[]; fmt?: Fmt; max?: number | null; color?: string; right?: (r: HBar) => ReactNode }) {
  const mx = max ?? Math.max(1, ...rows.map((r) => Math.abs(r.value) || 0));
  return <div className="hbars">{rows.map((r, i) => (
    <div key={i} className="hb" {...at(r.tip, r.go)}>
      <span className="hb-l">{r.label}</span>
      <span className="hb-t"><i style={{ width: `${Math.max(0.5, (100 * Math.abs(r.value || 0)) / mx).toFixed(2)}%`, background: r.color || color }} /></span>
      <span className="hb-v num">{fmt(r.value)}</span>{r.sub != null && <span className="hb-s num">{r.sub}</span>}{right && <span className="hb-s num">{right(r)}</span>}
    </div>))}</div>;
}

/* ---------------------------------------------------------------- line chart, categorical x */
export interface Series { name: string; color?: string; dash?: boolean | number; pts: { y: number | null | undefined; tip?: string; go?: string }[] }
export function Line({ series, x, h = 180, w = 560, yFmt = (v) => v.toFixed(0), base = null, yMin = null, labels = true }: { series: Series[]; x: string[]; h?: number; w?: number; yFmt?: Fmt; base?: number | null; yMin?: number | null; labels?: boolean }) {
  const padL = 44, padR = 70, padT = 10, padB = 22, W = w - padL - padR, H = h - padT - padB;
  const all = series.flatMap((s) => s.pts.map((p) => p.y)).filter((v): v is number => v != null && isFinite(v));
  if (!all.length) return <Empty>N/A — insufficient history</Empty>;
  const lo = yMin ?? Math.min(0, ...all), hi = niceMax(Math.max(...all) * 1.05);
  const X = (i: number) => padL + (x.length === 1 ? W / 2 : (W * i) / (x.length - 1)), Y = (v: number) => padT + H - (H * (v - lo)) / (hi - lo);
  const lbls: { x: number; y: number; t: string; c: string }[] = [];
  const paths = series.map((s, si) => {
    const col = s.color || CAT[si % 8]; let d = '', started = false;
    s.pts.forEach((p, i) => { if (p.y == null || !isFinite(p.y)) { started = false; return; } d += (started ? 'L' : 'M') + X(i) + ',' + Y(p.y); started = true; });
    const last = [...s.pts].reverse().findIndex((p) => p.y != null && isFinite(p.y));
    if (labels && last >= 0) { const i = s.pts.length - 1 - last; lbls.push({ x: X(i) + 8, y: Y(s.pts[i].y as number) + 3, t: s.name, c: col }); }
    return <Fragment key={si}><path d={d} fill="none" stroke={col} strokeWidth={2} strokeDasharray={s.dash ? '4 3' : undefined} />
      {s.pts.map((p, i) => (p.y == null || !isFinite(p.y) ? null : <Fragment key={i}><circle cx={X(i)} cy={Y(p.y)} r={4} fill={col} stroke="var(--panel)" strokeWidth={2} />
        <circle className="hit" cx={X(i)} cy={Y(p.y)} r={11} {...at(p.tip || `${s.name} · ${x[i]}: ${yFmt(p.y)}`, p.go)} /></Fragment>))}</Fragment>;
  });
  lbls.sort((a, b) => a.y - b.y); for (let k = 1; k < lbls.length; k++) { if (lbls[k].y - lbls[k - 1].y < 11) lbls[k].y = lbls[k - 1].y + 11; }
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
    {ticks(hi, 4).map((t) => (t < lo ? null : <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{yFmt(t)}</text></Fragment>))}
    {x.map((l, i) => <text key={i} className="ax" x={X(i)} y={h - 6} textAnchor="middle">{l}</text>)}
    {base != null && <line className="base" x1={padL} x2={padL + W} y1={Y(base)} y2={Y(base)} />}
    {paths}
    {lbls.map((l, i) => <text key={i} className="lbl" x={l.x} y={l.y} fill={l.c}>{l.t}</text>)}
  </svg>;
}

/* ---------------------------------------------------------------- distribution dots against the price ladder */
export interface DotCol { label: string; color?: string; pts: { v: number; tip?: string; go?: string }[] }
export function Dots({ cols, h = 260, w = 560, bands = null, minN = 3, yFmt = fmtM }: { cols: DotCol[]; h?: number; w?: number; bands?: { n: number; st: Stats } | null; minN?: number; yFmt?: Fmt }) {
  const padL = 52, padR = 90, padT = 10, padB = 24, W = w - padL - padR, H = h - padT - padB;
  const all = cols.flatMap((c) => c.pts.map((p) => p.v)).filter((v) => v > 0);
  if (!all.length) return <Empty>No observations</Empty>;
  const hi = niceMax(Math.max(...all, bands?.st?.p90 || 0) * 1.05);
  const Y = (v: number) => padT + H - H * (v / hi);
  const cw = W / cols.length;
  const zones: [string, number, number][] = bands && bands.n >= minN ? [['EXCEPTION', bands.st.p90, hi], ['PREMIUM', bands.st.p75, bands.st.p90], ['STARTER', bands.st.p60, bands.st.p75], ['ROTATION', bands.st.p40, bands.st.p60], ['DEPTH', bands.st.p25, bands.st.p40], ['DEVELOPMENT', 0, bands.st.p25]] : [];
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
    {zones.map(([k, a, b], i) => { const zh = Y(a) - Y(b); return <Fragment key={k}><rect x={padL} y={Y(b)} width={W} height={Math.max(0, zh)} className={`zone z${i}`} />{zh >= 10 && <text className="zl" x={padL + W + 6} y={(Y(a) + Y(b)) / 2 + 3}>{k}</text>}</Fragment>; })}
    {ticks(hi, 4).map((t) => <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{yFmt(t)}</text></Fragment>)}
    {cols.map((c, ci) => { const cx = padL + cw * (ci + 0.5); const md = median(c.pts.map((p) => p.v));
      return <Fragment key={ci}><text className="ax" x={cx} y={h - 6} textAnchor="middle">{c.label} · N={c.pts.length}</text>
        {isFinite(md) && <line className="med" x1={cx - cw * 0.32} x2={cx + cw * 0.32} y1={Y(md)} y2={Y(md)} {...at('Median ' + c.label + ': ' + yFmt(md))} />}
        {c.pts.map((p, i) => { const j = ((i * 7919) % 97) / 97 - 0.5; const x = cx + j * cw * 0.55;
          return <circle key={i} cx={x.toFixed(1)} cy={Y(p.v).toFixed(1)} r={4.5} fill={c.color || '#3987e5'} fillOpacity={0.85} stroke="var(--panel)" strokeWidth={1.5} {...at(p.tip, p.go)} />; })}</Fragment>; })}
  </svg>;
}

/* ---------------------------------------------------------------- stacked horizontal bars */
export function Stacked({ rows, keys, colors, abs = false, fmt = fmtM }: { rows: { label: string; v: Record<string, number>; go?: string }[]; keys: string[]; colors: string[]; abs?: boolean; fmt?: Fmt }) {
  const mx = abs ? Math.max(1, ...rows.map((r) => sum(keys.map((k) => r.v[k] || 0)))) : null;
  return <>
    <div className="legend">{keys.map((k, i) => <span key={k}><i style={{ background: colors[i] }} />{k}</span>)}</div>
    <div className="stk">{rows.map((r, ri) => { const tot = sum(keys.map((k) => r.v[k] || 0)); const base = abs ? mx! : tot || 1;
      return <div key={ri} className="stk-r"><span className="hb-l">{r.label}</span><span className="stk-t">{keys.map((k, i) => { const v = r.v[k] || 0; if (!v) return null;
        return <i key={k} style={{ width: `${((100 * v) / base).toFixed(2)}%`, background: colors[i] }} {...at(`${r.label} · ${k}: ${fmt(v)} (${pctf(tot ? v / tot : 0)})`, r.go)} />; })}</span><span className="hb-v num">{fmt(tot)}</span></div>; })}</div>
  </>;
}

/* ---------------------------------------------------------------- waterfall */
export interface WStep { label: string; v: number; type?: 'start' | 'end'; tip?: string; go?: string }
export function Waterfall({ steps, h = 230, w = 640, fmt = fmtM }: { steps: WStep[]; h?: number; w?: number; fmt?: Fmt }) {
  const padL = 56, padR = 10, padT = 14, padB = 50, W = w - padL - padR, H = h - padT - padB;
  let run = 0; const bars = steps.map((s) => { let a: number, b: number; if (s.type === 'start' || s.type === 'end') { a = 0; b = s.v; run = s.v; } else { a = run; b = run + s.v; run = b; } return { ...s, a, b }; });
  const hi = niceMax(Math.max(...bars.map((x) => Math.max(x.a, x.b))) * 1.05), lo = Math.min(0, ...bars.map((x) => Math.min(x.a, x.b)));
  const Y = (v: number) => padT + H - (H * (v - lo)) / (hi - lo), bw = W / steps.length;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {ticks(hi, 4).map((t) => <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{fmt(t)}</text></Fragment>)}
    {bars.map((x, i) => { const col = x.type === 'start' || x.type === 'end' ? '#8a8f98' : x.v >= 0 ? 'var(--up)' : 'var(--down)';
      const y = Math.min(Y(x.a), Y(x.b)), hh = Math.max(1, Math.abs(Y(x.a) - Y(x.b)));
      const lines: string[] = []; x.label.split(' ').forEach((wd) => { const L = lines[lines.length - 1]; if (L && (L + ' ' + wd).length <= 11) lines[lines.length - 1] = L + ' ' + wd; else lines.push(wd); });
      return <Fragment key={i}><rect x={padL + bw * i + bw * 0.15} y={y} width={bw * 0.7} height={hh} rx={2} fill={col} {...at(`${x.label}: ${fmt(x.v)}${x.tip ? ' · ' + x.tip : ''}`, x.go)} />
        <text className="ax" x={padL + bw * (i + 0.5)} y={y - 4} textAnchor="middle">{fmt(x.v)}</text>
        {lines.slice(0, 3).map((ln, li) => <text key={li} className="ax" x={padL + bw * (i + 0.5)} y={h - 34 + li * 11} textAnchor="middle">{ln}</text>)}
        {i < bars.length - 1 && <line className="conn" x1={padL + bw * i + bw * 0.85} x2={padL + bw * (i + 1) + bw * 0.15} y1={Y(x.b)} y2={Y(x.b)} />}</Fragment>; })}
  </svg>;
}

/* ---------------------------------------------------------------- squarified treemap */
export interface TItem { label: string; v: number; go?: string; tip?: string; color?: string }
export function Treemap({ items, w = 560, h = 260, fmt = fmtM }: { items: TItem[]; w?: number; h?: number; fmt?: Fmt }) {
  const its = items.filter((i) => i.v > 0).sort((a, b) => b.v - a.v); const tot = sum(its.map((i) => i.v)); if (!tot) return <Empty>No capital</Empty>;
  type Rc = TItem & { a: number; x: number; y: number; w: number; h: number };
  const rects: Rc[] = []; const scale = (w * h) / tot; let x = 0, y = 0, W = w, H = h; let rest = its.map((i) => ({ ...i, a: i.v * scale }));
  const worst = (row: { a: number }[], side: number) => { const s = sum(row.map((r) => r.a)); const mx = Math.max(...row.map((r) => r.a)), mn = Math.min(...row.map((r) => r.a)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  while (rest.length) {
    const side = Math.min(W, H); const row = [rest[0]]; let i = 1;
    while (i < rest.length && worst(row.concat(rest[i]), side) <= worst(row, side)) { row.push(rest[i]); i++; }
    const s = sum(row.map((r) => r.a));
    if (W >= H) { const cw = s / H; let yy = y; row.forEach((r) => { const rh = r.a / cw; rects.push({ ...r, x, y: yy, w: cw, h: rh }); yy += rh; }); x += cw; W -= cw; }
    else { const rh = s / W; let xx = x; row.forEach((r) => { const rw = r.a / rh; rects.push({ ...r, x: xx, y, w: rw, h: rh }); xx += rw; }); y += rh; H -= rh; }
    rest = rest.slice(i);
  }
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>{rects.map((r, i) => (
    <g key={i} {...at(r.tip || `${r.label}: ${fmt(r.v)} (${pctf(r.v / tot)})`, r.go)}>
      <rect x={r.x + 1} y={r.y + 1} width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)} rx={2} fill={r.color || '#3987e5'} fillOpacity={(0.95 - (0.55 * i) / Math.max(1, rects.length)).toFixed(2)} />
      {r.w > 54 && r.h > 26 && <><text className="tm" x={r.x + 6} y={r.y + 15}>{r.label}</text><text className="tm2" x={r.x + 6} y={r.y + 28}>{fmt(r.v)}</text></>}
    </g>))}</svg>;
}

/* ---------------------------------------------------------------- step survival curves (season grain) */
export interface SurvSeries { name: string; s12: number; s24: number; n12: number; n24: number; color?: string }
export function Survival({ series, w = 560, h = 200 }: { series: SurvSeries[]; w?: number; h?: number }) {
  const padL = 40, padR = 110, padT = 10, padB = 24, W = w - padL - padR, H = h - padT - padB, X = (m: number) => padL + (W * m) / 24, Y = (v: number) => padT + H - H * v;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {[0, 0.25, 0.5, 0.75, 1].map((t) => <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{t * 100}%</text></Fragment>)}
    {[0, 12, 24].map((m) => <text key={m} className="ax" x={X(m)} y={h - 6} textAnchor="middle">{m} mo</text>)}
    <line className="base" x1={padL} x2={padL + W} y1={Y(0.5)} y2={Y(0.5)} /><text className="ax" x={padL + W - 2} y={Y(0.5) - 4} textAnchor="end">half-life line</text>
    {series.map((s, i) => { const col = s.color || CAT[i % 8]; const pts = ([[0, 1], [12, s.s12], [24, s.s24]] as [number, number][]).filter((p) => isFinite(p[1]));
      let d = `M${X(0)},${Y(1)}`; for (let k = 1; k < pts.length; k++) d += `H${X(pts[k][0])}V${Y(pts[k][1])}`;
      const lp = pts[pts.length - 1];
      return <Fragment key={i}><path d={d} fill="none" stroke={col} strokeWidth={2} />
        {pts.slice(1).map((p) => <Fragment key={p[0]}><circle cx={X(p[0])} cy={Y(p[1])} r={4} fill={col} /><circle className="hit" cx={X(p[0])} cy={Y(p[1])} r={10} {...at(`${s.name} · ${p[0]} mo survival ${pctf(p[1])} (N at risk ${p[0] === 12 ? s.n12 : s.n24})`)} /></Fragment>)}
        <text className="lbl" x={X(lp[0]) + 8} y={Y(lp[1]) + 3} fill={col}>{s.name}</text></Fragment>; })}
  </svg>;
}

export function Lorenz({ pts, w = 300, h = 220 }: { pts: [number, number][]; w?: number; h?: number }) {
  const p = 30, W = w - p - 10, H = h - p - 10, X = (v: number) => p + W * v, Y = (v: number) => 10 + H - H * v;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    <line className="base" x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} />
    {[0, 0.5, 1].map((t) => <Fragment key={t}><text className="ax" x={p - 4} y={Y(t) + 3} textAnchor="end">{t * 100}%</text><text className="ax" x={X(t)} y={h - 4} textAnchor="middle">{t * 100}%</text></Fragment>)}
    <path d={`M${X(0)},${Y(0)}${pts.map((q) => `L${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('')}`} fill="none" stroke="#3987e5" strokeWidth={2} />
    {[0.5, 0.8, 0.9].map((t) => { const q = pts.find((z) => z[0] >= t); return q ? <Fragment key={t}><circle className="hit" cx={X(q[0])} cy={Y(q[1])} r={9} {...at(`Bottom ${Math.round(t * 100)}% of paid players hold ${pctf(q[1])} of capital`)} /><circle cx={X(q[0])} cy={Y(q[1])} r={3} fill="#3987e5" /></Fragment> : null; })}
  </svg>;
}

export function BoxPlot({ rows, w = 560, rowH = 22, fmt = fmtM, lowN = 5 }: { rows: { label: string; st: Stats; go?: string }[]; w?: number; rowH?: number; fmt?: Fmt; lowN?: number }) {
  const padL = 60, padR = 20, W = w - padL - padR; const hi = niceMax(Math.max(1, ...rows.map((r) => r.st.max || 0)));
  const X = (v: number) => padL + (W * v) / hi; const h = rows.length * rowH + 26;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {ticks(hi, 4).map((t) => <Fragment key={t}><line className="grid" x1={X(t)} x2={X(t)} y1={0} y2={h - 18} /><text className="ax" x={X(t)} y={h - 4} textAnchor="middle">{fmt(t)}</text></Fragment>)}
    {rows.map((r, i) => { const y = i * rowH + rowH / 2 + 2, s = r.st;
      return <Fragment key={i}><text className="ax" x={padL - 6} y={y + 3} textAnchor="end">{r.label}</text>
        {s.n >= 1 && <g {...at(`${r.label} · N=${s.n} · min ${fmt(s.min)} · P25 ${fmt(s.p25)} · median ${fmt(s.median)} · P75 ${fmt(s.p75)} · P90 ${fmt(s.p90)} · max ${fmt(s.max)}`, r.go)}>
          <rect x={X(s.min)} y={y - rowH / 2 + 2} width={Math.max(1, X(s.max) - X(s.min))} height={rowH - 4} fill="transparent" />
          <line x1={X(s.min)} x2={X(s.max)} y1={y} y2={y} stroke="#6b717c" /><rect x={X(s.p25)} y={y - 6} width={Math.max(2, X(s.p75) - X(s.p25))} height={12} rx={2} fill="#3987e5" fillOpacity={0.55} stroke="#3987e5" />
          <line x1={X(s.median)} x2={X(s.median)} y1={y - 7} y2={y + 7} stroke="#fff" strokeWidth={2} />{s.n < lowN && <text className="ax warn" x={X(s.max) + 6} y={y + 3}>LOW N={s.n}</text>}</g>}</Fragment>; })}
  </svg>;
}

export function Hist({ vals, bins = 12, w = 560, h = 170, fmt = fmtM, mark = null }: { vals: number[]; bins?: number; w?: number; h?: number; fmt?: Fmt; mark?: number | null }) {
  if (!vals.length) return <Empty>No observations</Empty>;
  const hi = niceMax(Math.max(...vals, mark || 0)), bw = hi / bins, cnt = Array(bins).fill(0) as number[]; vals.forEach((v) => cnt[Math.min(bins - 1, Math.floor(v / bw))]++);
  const padL = 30, padB = 22, W = w - padL - 10, H = h - padB - 8, mx = Math.max(...cnt);
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {cnt.map((c, i) => { const x = padL + (W * i) / bins, hh = (H * c) / mx; return <rect key={i} x={x + 1} y={8 + H - hh} width={W / bins - 2} height={hh} rx={2} fill="#3987e5" {...at(`${fmt(i * bw)}–${fmt((i + 1) * bw)}: ${c} players`)} />; })}
    {[0, 0.5, 1].map((t) => <text key={t} className="ax" x={padL + W * t} y={h - 6} textAnchor="middle">{fmt(hi * t)}</text>)}
    {mark != null && <><line x1={padL + (W * mark) / hi} x2={padL + (W * mark) / hi} y1={4} y2={8 + H} stroke="var(--brand)" strokeWidth={2} /><text className="ax" x={padL + (W * mark) / hi + 4} y={14} fill="var(--brand)">proposal</text></>}
  </svg>;
}

export function Spark({ vals, w = 90, h = 22, color = '#a3a8b1' }: { vals: (number | null | undefined)[]; w?: number; h?: number; color?: string }) {
  const v = vals.filter((x): x is number => x != null && isFinite(x)); if (v.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;
  const lo = Math.min(...v), hi = Math.max(...v), X = (i: number) => 2 + ((w - 4) * i) / (vals.length - 1), Y = (x: number) => h - 3 - (h - 6) * (hi === lo ? 0.5 : (x - lo) / (hi - lo));
  let d = '', st = false; vals.forEach((x, i) => { if (x == null || !isFinite(x)) { st = false; return; } d += (st ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(x).toFixed(1); st = true; });
  const li = vals.length - 1, lv = vals[li];
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`}><path d={d} fill="none" stroke={color} strokeWidth={1.5} />{lv != null && isFinite(lv) && <circle cx={X(li)} cy={Y(lv)} r={2} fill={color} />}</svg>;
}

export interface MBar { k: string; v: number; color?: string; tip?: string; go?: string; label?: string }
export function MonthBars({ entries, w = 640, h = 200, fmt = fmtM, mark = null, cum = null }: { entries: MBar[]; w?: number; h?: number; fmt?: Fmt; mark?: string | null; cum?: number[] | null }) {
  if (!entries.length) return <Empty>No scheduled capital</Empty>;
  const padL = 50, padR = 10, padT = 10, padB = 26, W = w - padL - padR, H = h - padT - padB;
  const hi = niceMax(Math.max(...entries.map((e) => e.v), cum ? Math.max(...cum) : 0) * 1.05);
  const bw = W / entries.length, Y = (v: number) => padT + H - (H * v) / hi;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {ticks(hi, 4).map((t) => <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{fmt(t)}</text></Fragment>)}
    {entries.map((e, i) => { const x = padL + bw * i; return <Fragment key={i}><rect x={x + 1} y={Y(e.v)} width={Math.max(1, bw - 2)} height={Math.max(0, padT + H - Y(e.v))} rx={2} fill={e.color || (mark && e.k <= mark ? '#4b5059' : '#3987e5')} {...at(e.tip || `${monthLabel(e.k)}: ${fmt(e.v)}`, e.go)} />
      {(entries.length <= 16 || i % 3 === 0) && <text className="ax" x={x + bw / 2} y={h - 8} textAnchor="middle">{e.label || monthLabel(e.k)}</text>}</Fragment>; })}
    {cum && <path d={cum.map((v, i) => (i ? 'L' : 'M') + (padL + bw * (i + 0.5)) + ',' + Y(v)).join('')} fill="none" stroke="#e8e9eb" strokeWidth={2} />}
  </svg>;
}

export interface SPt { x: number; y: number; tip?: string; go?: string; color?: string }
export function Scatter({ pts, w = 560, h = 240, xFmt = (v) => String(v), yFmt = fmtM, xLabel = '' }: { pts: SPt[]; w?: number; h?: number; xFmt?: Fmt; yFmt?: Fmt; xLabel?: string }) {
  if (!pts.length) return <Empty>No observations</Empty>;
  const padL = 52, padR = 14, padT = 10, padB = 34, W = w - padL - padR, H = h - padT - padB; const xh = niceMax(Math.max(...pts.map((p) => p.x))), yh = niceMax(Math.max(...pts.map((p) => p.y)));
  const X = (v: number) => padL + (W * v) / xh, Y = (v: number) => padT + H - (H * v) / yh;
  return <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
    {ticks(yh, 4).map((t) => <Fragment key={t}><line className="grid" x1={padL} x2={padL + W} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 6} y={Y(t) + 3} textAnchor="end">{yFmt(t)}</text></Fragment>)}
    {ticks(xh, 4).map((t) => <text key={t} className="ax" x={X(t)} y={h - 18} textAnchor="middle">{xFmt(t)}</text>)}
    <text className="ax" x={padL + W / 2} y={h - 3} textAnchor="middle">{xLabel}</text>
    {pts.map((p, i) => <circle key={i} cx={X(p.x).toFixed(1)} cy={Y(p.y).toFixed(1)} r={4.5} fill={p.color || '#3987e5'} fillOpacity={0.8} stroke="var(--panel)" strokeWidth={1.5} {...at(p.tip, p.go)} />)}
  </svg>;
}

export function CapStack({ segs, total, fmt = fmtM }: { segs: { k: string; v: number; color: string; go?: string }[]; total: number; fmt?: Fmt }) {
  return <>
    <div className="capstack">{segs.map((s) => <i key={s.k} style={{ width: `${Math.max(0, (100 * s.v) / total).toFixed(2)}%`, background: s.color }} {...at(`${s.k}: ${fmt(s.v)} (${pctf(s.v / total)})`, s.go)} />)}</div>
    <div className="legend">{segs.map((s) => <span key={s.k}><i style={{ background: s.color }} />{s.k} <b className="num">{fmt(s.v)}</b></span>)}</div>
  </>;
}

/** Percentile ladder with a marker for the selected value. */
export function PctBar({ st, v, fmt = fmtM }: { st: Stats & { _a?: number[] }; v: number | null; fmt?: Fmt }) {
  if (!st || st.n < 1) return <Empty>No market</Empty>;
  const hi = niceMax(Math.max(st.max, v || 0)); const X = (x: number) => (100 * x) / hi;
  const seg = (a: number, b: number, c: string) => <i style={{ left: `${X(a)}%`, width: `${Math.max(0, X(b) - X(a))}%`, background: c }} />;
  return <div className="pbar">{seg(0, st.p25, '#23262d')}{seg(st.p25, st.p50, '#2c3f5c')}{seg(st.p50, st.p75, '#2f5b99')}{seg(st.p75, st.p90, '#3987e5')}{seg(st.p90, hi, '#6aa6ee')}
    {(['p25', 'p50', 'p75', 'p90'] as const).map((k) => <b key={k} style={{ left: `${X(st[k])}%` }} data-tip={`${k.toUpperCase()} ${fmt(st[k])}`}><em>{k.toUpperCase()}</em></b>)}
    {v != null && <u style={{ left: `${X(v)}%` }} data-tip={`Selected ${fmt(v)} · percentile ${rank(st._a || [], v).toFixed(0)}`} />}</div>;
}
