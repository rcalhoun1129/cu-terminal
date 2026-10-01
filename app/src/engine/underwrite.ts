/* Underwriting, deal-structure and offer calculations (reference uwCalc / fyAlloc / dealMonths). Pure functions of the model. */
import { PICK_G, SEASONS } from './constants';
import { acqBucket, inGroup, stats, type Holding, type Model } from './model';
import { median, monthAdd, monthRange, rank, sum } from './util';

export { PICK_G };

export interface UwInput { name?: string; pos: string; acq: string; role: string; ask: number; months: number; start: string; elig: string; third: number; replacing: string; basis: string }
export interface DealInput { pos: string; total: number; start: string; months: number; fall: number; inc: number; buyout: number; pays: number[] | null }

export interface FyAlloc { fy2627: number; fy2728: number; later: number; sched: [string, number][] }
/** Equal monthly payments from the start month, split by fiscal year. */
export function fyAlloc(total: number, months: number, start: string): FyAlloc {
  const out: FyAlloc = { fy2627: 0, fy2728: 0, later: 0, sched: [] }; if (!(months > 0)) return out; const per = total / months; let k = start;
  for (let i = 0; i < months; i++) { out.sched.push([k, per]); if (k <= '2027-06') out.fy2627 += per; else if (k <= '2028-06') out.fy2728 += per; else out.later += per; k = monthAdd(k, 1); }
  return out;
}

export function uwCalc(M: Model, u: UwInput) {
  const g = u.pos, pool = M.bandPool(g, u.basis), st = stats(pool);
  const o = SEASONS.flatMap((s) => M.obs(s, g));
  const acqPool = o.filter((x) => x.h.acq !== 'RETAINED').map((x) => x.v), retPool = o.filter((x) => x.h.acq === 'RETAINED').map((x) => x.v);
  const chPool = o.filter((x) => acqBucket(x.h.acq) === u.acq).map((x) => x.v);
  const room = M.A.market[g][2026];
  const m12 = u.months ? (u.ask / u.months) * 12 : NaN, perMo = u.months ? u.ask / u.months : NaN;
  const fy = fyAlloc(u.ask, u.months, u.start);
  const com = M.committed[2026], cap = M.caps[2026];
  const rep: Holding | undefined | '' = u.replacing && M.h[2026].get(u.replacing);
  const repCap = rep ? rep.capital : 0;
  const newCom = com + fy.fy2627 - repCap;
  const roomCap = room.roomCapital + fy.fy2627 - (rep && inGroup(rep, g) ? rep.capital : 0);
  const totAth = sum(M.holdings(2026).map((h) => h.capital));
  const priced = u.months === 12 ? u.ask : m12;
  return {
    g, pool, st, acqMed: median(acqPool), retMed: median(retPool), chMed: median(chPool), chN: chPool.length, roomMed: room.median, m12, perMo,
    pct: rank(pool, priced), band: M.bandOf(g, priced, u.basis), q: M.quote(g, u.basis),
    replCost: median(acqPool), fy, newCom, newUtil: newCom / cap, newDry: cap - newCom, roomCap,
    roomShareOld: room.roomCapital / totAth, roomShareNew: roomCap / (totAth + fy.fy2627 - repCap), rep: rep || null,
  };
}

/** Deal-builder monthly schedule (FY26-27 months, then any later months). */
export function dealMonths(D: DealInput): [string, number][] {
  const ks = monthRange('2026-07', '2027-06'); if (D.pays) return ks.map((k, i) => [k, D.pays![i] || 0]);
  const ms = monthRange(D.start, monthAdd(D.start, D.months - 1)); const fallM = ms.filter((k) => +k.slice(5) >= 7), sprM = ms.filter((k) => +k.slice(5) < 7);
  const base = D.total - D.inc; const fall = fallM.length && sprM.length ? (base * D.fall) / 100 : fallM.length ? base : 0; const spr = base - fall;
  const map: Record<string, number> = {}; fallM.forEach((k) => { map[k] = (map[k] || 0) + fall / fallM.length; }); sprM.forEach((k) => { map[k] = (map[k] || 0) + spr / sprM.length; });
  if (D.inc) { const k = '2026-12'; map[k] = (map[k] || 0) + D.inc; }
  return ks.map((k) => [k, map[k] || 0] as [string, number]).concat(Object.keys(map).filter((k) => k > '2027-06').sort().map((k) => [k, map[k]] as [string, number]));
}

export function dealImpact(M: Model, D: DealInput) {
  const ms = dealMonths(D);
  const fy = sum(ms.filter(([k]) => k <= '2027-06').map(([, v]) => v)) + D.buyout, fut = sum(ms.filter(([k]) => k > '2027-06').map(([, v]) => v));
  const fall = sum(ms.filter(([k]) => k >= '2026-07' && k <= '2026-12').map(([, v]) => v)), spr = sum(ms.filter(([k]) => k >= '2027-01' && k <= '2027-06').map(([, v]) => v));
  const paidMonths = ms.filter(([, v]) => v > 0).length, m12 = paidMonths ? ((fy + fut - D.buyout) / paidMonths) * 12 : NaN;
  const pool = M.bandPool(D.pos);
  const com = M.committed[2026] + fy, room = M.A.market[D.pos][2026].roomCapital + fy;
  return { ms, fy, fut, fall, spr, paidMonths, m12, pool, com, room, pct: rank(pool, m12), band: M.bandOf(D.pos, m12) };
}
