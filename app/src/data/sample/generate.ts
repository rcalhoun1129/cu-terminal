/* Deterministic SYNTHETIC dataset with the same shape as the restricted CU dataset.
   Fictional athletes and amounts — safe for the public repo, demos and tests. */
import type { CuData, Episode, Player, PlayerSeason, RosterEntry, SeasonKey } from '../types';

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const FIRST = ['Avery', 'Blake', 'Corin', 'Briar', 'Ellis', 'Finley', 'Gray', 'Harper', 'Indy', 'Juniper', 'Kai', 'Logan', 'Marlo', 'Noel', 'Oakley', 'Parker', 'Quinn', 'Reese', 'Sage', 'Tarin', 'Umber', 'Vale', 'Wren', 'Xan', 'Yael', 'Zion', 'Rowan', 'Emery', 'Lennox', 'Shay'];
const LAST = ['Ashford', 'Brightwater', 'Calder', 'Dunmore', 'Eastbrook', 'Fairhaven', 'Glenwood', 'Hollis', 'Ironside', 'Juniper', 'Kingsley', 'Lockhart', 'Marlowe', 'Northcott', 'Oakridge', 'Pemberton', 'Quarry', 'Redfield', 'Stonebridge', 'Thornton', 'Underhill', 'Vance', 'Westfall', 'Yardley', 'Zellner', 'Ashdown', 'Birchwood', 'Coldwell', 'Driftwood', 'Elmhurst'];
const POS: [string, string, number, number][] = [ // official pos, group, roster weight, price scale
  ['QB', 'QB', 4, 900000], ['RB', 'RB', 8, 90000], ['WR', 'WR', 14, 220000], ['TE', 'TE', 7, 80000], ['OL', 'OL', 16, 260000], ['DL', 'DL', 9, 280000],
  ['DE', 'EDGE', 8, 300000], ['LB', 'LB', 9, 160000], ['CB', 'CB', 8, 170000], ['S', 'S', 7, 140000], ['DB', 'DB', 6, 150000], ['PK', 'PK', 2, 20000], ['P', 'P', 2, 25000], ['SN', 'SN', 3, 5000]];
