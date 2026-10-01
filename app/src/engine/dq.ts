import type { Conf } from '../data/types';
import { AS_OF, SEASONS } from './constants';
import type { Model } from './model';
import { fmt$, fmt0 } from './util';

export interface DqItem { sev: Conf; area: string; item: string; detail: string; pid?: string; eid?: string }

/** Data-quality register. Generic rules live here; dataset-specific findings come from `data.dqNotes`
 *  (slot 1 follows the Fall-25 spend item, slot 2 follows the FY26-27 book item — same order as the reference app). */
export function dataQuality(M: Model): DqItem[] {
  const Q: DqItem[] = [];
  const C = M.data.controls; const notes = M.data.dqNotes || [];
  const slot = (n: number) => notes.filter((x) => (x.slot ?? 2) === n).forEach(({ slot: _s, ...x }) => Q.push(x));
  Q.push({ sev: 'RECONCILED', area: 'Dollar reconciliation', item: 'FY25-26 committed ties to file control AL191', detail: `${fmt$(M.committed[2025] - 25000)} athlete CAPS + $25,000.00 buyout = ${fmt$(M.committed[2025])}; file AL191 ${fmt$(C['FY25-26 contractually committed (file AL191)'])}` });
  const sHard = C['Fall 2025 actual spend (hard-coded AQ190)'], sForm = C['Fall 2025 spend (formula Q190 = SUM J3:Q186)'];
  Q.push({ sev: 'NEEDS REVIEW', area: 'Dollar reconciliation', item: `Fall 2025 actual spend: hard-coded vs formula differ by ${fmt$(Math.round((sHard - sForm) * 100) / 100)}`, detail: `AQ190 (hard-coded) ${fmt$(sHard)} vs Q190 SUM(J3:Q186) ${fmt$(sForm)}` });
  slot(1);
  const B = M.data.reference.current2627Book;
  Q.push({ sev: 'VERIFIED', area: 'Dollar reconciliation', item: M.imported ? `FY26-27 replaced for this session by ${M.imported.file}` : 'FY26-27 per-player CAPS tie to the current 26-27 book control block',
    detail: `${B.rows} records · athlete CAPS ${fmt$(B.caps)} + F26 buyout ${fmt$(B.buyout)} + remaining ${fmt$(B.available)} = cap ${fmt$(B.cap)}. Loaded: ${fmt$(M.committed[2026])} incl. buyout.` });
  slot(2);
  Q.push({ sev: 'FORECAST', area: 'Historical vs current conflict', item: 'Spring-26 forecast snapshot kept as history', detail: `Snapshot FY26-27 ${fmt$(C['Fall 26 contractually committed (forecast tab)'] + C['Spring 27 contractually committed (forecast tab)'])} (incl. buyout) vs current book — see Forecast › Forecast vs Book.` });
  for (const p of M.players.values()) {
    if (p.identity !== 'VERIFIED') Q.push({ sev: 'NEEDS REVIEW', area: 'Name match conflict', item: p.id, detail: p.offRosterNote || 'Not on any official 2024–26 roster', pid: p.id });
    const any = SEASONS.some((s) => p.seasons[String(s) as '2024'].pos) || p.fallbackPos;
    if (!any) Q.push({ sev: 'NEEDS REVIEW', area: 'Missing official position', item: p.id, detail: 'No roster position in any season; excluded from position markets', pid: p.id });
  }
  for (const e of M.episodes) { if (e.kind === 'RSLA' && /revoked|supercede/i.test(e.status! + e.note)) Q.push({ sev: 'RECONCILED', area: 'Overlapping contract episode', item: e.pid, detail: 'Revoked & superseded agreement — only paid months carried; the successor episode holds the rest', pid: e.pid, eid: e.id }); }
  for (const t of M.third) Q.push({ sev: 'NEEDS REVIEW', area: 'Unverified third-party capital', item: t.pid, detail: `Paradigma ${fmt0(t.paradigma)} · package ${fmt0(t.package)} (TP file, separate ledger)`, pid: t.pid });
  // status label conflicts (RSLA status vs roster)
  for (const p of M.players.values()) {
    const st = p.rslaStatus || ''; const on25 = p.seasons['2025'].onRoster, on26 = p.seasons['2026'].onRoster;
    if (/^Incomer/.test(st) && on25 && !on26) Q.push({ sev: 'NEEDS REVIEW', area: 'Status label conflict', item: p.id, detail: `RSLA status '${st}' but on 2025 roster and not on 2026`, pid: p.id });
    if (st === 'REMOVED' && on26) { const cur = p.book && p.book.status === 'Current'; Q.push({ sev: cur ? 'RECONCILED' : 'NEEDS REVIEW', area: 'Status label conflict', item: p.id, detail: cur ? '25-26 RSLA file says REMOVED; the current 26-27 book shows Current and he is on the 2026 roster — 25-26 label is stale' : 'RSLA status REMOVED but on official 2026 roster', pid: p.id }); }
    const bk = p.book;
    if (bk) {
      if (bk.status === 'REMOVED' && on26) Q.push({ sev: 'NEEDS REVIEW', area: 'Status label conflict', item: p.id, detail: '26-27 book status REMOVED but on official 2026 roster', pid: p.id });
      if (/^Incomer/.test(bk.status) && on25) Q.push({ sev: 'NEEDS REVIEW', area: 'Status label conflict', item: p.id, detail: `26-27 book status '${bk.status}' but on the 2025 roster`, pid: p.id });
    }
  }
  for (const e of M.episodes) {
    if (e.book && /ineligible|removed|buyout/i.test((e.note || '') + ' ' + (e.faceRaw || '') + ' ' + (e.termRaw || '') + ' ' + (e.history || '')))
      Q.push({ sev: 'NEEDS REVIEW', area: 'Zero-value record', item: e.pid, detail: `26-27 book: ${[e.faceRaw, e.note, e.history ? '$ history: ' + e.history : ''].filter(Boolean).join('; ')} · FY26-27 ${fmt$(e.capsBy['FY26-27'])}`, pid: e.pid, eid: e.id });
  }
  for (const e of M.episodes) { if (e.signed && e.signed.slice(0, 10) > AS_OF) Q.push({ sev: 'NEEDS REVIEW', area: 'Missing entry date', item: e.pid, detail: `Signed date ${e.signed.slice(0, 10)} is after the as-of date (${e.src}), probably a year typo`, pid: e.pid, eid: e.id }); }
  Q.push({ sev: 'ESTIMATED', area: 'Missing entry/exit date', item: 'Roster tenure is season-grain', detail: 'Official rosters give season presence, not join/leave dates. Roster tenure is measured in seasons (×12 months); 6/18/36-month survival cannot be observed.' });
  Q.push({ sev: 'ESTIMATED', area: 'Eligibility', item: 'RSLA eligibility cells were date-coerced', detail: 'Values such as 2025-05-04 were recovered as "5-4" (years to play / seasons). Confirm against compliance records.' });
  return Q;
}
