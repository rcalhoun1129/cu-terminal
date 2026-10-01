/* Re-import of a newer 26-27 Rev Share book (XLSX/CSV), ported from the reference importBook().
   The file is parsed in the browser with SheetJS from cdnjs; nothing is uploaded. */
import type { CuData, Episode, ImportedBook, Player } from './types';
import { norm, sum } from '../engine/util';

declare global { interface Window { XLSX?: { read: (d: ArrayBuffer, o: object) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_json: (s: unknown, o: object) => unknown[][] } } } }

export function loadXLSX(): Promise<void> {
  return new Promise((res, rej) => {
    if (window.XLSX) return res();
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the spreadsheet reader (needs internet access to cdnjs.cloudflare.com)'));
    document.head.appendChild(s);
  });
}
const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function sim(a: string, b: string): number {
  if (a === b) return 1; const m = a.length, n = b.length; if (!m || !n) return 0;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
export function resolveName(raw: string, A: Record<string, string>): { id: string; ok: boolean } {
  const r = raw.includes(',') ? raw.split(',').slice(1).join(' ') + ' ' + raw.split(',')[0] : raw; const n = norm(r);
  if (A[n]) return { id: A[n], ok: true };
  const nk = (r.match(/"([^"]+)"/) || [])[1];
  if (nk) { const n2 = norm(nk + ' ' + norm(r).split(' ').slice(-1)[0]); if (A[n2]) return { id: A[n2], ok: true }; }
  let best: string | null = null, bs = 0; for (const k of Object.keys(A)) { const s = sim(n, k); if (s > bs) { bs = s; best = k; } }
  if (bs >= 0.88 && best) return { id: A[best], ok: true };
  return { id: r.replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim(), ok: false };
}
export function numv(x: unknown): number {
  if (x == null || x === '') return NaN; if (typeof x === 'number') return x;
  const t = String(x).replace(/[$,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? +t : NaN;
}

/** Parse rows (already read from a sheet) into an ImportedBook. Exposed for testing without SheetJS. */
export function parseBookRows(fileName: string, sheets: { name: string; rows: unknown[][] }[], data: CuData, known: Set<string>): ImportedBook {
  let found: { sn: string; rows: unknown[][]; hi: number; li: number; fi: number; ci: number; hdr: string[] } | null = null;
  for (const { name: sn, rows } of sheets) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = (rows[i] || []).map((x) => String(x ?? '')); const li = r.findIndex((x) => /last\s*name/i.test(x)), fi = r.findIndex((x) => /first\s*name/i.test(x)); const ci = r.findIndex((x) => /2026\s*-\s*27[\s\S]*caps/i.test(x));
      if (li >= 0 && fi >= 0 && ci >= 0) { found = { sn, rows, hi: i, li, fi, ci, hdr: r }; break; }
    }
    if (found) break;
  }
  if (!found) throw new Error('No sheet with “Last Name”, “First Name” and a “2026-27 … CAPS” column was found.');
  const { rows, hi, li, fi, ci, hdr, sn } = found;
  const f28 = hdr.findIndex((x) => /2027\s*-\s*28[\s\S]*caps/i.test(x)), term = hdr.findIndex((x) => /term\s*length/i.test(x)), face = hdr.findIndex((x) => /contract\s*compensation|total\s*contractual/i.test(x)), stc = hdr.findIndex((x) => /status/i.test(x));
  const mcols: [number, string][] = [];
  hdr.forEach((h, j) => {
    const m = /^\s*([a-z]{3,5})\.?\s*(?:\d{1,2}\s*)?(20\d\d)\s*$/i.exec(h.replace(/\s+/g, ' '));
    if (m && !/caps|total|incentive/i.test(h)) { const mo = MON[m[1].toLowerCase().slice(0, 3)]; if (!mo) return; const k = `${m[2]}-${String(mo).padStart(2, '0')}`; if (k >= '2026-07' && k <= '2027-07') mcols.push([j, k]); }
  });
  const eps: Episode[] = []; const newPlayers: Player[] = []; let cur: string | null = null, curRaw = '', amend = 0, n = 0; const unmatched: { raw: string; id: string }[] = [];
  let blanks = 0;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const ln = r[li], fn = r[fi];
    if (r.every((x) => x == null || x === '')) { if (++blanks >= 2 && n > 0) break; continue; } blanks = 0;
    if (r.some((x) => typeof x === 'string' && /\b(cap total|total|committed|remaining|buyout|available|spend|carryover|spendable|locked)\b/i.test(x)) && !(ln && fn)) continue;
    if (ln && String(ln).trim()) {
      if (/total|committed|cap\b|remaining|buyout/i.test(String(ln)) && !fn) continue;
      curRaw = `${fn || ''} ${ln}`.trim(); const res = resolveName(curRaw, data.aliases); cur = res.id; amend = 0; if (!res.ok) unmatched.push({ raw: curRaw, id: cur });
    } else { if (!cur) continue; amend++; }
    const v = numv(r[ci]); if (!isFinite(v)) continue; n++;
    const months: Record<string, number> = {}; mcols.forEach(([j, k]) => { const x = numv(r[j]); if (isFinite(x) && x > 0) months[k] = (months[k] || 0) + x; });
    if (!known.has(cur!) && !newPlayers.some((p) => p.id === cur)) {
      const off = { onRoster: false, acq: 'UNKNOWN' };
      newPlayers.push({ id: cur!, name: cur!, legal: [curRaw], aliases: [curRaw], seasons: { '2024': off, '2025': off, '2026': off }, fallbackPos: null, lastPos: null,
        ticker: cur!.split(' ').map((w) => w[0]).join('').toUpperCase() + '.UNK', rslaStatus: '', elig: '', identity: 'NEEDS REVIEW', offRosterNote: 'Added from imported 26-27 book; not on an official roster' });
    }
    eps.push({ id: 'I' + String(eps.length + 1).padStart(4, '0'), pid: cur!, regime: 'INSTITUTIONAL', season: 2026, kind: 'FCST26', imported: true, amend, src: `${fileName} › ${sn} › row ${i + 1}`, srcRaw: amend ? '(amendment row)' : curRaw,
      face: face >= 0 && isFinite(numv(r[face])) ? numv(r[face]) : null, term: term >= 0 && isFinite(numv(r[term])) ? numv(r[term]) : null, months, capital: v,
      capsBy: { 'FY26-27': v, 'FY27-28': f28 >= 0 && isFinite(numv(r[f28])) ? numv(r[f28]) : 0 }, status: stc >= 0 ? String(r[stc] ?? '') : '', conf: 'VERIFIED', note: 'Imported current book' });
  }
  if (!eps.length) throw new Error('No numeric 2026-27 CAPS values found under the header row.');
  // the season-2026 buyout line is kept from the loaded book (buyouts are not in the athlete CAPS column)
  return { file: fileName, rows: n, total: sum(eps.map((e) => e.capital)), episodes: eps, unmatched, months: mcols.length, newPlayers };
}

export async function importBook(file: File, data: CuData): Promise<ImportedBook> {
  await loadXLSX();
  const X = window.XLSX!; const isCsv = /\.csv$/i.test(file.name);
  const wb = X.read(await file.arrayBuffer(), { type: 'array', raw: isCsv });
  const sheets = wb.SheetNames.map((name) => ({ name, rows: X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) }));
  return parseBookRows(file.name, sheets, data, new Set(data.players.map((p) => p.id)));
}
