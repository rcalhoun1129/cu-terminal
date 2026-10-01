/* Numeric, date and formatting helpers. Ported 1:1 from the reference `U` object — algorithms must not change
   (percentiles are linear-interpolated like Excel PERCENTILE.INC; summation order matters for cent parity). */

export const sum = (a: readonly (number | null | undefined)[]): number => a.reduce<number>((x, y) => x + (+(y as number) || 0), 0);
export function pct(a: number[], p: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  if (s.length === 1) return s[0];
  const r = (p / 100) * (s.length - 1), lo = Math.floor(r), hi = Math.ceil(r);
  return s[lo] + (s[hi] - s[lo]) * (r - lo);
}
export const median = (a: number[]): number => pct(a, 50);
export const mean = (a: number[]): number => (a.length ? sum(a) / a.length : NaN);
export function rank(a: number[], v: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  let below = 0, eq = 0;
  for (const x of s) { if (x < v) below++; else if (x === v) eq++; }
  return (100 * (below + 0.5 * eq)) / s.length;
}
export function by<T, K>(a: T[], f: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of a) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); }
  return m;
}
export const uniq = <T,>(a: T[]): T[] => [...new Set(a)];

export function fmtM(v: number | null | undefined, d = 2): string {
  if (v == null || isNaN(v)) return '—';
  const s = v < 0 ? '-' : ''; v = Math.abs(v);
  if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(d) + 'M';
  if (v >= 1e3) return s + '$' + (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + 'K';
  return s + '$' + v.toFixed(0);
}
export function fmt$(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmt0(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
}
export function pctf(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return (v * 100).toFixed(d) + '%';
}
export function sgn(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
}
export const idx = (v: number | null | undefined): string => (v == null || isNaN(v) ? 'N/A' : v.toFixed(1));
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function monthAdd(k: string, n: number): string {
  let y = +k.slice(0, 4), m = +k.slice(5, 7) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function monthRange(a: string, b: string): string[] {
  const r: string[] = []; let k = a;
  while (k <= b) { r.push(k); k = monthAdd(k, 1); }
  return r;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const mlabel = (k: string): string => MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4);
export function norm(s: unknown): string {
  return String(s || '').toLowerCase().replace(/\*/g, ' ').replace(/"[^"]*"/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, ' ')
    .replace(/[^a-z' \-]/g, ' ').replace(/-/g, ' ').replace(/'/g, '').split(/\s+/).filter(Boolean).join(' ');
}
