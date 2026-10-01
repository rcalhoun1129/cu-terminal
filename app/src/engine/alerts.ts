import { AS_OF, AS_OF_M, TICKERS } from './constants';
import type { Model } from './model';
import { fmtM, mlabel, pct, pctf, sum } from './util';
import { daysTo } from './tape';

export interface Alert { lvl: 'warn' | 'info' | 'crit' | 'dq'; code: string; txt: string; go: string }

export function alerts(M: Model): Alert[] {
  const out: Alert[] = []; const A = M.A, S = M.settings;
  for (const T of TICKERS) {
    const i = A.index[T.g]; const a = i[2025].v, b = i[2026].v;
    if (a && b && (b / a - 1) * 100 > S.assume.yoyAlert) out.push({ lvl: 'warn', code: T.t + ' MEDIAN +' + ((b / a - 1) * 100).toFixed(0) + '% YoY', txt: `${T.name} median ${fmtM(A.market[T.g][2025].median)} → ${fmtM(A.market[T.g][2026].median)} (N=${A.market[T.g][2026].n})`, go: '#/pos/' + T.t });
    if (a && b && (b / a - 1) * 100 < -S.assume.yoyAlert) out.push({ lvl: 'info', code: T.t + ' MEDIAN ' + ((b / a - 1) * 100).toFixed(0) + '% YoY', txt: `${T.name} median down year over year`, go: '#/pos/' + T.t });
  }
  // exception-level (> pooled P90 of position)
  for (const h of M.holdings(2026)) {
    if (h.capital < S.threshold) continue; const pool = M.bandPool(h.bs); if (pool.length < S.lowN) continue; const p90 = pct(pool, 90);
    if (h.capital > p90) out.push({ lvl: 'info', code: 'EXCEPTION PRICE · ' + M.players.get(h.pid)!.ticker, txt: `${h.pid} ${fmtM(h.capital)} > ${h.bs} P90 ${fmtM(p90)}`, go: '#/player/' + encodeURIComponent(h.pid) });
  }
  // maturities
  const days = S.assume.maturityDays; const lim = days <= 30 ? '2026-10' : days <= 60 ? '2026-11' : '2026-12';
  const mat = A.maturity.rows.filter((r) => r.final && r.final > AS_OF_M && r.final <= lim);
  if (mat.length) out.push({ lvl: 'warn', code: `MATURITY < ${days}D · ${mat.length} contracts`, txt: `${fmtM(sum(mat.map((r) => r.remaining)))} remaining obligation matures by ${mlabel(lim)}`, go: '#/maturity' });
  // concentration & reserve (only when management thresholds are set)
  const c = A.conc[2026];
  if (S.assume.top5 != null && c.top5 * 100 > S.assume.top5) out.push({ lvl: 'warn', code: 'TOP-5 CONCENTRATION ' + pctf(c.top5), txt: `exceeds management threshold ${S.assume.top5}%`, go: '#/concentration' });
  const dry = M.caps[2026] - M.committed[2026];
  if (S.assume.reserve != null && dry < S.assume.reserve) out.push({ lvl: 'crit', code: 'DRY POWDER BELOW RESERVE', txt: `${fmtM(dry)} available vs ${fmtM(S.assume.reserve)} reserve`, go: '#/drypowder' });
  if (S.assume.roomShare != null) {
    for (const T of TICKERS) { if (T.composite) continue; const r = c.byPos[T.g]; if ((r.total / c.tot) * 100 > S.assume.roomShare) out.push({ lvl: 'warn', code: T.t + ' ALLOCATION ' + pctf(r.total / c.tot), txt: `above ${S.assume.roomShare}% room threshold`, go: '#/pos/' + T.t }); }
  }
  if (M.imported) out.push({ lvl: 'dq', code: 'DATA · FY26-27 = IMPORTED BOOK', txt: `${M.imported.file} replaces the loaded 26-27 book for this session`, go: '#/recon' });
  // forward-looking alerts from the Drive plan (dated)
  const DR = M.data.drive;
  if (DR) {
    const nx = DR.calendar.events.filter((e) => e[0] > AS_OF).slice(0, 1)[0];
    if (nx) out.push({ lvl: 'info', code: 'NEXT · ' + nx[1].toUpperCase().slice(0, 40), txt: `${nx[0]} · T-${daysTo(nx[0])} days`, go: '#/calendar' });
    const u = DR.utilization;
    out.push({ lvl: 'warn', code: 'FY27-28 SPOKEN FOR ' + pctf((u.executed + u.proposed) / u.alloc), txt: `signed ${fmtM(u.executed)} + proposed class ${fmtM(u.proposed)} vs ${fmtM(u.alloc)} planning allocation (not approved)`, go: '#/plan2728' });
    out.push({ lvl: 'warn', code: 'DECEMBER DECISION SET ' + fmtM(DR.maturity.total[2]), txt: `${DR.maturity.shares.nRenew} renewal-eligible athletes mature Dec-26; ${DR.maturity.shares.nExhausted} exhaust eligibility (${fmtM(DR.maturity.total[3])})`, go: '#/december' });
  }
  return out;
}