const SCHOOLS = ['State University', 'Coastal Tech', 'Mountain A&M', 'River Valley', 'Plains State', 'Lakeshore', 'Desert Poly', 'Northern CC'];
const r2 = (v: number) => Math.round(v * 100) / 100;
const months = (from: string, n: number): string[] => { const out: string[] = []; let [y, m] = from.split('-').map(Number); for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const spread = (total: number, ks: string[]) => { const per = r2(total / ks.length); const o: Record<string, number> = {}; ks.forEach((k, i) => { o[k] = i === ks.length - 1 ? r2(total - per * (ks.length - 1)) : per; }); return o; };

export function generateSample(seed = 7): CuData {
  const R = rng(seed); const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const posPick = () => { const tot = POS.reduce((a, p) => a + p[2], 0); let x = R() * tot; for (const p of POS) { x -= p[2]; if (x <= 0) return p; } return POS[0]; };
  const players: Player[] = []; const used = new Set<string>();
  const empty = (): PlayerSeason => ({ onRoster: false, pos: null, bs: null, cls: null, school: null, acq: 'UNKNOWN' });
  for (let i = 0; i < 150; i++) {
    let name = ''; do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (used.has(name)); used.add(name);
    const [pos, bs] = posPick();
    const start = R() < 0.4 ? 2024 : R() < 0.6 ? 2025 : 2026; const stay = 1 + Math.floor(R() * 3);
    const seasons = { '2024': empty(), '2025': empty(), '2026': empty() } as Record<SeasonKey, PlayerSeason>;
    const channel = R() < 0.45 ? 'PORTAL' : R() < 0.85 ? 'HS' : 'JUCO';
    for (let s = start; s < start + stay && s <= 2026; s++) {
      seasons[String(s) as SeasonKey] = { onRoster: true, pos, bs, cls: ['Fr.', 'So.', 'Jr.', 'Sr.'][s - start] || 'Gr.', school: channel === 'HS' ? '' : pick(SCHOOLS), acq: s === start ? channel : 'RETAINED' };
    }
    for (const s of ['2024', '2025', '2026'] as SeasonKey[]) if (!seasons[s].onRoster && +s > start) seasons[s].acq = 'RETAINED';
    const id = name; const tk = (name.split(' ')[0][0] + name.split(' ')[1].slice(0, 3)).toUpperCase() + '.' + bs;
    players.push({ id, name, legal: [name], aliases: [], seasons, fallbackPos: null, fallbackBs: null, lastPos: pos, ticker: tk, rslaStatus: seasons['2026'].onRoster ? 'Current' : 'REMOVED',
      elig: `${1 + Math.floor(R() * 4)}-${1 + Math.floor(R() * 3)}`, identity: 'VERIFIED', offRosterNote: '',
      book: seasons['2026'].onRoster ? { status: 'Current', eligRem: String(1 + Math.floor(R() * 4)), history: 'synthetic' } : null });
  }
  const scale = (p: Player) => (POS.find((x) => x[0] === p.lastPos) || POS[0])[3];
  const episodes: Episode[] = []; let n = 0; const eid = () => 'E' + String(++n).padStart(4, '0');
  const SYN = 'SYNTHETIC sample ›';
  for (const p of players) {
    const base = scale(p) * (0.25 + R() * 1.6);
    if (p.seasons['2024'].onRoster && R() < 0.8) {
      const ks = months('2024-06', 4 + Math.floor(R() * 8)), cap = r2(base * 0.6);
      episodes.push({ id: eid(), pid: p.id, regime: 'COLLECTIVE', season: 2024, kind: 'COLLECTIVE_2024', src: `${SYN} collective › ${p.id}`, srcRaw: p.id, face: r2(cap * 1.3), term: ks.length, filePos: p.lastPos!, months: spread(cap, ks), capital: cap, capsBy: { COLL24: cap }, status: 'SCHEDULED', signed: null, note: 'FALL', conf: 'RECONCILED' });
      if (R() < 0.3) { const k2 = months('2025-01', 6), c2 = r2(base * 0.15); episodes.push({ id: eid(), pid: p.id, regime: 'COLLECTIVE', season: 2025, kind: 'COLLECTIVE_SP25', src: `${SYN} future state › ${p.id}`, face: null, term: 6, months: spread(c2, k2), capital: c2, capsBy: { SP25: c2 }, status: R() < 0.5 ? 'Amendment to add June' : 'New contract for spring', signed: '2025-02-01', note: '', conf: 'RECONCILED' }); }
    }
    if ((p.seasons['2025'].onRoster || (p.seasons['2026'].onRoster && R() < 0.15)) && R() < 0.85) {
      const nominal = R() < 0.18; const cap = nominal ? 1980 : r2(base * 0.8); const ks = nominal ? ['2025-10', '2026-02'] : months('2025-07', R() < 0.7 ? 6 : 12);
      episodes.push({ id: eid(), pid: p.id, regime: 'INSTITUTIONAL', season: 2025, kind: 'RSLA', amend: 0, src: `${SYN} RSLA 25-26 › ${p.id}`, srcRaw: p.id, face: cap, faceRaw: null, term: nominal ? null : ks.length, termRaw: nominal ? 'BASE - 10 (NS)' : String(ks.length), months: spread(cap, ks), incentives: 0, capital: cap,
        capsBy: { 'FY25-26': cap, 'FY26-27(RSLA)': 0, 'FY27-28(RSLA)': 0 }, status: R() < 0.1 ? 'Terminated 01/05/2026' : R() < 0.5 ? 'Expired 12/31/2025' : 'Current', rowStatus: 'Current', signed: '2025-07-0' + (1 + Math.floor(R() * 8)), sent: '2025-06-30', created: null, note: '', conf: 'VERIFIED' });
      if (!nominal && R() < 0.2) { const ka = months('2026-01', 6), ca = r2(base * 0.3); episodes.push({ id: eid(), pid: p.id, regime: 'INSTITUTIONAL', season: 2025, kind: 'RSLA', amend: 1, src: `${SYN} RSLA 25-26 amendment › ${p.id}`, srcRaw: '(amendment row)', face: ca, term: 6, months: spread(ca, ka), incentives: 0, capital: ca, capsBy: { 'FY25-26': ca, 'FY26-27(RSLA)': 0, 'FY27-28(RSLA)': 0 }, status: '', rowStatus: '', signed: '2026-01-15', note: '', conf: 'VERIFIED' }); }
    }
    if (p.seasons['2026'].onRoster) {
      const nominal = R() < 0.15; const total = nominal ? 1980 : r2(base); const longT = !nominal && R() < 0.25;
      const fall = months('2026-07', 6); const spr = longT ? months('2027-01', 6) : []; const ks = nominal ? ['2026-10', '2027-02'] : [...fall, ...spr];
      const f2728 = !nominal && R() < 0.08 ? r2(base * 0.5) : 0; const sched = spread(total, ks); if (f2728) sched['2027-07'] = f2728;
      const F26 = Object.entries(sched).filter(([k]) => k <= '2026-12').reduce((a, [, v]) => a + v, 0), S27 = Object.entries(sched).filter(([k]) => k >= '2027-01' && k <= '2027-06').reduce((a, [, v]) => a + v, 0);
      episodes.push({ id: eid(), pid: p.id, regime: 'INSTITUTIONAL', season: 2026, kind: 'FCST26', book: true, src: `${SYN} 26-27 book › ${p.id}`, srcRaw: p.id, face: r2(total + f2728), faceRaw: null, term: nominal ? 10 : ks.length, termRaw: String(ks.length), months: sched, incentives: 0, capital: total,
        capsBy: { 'FY26-27': total, F26: r2(F26), S27: r2(S27), 'FY27-28': f2728, 'FY27-28 scheduled': f2728 }, status: 'Current', eligRem: p.book!.eligRem, history: 'synthetic', rslaVersion: 'Sp26', rslaMods: '', signed: null, note: '', conf: 'VERIFIED' });
      if (R() < 0.6) { const s = r2(total * (0.85 + R() * 0.3)); episodes.push({ id: eid(), pid: p.id, regime: 'INSTITUTIONAL', season: 2026, kind: 'SNAP26', snapBuyout: false, src: `${SYN} Sp26 forecasting › ${p.id}`, srcRaw: p.id, face: s, term: 12, months: {}, snapMonths: spread(s, fall), incentives: 0, capital: 0, snap: { 'FY26-27': s, F26: s, S27: 0, 'FY27-28': 0, SP26: r2(s * 0.08) }, capsBy: {}, status: 'Continuing', signed: null, note: 'Spring-26 forecast snapshot — historical', conf: 'FORECAST' }); }
    }
  }
  const bp = players.find((p) => p.seasons['2026'].onRoster)!;
  episodes.push({ id: eid(), pid: bp.id, regime: 'INSTITUTIONAL', season: 2025, kind: 'BUYOUT', src: `${SYN} buyout FY25-26`, srcRaw: 'buyout', face: null, term: null, months: { '2026-01': 25000 }, capital: 25000, capsBy: { 'FY25-26': 25000 }, status: 'BUYOUT', signed: null, note: 'Synthetic buyout installment 1', conf: 'RECONCILED' });
  episodes.push({ id: eid(), pid: bp.id, regime: 'INSTITUTIONAL', season: 2026, kind: 'BUYOUT', src: `${SYN} buyout FY26-27`, srcRaw: 'buyout', face: null, term: null, months: { '2026-07': 25000 }, capital: 25000, capsBy: { 'FY26-27': 25000 }, status: 'BUYOUT', signed: '2026-07-16', note: 'Synthetic buyout installment 2', conf: 'VERIFIED' });

  const sumK = (k: string, f: string) => r2(episodes.filter((e) => e.kind === k).reduce((a, e) => a + (+e.capsBy[f] || 0), 0));
  const fy26 = sumK('RSLA', 'FY25-26'), fy27 = sumK('FCST26', 'FY26-27'), fy28 = sumK('FCST26', 'FY27-28');
  const cap25 = Math.ceil((fy26 + 25000) * 1.002), cap26 = Math.ceil((fy27 + 25000) * 1.07);
  const fall25 = r2(Object.values(episodes.filter((e) => e.kind === 'RSLA')).reduce((a, e) => a + Object.entries(e.months).filter(([k]) => k <= '2025-12').reduce((b, [, v]) => b + v, 0), 0));
  const snapF = r2(episodes.filter((e) => e.kind === 'SNAP26').reduce((a, e) => a + (e.snap!['FY26-27'] || 0), 0));
  const rosters = Object.fromEntries((['2024', '2025', '2026'] as SeasonKey[]).map((s) => [s, players.filter((p) => p.seasons[s].onRoster).map((p): RosterEntry => ({ name: p.id, pos: p.seasons[s].pos!, cls: p.seasons[s].cls!, school: p.seasons[s].school! }))])) as Record<SeasonKey, RosterEntry[]>;
  const aliases = Object.fromEntries(players.map((p) => [p.id.toLowerCase(), p.id]));
  const src = (key: string) => ({ title: `Synthetic source ${key}`, url: 'https://example.com/' + key.toLowerCase(), key });
  const alloc = Math.round(cap26 * 1.04 * 100) / 100, executed = fy28, proposed = Math.round(alloc * 0.3);
  const fallBook = r2(episodes.filter((e) => e.kind === 'FCST26').reduce((a, e) => a + (e.capsBy.F26 || 0), 0));
  const tp = players.filter((p) => p.seasons['2026'].onRoster).slice(0, 6).map((p, i) => ({ pid: p.id, src: `${SYN} third-party › row ${i + 2}`, srcRaw: p.id, package: 300000 + i * 50000, cuBase: 200000, paradigma: 100000 + i * 50000, incentives: 0, conf: 'NEEDS REVIEW' }));
  const games = ['Coastal Tech', 'River Valley', 'Plains State', 'Mountain A&M', 'Lakeshore', 'Desert Poly', 'State University', 'Northern Union', 'Harbor City', 'Granite State', 'Prairie Tech', 'Summit College'].map((opp, i) => {
    const d = new Date(Date.UTC(2026, 8, 5 + i * 7)).toISOString().slice(0, 10); const done = d <= '2026-09-30'; const w = i % 2 === 0;
    return { g: i + 1, date: d, month: ['September', 'October', 'November'][Math.min(2, Math.floor(i / 4))], opp, site: i % 2 ? 'Away' : 'Home', conf: i < 3 ? 'Nonconference' : 'Conference', status: done ? 'Completed' : 'Scheduled',
      result: done ? (w ? 'W 24-17' : 'L 10-20') : null, cu: done ? (w ? 24 : 10) : null, op: done ? (w ? 17 : 20) : null, gamebook: done ? 'Yes' : 'No', participation: 'No', ...(done ? { mark: w ? 'THESIS STRENGTHENED' : 'THESIS WEAKENED', note: 'Synthetic game note.', markSrc: 'APX' } : {}) };
  });
  return {
    meta: { asOf: '2026-09-30', built: 'synthetic sample', synthetic: true, sources: [{ file: 'SYNTHETIC sample dataset', use: 'Demonstration data with the shape of the restricted CU dataset — fictional athletes and amounts', regime: 'SAMPLE' }], rosterUrls: {} },
    controls: { 'FY25-26 cap': cap25, 'FY26-27 cap': cap26, 'FY27-28 cap (estimate)': cap26, 'FY25-26 contractually committed (file AL191)': fy26, 'FY26-27 committed per 2025-26 tab (AM191)': 0,
      'Fall 2025 actual spend (hard-coded AQ190)': fall25, 'Fall 2025 spend (formula Q190 = SUM J3:Q186)': fall25, 'Sample buyout': 25000, 'Sp26 committed (forecast tab)': 0,
      'Fall 26 contractually committed (forecast tab)': snapF, 'Spring 27 contractually committed (forecast tab)': 0, 'FY27-28 committed (forecast tab)': fy28,
      '2024 collective 2024-contract total (Forecast Master H66)': r2(episodes.filter((e) => e.kind === 'COLLECTIVE_2024').reduce((a, e) => a + (e.face || 0), 0)),
      'FY26-27 contractually committed (current book)': fy27, 'Sample F26 buyout (current book)': 25000, 'FY26-27 remaining budget (current book)': r2(cap26 - fy27 - 25000),
      'FY27-28 contractually committed (current book)': fy28, 'FY27-28 remaining budget (current book)': r2(cap26 - fy28) },
    reference: { current2627Book: { label: 'Synthetic 26-27 book', caps: fy27, rows: rosters['2026'].length, buyout: 25000, cap: cap26, available: r2(cap26 - fy27 - 25000), caps2728: fy28, cap2728: cap26, available2728: r2(cap26 - fy28), conf: 'SYNTHETIC' } },
    drive: {
      sources: ['WA', 'MDW', 'APX', 'EGR', 'RCMS', 'INC', 'BUY', 'FRM', 'CAL', 'GRID'].map((k) => ({ key: k, title: `Synthetic source ${k}`, url: 'https://example.com/' + k.toLowerCase(), modified: '2026-09-30', use: k === 'GRID' ? 'Reference grid (catalogued)' : 'Synthetic program data' })),
      capacityClass: { class: 'B', range: '$15.0M–$19.9M', basis: 'synthetic cap', src: src('GRID'), classes: [['A', '≥ $20M'], ['B', '$15M–$19.9M'], ['C', '$10M–$14.9M'], ['D', '$5M–$9.9M'], ['E', '< $5M']] },
      tiers: [['A', 'Portfolio Anchor'], ['B', 'Core'], ['C', 'Functional'], ['D', 'Developmental / Optionality'], ['E', 'Replacement / Emergency'], ['PASS', 'Do not acquire']],
      grid: { label: 'ILLUSTRATIVE reference grid — synthetic', src: src('GRID'), cols: ['Anchor', 'Core', 'Functional', 'Developmental'],
        rows: [['QB', [1500000, 2000000], [900000, 1499000], [400000, 899000], [100000, 399000]], ['WR', [600000, 900000], [350000, 599000], [150000, 349000], [50000, 149000]], ['OL', [600000, 900000], [400000, 599000], [180000, 399000], [60000, 179000]],
          ['RB', [400000, 700000], [250000, 399000], [100000, 249000], [40000, 99000]], ['Edge', [800000, 1100000], [500000, 799000], [200000, 499000], [80000, 199000]], ['LB', [350000, 600000], [200000, 349000], [90000, 199000], [30000, 89000]], ['Specialists', [80000, 120000], [40000, 79000], [20000, 39000], null]],
        gridToBs: { QB: ['QB'], WR: ['WR'], OL: ['OL'], RB: ['RB'], Edge: ['EDGE'], LB: ['LB'], Specialists: ['PK', 'P', 'SN'] } },
      exposureTypes: ['Headline', 'Guaranteed', 'Expected', 'Max', 'Present-Year', 'Forward-Year', 'Rights-Adjusted'],
      shares: { label: 'Synthetic master', src: src('MDW'), rows: [['QB', 0.08, 0.04], ['RB', 0.03, 0.08], ['WR', 0.15, 0.14], ['TE', 0.03, 0.07], ['OL', 0.2, 0.15], ['DL', 0.15, 0.09], ['EDGE', 0.1, 0.08], ['LB', 0.08, 0.08], ['DB', 0.17, 0.2], ['Specialists', 0.01, 0.07]], lines: { roster: 0.4, capital: 0.53, def: 'OL + DL + EDGE + LB' } },
      big12: { label: 'Synthetic league reference — not a target', src: src('MDW'), rows: [['QB', 0.2], ['RB', 0.1], ['TE', 0.06], ['DB', 0.15]] },
      paid: { src: src('MDW') },
      master: { src: src('WA'), rows: [['Cap total', cap26, 'synthetic']] },
      maturity: { src: src('WA'), cols: ['Group', 'HC', 'Jul–Dec 26', 'Elig. remains', 'Elig. exhausted', 'Total maturing'], rows: [['OL', 12, 2000000, 1100000, 700000, 1800000], ['WR', 10, 1500000, 1200000, 100000, 1300000], ['DL', 8, 1600000, 900000, 500000, 1400000]],
        total: [30, r2(fallBook), r2(fallBook * 0.5), r2(fallBook * 0.3), r2(fallBook * 0.8)], shares: { maturing: 0.8, renew: 0.5, exhausted: 0.3, nRenew: 30, nExhausted: 18, nSpring: 20 },
        stress: [['Same economics', r2(fallBook * 0.5)], ['+15% premium', r2(fallBook * 0.575)], ['+25% premium', r2(fallBook * 0.625)]] },
      windows: { src: src('WA'), w1: [['Spring-window allocation', 2000000, 1], ['Existing spring obligations', 1000000, 0.5], ['Verified remaining capacity', 1000000, 0.5], ['Incoming-class spring installments (PROPOSED)', 200000, 0.1], ['Unallocated before holds', 800000, 0.4]],
        w23: [['Planning allocation (projection, not approved)', alloc, 1], ['Existing commitments Jul–Dec 2027', executed, executed / alloc], ['Incoming-class reconciled value (PROPOSED)', proposed, proposed / alloc], ['Remaining before renewals', alloc - executed - proposed, (alloc - executed - proposed) / alloc]] },
      utilization: { src: src('WA'), low: 0.7, high: 0.72, mid: 0.71, growth: 0.04, alloc, executed, proposed, variance2728: 500000, ceilLow: alloc * 0.7, ceilHigh: alloc * 0.72, allowLow: alloc * 0.7 - executed - proposed, allowHigh: alloc * 0.72 - executed - proposed,
        reserveLow: alloc * 0.28, reserveHigh: alloc * 0.3, cashJulDec27: proposed * 0.6, carryJanJun28: proposed * 0.35 },
      budget: { src: src('WA'), cols: ['4% projection', '$20M scenario', '$25M scenario'], label: 'Scenarios, not proposals; none approved', rows: [['Annual allocation', alloc, 20000000, 25000000], ['Signed obligations', executed, executed, executed], ['Signed + proposed, % of allocation', (executed + proposed) / alloc, (executed + proposed) / 2e7, (executed + proposed) / 2.5e7]] },
      scenarios: { src: src('WA'), label: 'Illustrative', rows: [['S0 — Recorded only', 0, executed + proposed, alloc - executed - proposed, (alloc - executed - proposed) / alloc], ['S1 — Retain all at same economics', fallBook * 0.5, executed + proposed + fallBook * 0.5, alloc - executed - proposed - fallBook * 0.5, (alloc - executed - proposed - fallBook * 0.5) / alloc]], premium: fallBook * 0.075 },
      stress: { src: src('WA'), rows: [['Plan at midpoint', 0, 0.71, 0.29, 1500000, 0], ['A — High-value renewal', 150000, 0.72, 0.28, 1650000, 800000], ['B — Both + variance', 900000, 0.76, 0.24, 2000000, 1500000]] },
      architecture: { src: src('WA'), ee: [0.05, 0.6, 0.35], transfer: [0.15, 0.6, 0.25], status: 'Proposed standard', recs: ['18-month freshman term', 'December as the valuation point', '70–72% utilization target'] },
      klass: { src: src('WA'), status: 'PROPOSED — synthetic', stated: 3000000, outline: 3500000, spring: 150000, placeholder: 3300000, variance: 500000, reconciled2728: 3000000, propJan27: 150000, propJulDec27: 1800000, propJanJun28: 1050000, above: 3, below: 2,
        rows: [['Ashford', 'Kai', 500000, 25000, 475000, 500000], ['Calder', 'Quinn', 1000000, 50000, 950000, 1500000], ['Hollis', 'Reese', 750000, 30000, 720000, 750000], ['Marlowe', 'Sage', 450000, 25000, 425000, 450000], ['Vance', 'Wren', 300000, 20000, 280000, 300000]] },
      liveOffer: { src: src('FRM'), status: 'DISCUSSION DRAFT — PROPOSED', name: 'Synthetic Prospect', cls: '2027 freshman', rs: 600000, bspNil: 100000, activation: 100000, max: 800000,
        months: Object.fromEntries(months('2027-01', 18).map((k, i) => [k, i < 6 ? 5000 : i < 12 ? 60000 : 35000])), note: 'Synthetic draft package — illustrative only.' },
      incentives: { src: src('INC'), pool: 1000000, floor: 150000, ceiling: 400000, expectedPct: [0.3, 0.32], expected: [300000, 320000], rows: players.filter((p) => p.seasons['2026'].onRoster).slice(0, 4).map((p, i) => [p.id, 100000 + i * 50000, '$' + (20 + i * 10) + 'K']), bookF26: 0, note: 'Synthetic incentive forecast.' },
      buyouts: { src: src('BUY'), term: 'Synthetic buyout term: 50% of remaining fee on transfer.', rows: [[bp.id, 'Paid to another school', 50000, 'Two $25,000 installments (synthetic)', 'PAID'], ['Synthetic athlete A', 'Demanded by counterparty', 100000, 'Demand on file', 'OPEN'], ['Synthetic athlete B', 'Owed to another school', 200000, 'Deal blocked', 'BLOCKED'], ['Synthetic athlete C', 'Clause removed', 40000, 'Clause removed', 'REMOVED']] },
      games: { src: src('RCMS'), resultSrc: src('APX'), schedule: games, method: 'Game capital rate = monthly roster spend ÷ games scheduled in that month.',
        egr: { src: src('EGR'), game: games[3].opp, travelCap: 1500000, rate: 375000, pct: 0.8, travelers: 70, rows: [['OL', 10, 2000000, 300000, 80000], ['WR', null, 1200000, null, 50000], ['DL', null, 1500000, null, 60000]], total: 4700000 }, rcmsSept: 2000000,
        marks: ['THESIS STRENGTHENED', 'POSITIVE MARK', 'THESIS INTACT', 'CONTINUE UNDERWRITING', 'RISK WATCH', 'THESIS WEAKENED', 'REFORECAST REQUIRED', 'IMPAIRMENT WATCH', 'IMPAIRED', 'INSUFFICIENT EXPOSURE'] },
      rooms: { src: src('APX'), rows: [['OL', 'DEVELOP · REVIEW'], ['DL + EDGE', 'PROTECT'], ['WR', 'PROTECT · DEVELOP'], ['QB', 'COMPETE'], ['Secondary', 'COMPETE · DEVELOP']], reasons: ['Maturity replacement', 'Depth', 'Competition', 'Upgrade', 'Performance replacement'], reasonNote: 'Synthetic note.', traveled: 0.8 },
      seasonScen: { src: src('WA'), label: 'Planning scenarios only — not predictions', rows: [['< 6 wins', 'High', 'Targeted', 'Acquisition'], ['8 wins', 'Specific needs', 'Rising', 'Renewals']] },
      schedule2027: { src: src('APX'), text: 'Synthetic 2027 schedule: 3 non-conference + 9 conference = 12' },
      calendar: { src: src('CAL'), phases: [['OBSERVE', 'Aug–Oct'], ['ASSESS', 'Oct–Dec'], ['DECIDE', 'Jan–Jun'], ['RESET', 'Jul–Aug']], reserves: ['Retention reserve', 'Replacement reserve', 'Contingency reserve'],
        ccir: [['PIR', 'Priority intelligence requirements'], ['FFIR', 'Friendly force information requirements'], ['EEFI', 'Essential elements of friendly information']], readiness: ['GREEN', 'AMBER', 'RED'],
        events: [['2026-09-15', 'Season baseline', 'OBSERVE'], ['2026-10-05', 'Midseason portfolio snapshot', 'ASSESS'], ['2026-11-02', 'Contract maturity audit', 'ASSESS'], ['2026-11-16', 'Retention Board I', 'BOARD'], ['2026-12-10', 'Portal Buy Box', 'DECIDE'], ['2027-01-02', 'Portal window', 'EXTERNAL'], ['2027-06-30', 'Fiscal close — LOCK', 'RESET']] },
    },
    players, episodes, thirdParty: tp, aliases, rosters,
    dqNotes: [{ sev: 'ESTIMATED', area: 'Sample data', item: 'This is a synthetic dataset', detail: 'Fictional athletes and amounts. Load the restricted dataset locally (npm run extract) to see real figures.', slot: 1 }],
  };
}
