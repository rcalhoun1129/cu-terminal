import { AS_OF, POSMAP, REGIME } from './constants';
import type { Holding, Model } from './model';
import { mlabel } from './util';

export type Precision = 'day' | 'month' | 'fy' | 'offseason';
export interface TapeEvent {
  date: string; prec: Precision; pid: string; pos: string; action: string; old: number | null; nu: number | null;
  term: number | string | null | undefined; regime: string; status: string | undefined; eid: string; delta?: number | null;
}

/** Securities-style blotter derived from contract episodes and official roster exits. */
export function tape(M: Model): TapeEvent[] {
  const T: TapeEvent[] = [];
  const add = (o: TapeEvent) => T.push(o);
  for (const e of M.episodes) {
    const p = M.players.get(e.pid); if (!p) continue;
    const hs = e.kind === 'COLLECTIVE_2024' ? 2024 : e.kind === 'RSLA' ? 2025 : 2026;
    const hh = ((M.h[hs] && M.h[hs].get(e.pid)) || {}) as Partial<Holding>;
    const pos = hh.bs || POSMAP[p.lastPos as string] || 'UNK';
    if (e.kind === 'COLLECTIVE_2024') {
      const acq = p.seasons['2024'].acq;
      add({ date: Object.keys(e.months).sort()[0] || '2024-06', prec: 'month', pid: e.pid, pos, action: acq === 'RETAINED' ? 'RETAIN' : 'BUY', old: null, nu: e.capital, term: e.term, regime: 'COLLECTIVE', status: e.note, eid: e.id });
    } else if (e.kind === 'COLLECTIVE_SP25') {
      const st = e.status || ''; let act = 'BUY';
      if (/^Amend/i.test(st)) act = 'AMEND'; else if (/^New contract/i.test(st)) act = M.h[2024].get(e.pid) ? 'RENEW' : 'BUY'; else if (/cancel/i.test(st)) act = 'TERMINATE'; else if (/progress/i.test(st)) act = 'BUY';
      const prior = M.h[2024].get(e.pid);
      add({ date: e.signed ? e.signed.slice(0, 10) : Object.keys(e.months).sort()[0] || '2025-01', prec: e.signed ? 'day' : 'month', pid: e.pid, pos, action: act, old: prior ? prior.capital : null, nu: e.capital, term: e.term, regime: 'COLLECTIVE (SP25)', status: st, eid: e.id });
    } else if (e.kind === 'RSLA') {
      const prev = (M.epsByPlayer.get(e.pid) || []).filter((x) => x.kind === 'RSLA' && (x.amend || 0) < (e.amend || 0)).pop();
      const acq = hh.acq; const act = (e.amend || 0) > 0 ? 'AMEND' : acq === 'RETAINED' ? 'RETAIN' : 'BUY';
      const h24 = M.h[2024].get(e.pid) as Holding | undefined;
      add({ date: (e.signed || e.sent || Object.keys(e.months).sort()[0] || '2025-07').slice(0, 10), prec: e.signed || e.sent ? 'day' : 'month', pid: e.pid, pos, action: act,
        old: prev ? prev.capital : (h24 ? h24.capital : undefined) ?? null, nu: e.capital, term: e.term || e.termRaw, regime: 'INSTITUTIONAL Y1', status: e.status, eid: e.id });
      const tm = /(Terminated|Expired|Revoked)[^0-9]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(e.status || '');
      if (tm) add({ date: `${tm[4]}-${tm[2].padStart(2, '0')}-${tm[3].padStart(2, '0')}`, prec: 'day', pid: e.pid, pos, action: /Terminated/i.test(tm[1]) ? 'TERMINATE' : /Revoked/i.test(tm[1]) ? 'AMEND' : 'EXPIRE', old: e.capital, nu: 0, term: null, regime: 'INSTITUTIONAL Y1', status: e.status, eid: e.id });
    } else if (e.kind === 'FCST26' || e.kind === 'IMPORT26') {
      const prior = M.h[2025].get(e.pid); const isNew = /NEW/i.test(e.status || '') || !prior;
      add({ date: '2026-07', prec: 'fy', pid: e.pid, pos, action: isNew ? 'BUY' : e.capital > (prior ? prior.capital : 0) ? 'INCREASE' : e.capital < (prior ? prior.capital : 0) ? 'REDUCE' : 'RENEW',
        old: prior ? prior.capital : null, nu: e.capital, term: e.term, regime: 'INSTITUTIONAL Y2', status: e.status + (e.summerAdd ? ' · Summer 2026 add' : ''), eid: e.id });
    } else if (e.kind === 'BUYOUT') {
      add({ date: e.season === 2025 ? '2026-01' : '2026-07', prec: e.season === 2025 ? 'month' : 'fy', pid: e.pid, pos, action: 'BUYOUT', old: null, nu: e.capital, term: null, regime: e.season === 2025 ? 'INSTITUTIONAL Y1' : 'INSTITUTIONAL Y2', status: e.note, eid: e.id });
    }
  }
  // roster exits between seasons (official rosters)
  for (const [a, b] of [[2024, 2025], [2025, 2026]]) {
    for (const h of M.holdings(a)) {
      if (h.capital <= 0 || !h.inSeason) continue; const p = M.players.get(h.pid)!; if (p.seasons[String(b) as '2024'].onRoster) continue;
      add({ date: `${b}-01`, prec: 'offseason', pid: h.pid, pos: h.bs, action: 'EXIT', old: h.capital, nu: null, term: null, regime: REGIME[a], status: `Not on official ${b} roster`, eid: h.eps[0] });
    }
  }
  T.forEach((t) => { t.delta = t.nu != null && t.old != null ? t.nu - t.old : null; });
  T.sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
  return T;
}

export function daysTo(d: string): number { return Math.round((new Date(d + 'T00:00:00Z').getTime() - new Date(AS_OF + 'T00:00:00Z').getTime()) / 864e5); }
export function dateLabel(t: TapeEvent): string {
  if (t.prec === 'day') return t.date; if (t.prec === 'month') return mlabel(t.date); if (t.prec === 'fy') return 'FY26-27';
  if (t.prec === 'offseason') return 'Offseason ' + (+t.date.slice(0, 4) - 1) + '-' + t.date.slice(2, 4);
  return t.date;
}
