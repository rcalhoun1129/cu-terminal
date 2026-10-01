/* Reusable terminal UI primitives (panels, KPIs, tags, links, controls, sortable/exportable tables). */
import { Fragment, useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TICKERS } from '../engine/constants';
import type { Heat } from '../engine/heat';
import { esc, fmtM, sgn } from '../engine/util';
import { logAudit, setPath, store, type TraceItem } from '../state/store';
import { Spark } from './charts';

/* ---------------------------------------------------------------- source-traced money */
export function Money({ v, items, label = '', fmt = fmtM }: { v: number; items?: TraceItem[] | null; label?: string; fmt?: (v: number) => string }) {
  if (!items) return <span className="num">{fmt(v)}</span>;
  return <span className="num" data-trace="1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); store.set({ trace: { label, items } }); }}>{fmt(v)}</span>;
}

/* ---------------------------------------------------------------- panels & KPIs */
export function Oda({ which }: { which: 'OBSERVE' | 'ASSESS' | 'DECIDE' }) {
  return <span className="oda">{(['OBSERVE', 'ASSESS', 'DECIDE'] as const).map((x) => <span key={x} className={which === x ? 'on' : ''}>{x}</span>)}</span>;
}
export interface PanelProps { title?: ReactNode; n?: number | string; low?: boolean; oda?: 'OBSERVE' | 'ASSESS' | 'DECIDE'; right?: ReactNode; foot?: ReactNode; cls?: string; children?: ReactNode }
export function Panel({ title, n, low, oda, right, foot, cls = '', children }: PanelProps) {
  return (
    <section className={`pn ${cls}`}>
      {title != null && title !== '' && (
        <h3><span>{title}{n != null && <> <span className="muted num">N={n}</span></>}{low && <span className="low">LOW SAMPLE</span>}</span>
          <span className="r">{oda && <Oda which={oda} />}{right}</span></h3>
      )}
      <div className="bd">{children}</div>
      {foot != null && <div className="foot">{foot}</div>}
    </section>
  );
}
export function Kpi({ label, value, delta = null, prior = null, spark = null, cls = '' }: { label: ReactNode; value: ReactNode; delta?: string | null; prior?: ReactNode; spark?: (number | null)[] | null; cls?: string }) {
  const dc = delta == null ? '' : delta.startsWith('+') ? 'up' : delta.startsWith('-') || delta.startsWith('−') ? 'down' : '';
  return (
    <section className="pn"><div className="kpi"><small>{label}</small><span className={`v ${cls}`}>{value}</span><span className={`d ${dc}`}>{delta ?? ''}</span>
      <span className="p">{prior ?? ''}</span>{spark && <Spark vals={spark} />}</div></section>
  );
}
export function Chg({ a, b }: { a: number | null | undefined; b: number | null | undefined }) {
  if (a == null || b == null || !isFinite(a) || !isFinite(b) || !a) return <>—</>;
  const v = b / a - 1; return <span className={v >= 0 ? 'up' : 'down'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v * 100).toFixed(1)}%</span>;
}
export const chgTxt = (a: number | null | undefined, b: number | null | undefined): string | null =>
  a == null || b == null || !isFinite(a) || !isFinite(b) || !a ? null : sgn(b / a - 1);

/* ---------------------------------------------------------------- tags & links */
export const HeatTag = ({ h }: { h: Heat }) => <span className={`heat ${h.label === 'N/A' ? 'NA' : h.label}`}>{h.label}{h.score != null ? ' ' + h.score : ''}</span>;
export const Tag = ({ conf, children }: { conf?: string | null; children?: ReactNode }) => <span className={`tag ${(conf || '').split(' ')[0]}`}>{children ?? conf ?? ''}</span>;
export const Lbl = ({ t, cls = 'FORECAST' }: { t: string; cls?: string }) => <span className={`tag ${cls}`}>{t}</span>;
export const PLink = ({ pid }: { pid: string }) => <a href={`#/player/${encodeURIComponent(pid)}`} className="plink">{pid}</a>;
export function TLink({ g }: { g: string }) { const T = TICKERS.find((t) => t.g === g); return T ? <a href={`#/pos/${T.t}`} className="mono warn">{T.t}</a> : <>{g}</>; }
export const posName = (g: string) => TICKERS.find((t) => t.g === g)?.name ?? g;
export function LowTag({ n, minN, lowN }: { n: number; minN: number; lowN: number }) {
  return n < minN ? <span className="low">N/A</span> : n < lowN ? <span className="low">LOW N={n}</span> : null;
}
export const Note = ({ cls = '', children, style }: { cls?: string; children: ReactNode; style?: React.CSSProperties }) => <div className={`note ${cls}`} style={style}>{children}</div>;
export function KV({ rows }: { rows: [ReactNode, ReactNode, string?][] }) {
  return <dl className="kv">{rows.map(([a, b, c], i) => <Fragment key={i}><dt>{a}</dt><dd className={c}>{b}</dd></Fragment>)}</dl>;
}
export const Stat = ({ label, children }: { label: ReactNode; children: ReactNode }) => <div className="stat"><small>{label}</small><b>{children}</b></div>;
export const SrcLink = ({ s }: { s?: { title: string; url: string } | null }) => s ? <a className="muted" href={s.url} target="_blank" rel="noopener" data-tip="Open source in Google Drive">↗ {s.title}</a> : null;

/* ---------------------------------------------------------------- controls */
type Opt = string | number | [string | number, string];
const optPair = (o: Opt): [string, string] => (Array.isArray(o) ? [String(o[0]), o[1]] : [String(o), String(o)]);
/** Select bound to a store path (`f.` filters, `a.` assumptions, or a top-level setting). */
export function Sel({ path, opts, value, className, style }: { path: string; opts: Opt[]; value: unknown; className?: string; style?: React.CSSProperties }) {
  return <select className={className} style={style} value={String(value ?? '')} onChange={(e) => setPath(path, e.target.value)}>
    {opts.map((o) => { const [v, l] = optPair(o); return <option key={v} value={v}>{l}</option>; })}</select>;
}
/** Select that navigates to `prefix + value`. */
export function NavSel({ prefix, opts, value }: { prefix: string; opts: Opt[]; value: unknown }) {
  return <select className="inp" style={{ width: 'auto' }} value={String(value ?? '')} onChange={(e) => { location.hash = prefix + encodeURIComponent(e.target.value); }}>
    {opts.map((o) => { const [v, l] = optPair(o); return <option key={v} value={v}>{l}</option>; })}</select>;
}
export function Seg({ path, opts, value }: { path: string; opts: [string, string][]; value: unknown }) {
  return <span className="seg">{opts.map(([v, l]) => <button key={v} className={String(v) === String(value) ? 'on' : ''} onClick={() => setPath(path, v)}>{l}</button>)}</span>;
}

/* ---------------------------------------------------------------- tables */
export interface Col<R> { l: ReactNode; k?: keyof R & string; f?: (r: R) => ReactNode; v?: (r: R) => number | string | null | undefined; raw?: (r: R) => string | number; n?: boolean; cls?: string; t?: string }
export interface TableOpts<R> { tall?: boolean; maxh?: number; csv?: boolean; note?: ReactNode; go?: (r: R) => string }
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const nodeText = (n: ReactNode) => strip(renderToStaticMarkup(<>{n}</>));
const labelText = (n: ReactNode) => (typeof n === 'string' ? n : nodeText(n));

export function downloadCsv<R>(cols: Col<R>[], rows: R[]) {
  const cell = (c: Col<R>, r: R) => { const v = c.raw ? c.raw(r) : c.v ? c.v(r) : c.f ? nodeText(c.f(r)) : c.k ? (r[c.k] as unknown) : ''; return '"' + String(v ?? '').replace(/"/g, '""') + '"'; };
  const lines = [cols.map((c) => '"' + labelText(c.l) + '"').join(',')].concat(rows.map((r) => cols.map((c) => cell(c, r)).join(',')));
  const b = new Blob([lines.join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = `cu-buyside-${location.hash.replace(/[#/]/g, '_')}.csv`; a.click(); logAudit('Exported CSV ' + location.hash);
}

export function Table<R>({ cols, rows, opts = {} }: { cols: Col<R>[]; rows: R[]; opts?: TableOpts<R> }) {
  const [sort, setSort] = useState<{ k: number; d: boolean } | null>(null);
  let rs = rows;
  if (sort) {
    const c = cols[sort.k]; const f = c.v || ((r: R) => (c.k ? (r[c.k] as unknown) : null) as string | number | null);
    rs = [...rows].sort((a, b) => { const x = f(a), y = f(b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? '')); return sort.d ? -r : r; });
  }
  const clickSort = (i: number) => setSort((s) => (s && s.k === i ? { k: i, d: !s.d } : { k: i, d: !!cols[i].n }));
  return (
    <>
      <div className={`tw ${opts.tall ? 'tall' : ''}`} style={opts.maxh ? { maxHeight: opts.maxh } : undefined}>
        <table className="t"><thead><tr>{cols.map((c, i) => <th key={i} className={c.n ? 'n' : ''} title={c.t || ''} onClick={() => clickSort(i)}>{c.l}{sort?.k === i ? (sort.d ? ' ▼' : ' ▲') : ''}</th>)}</tr></thead>
          <tbody>{rs.map((r, ri) => <tr key={ri} data-go={opts.go ? opts.go(r) : undefined}>{cols.map((c, i) => <td key={i} className={`${c.n ? 'n' : ''} ${c.cls || ''}`}>{c.f ? c.f(r) : c.k ? String((r[c.k] as unknown) ?? '') : ''}</td>)}</tr>)}</tbody></table>
      </div>
      {opts.csv !== false && <div className="foot" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{rows.length} rows{opts.note ? <> · {opts.note}</> : null}</span>
        <a className="muted" role="button" style={{ cursor: 'pointer' }} onClick={() => downloadCsv(cols, rows)}>⇩ CSV</a></div>}
    </>
  );
}
export { esc };
