/* Deterministic synthetic operating book. Fictional athletes and rounded program figures with the
   same structure as the workbook, so every OS screen runs without real data. */
import { DEFAULT_GUIDE } from './guide';
import { EMPTY_UW, type OsBook, type RosterRec } from './types';

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const FIRST = ['Avery', 'Blake', 'Emery', 'Dante', 'Ellis', 'Finn', 'Grady', 'Hayden', 'Isaiah', 'Jalen', 'Kendall', 'Logan', 'Merritt', 'Nolan', 'Omari', 'Parker', 'Quinn', 'Reese', 'Sawyer', 'Tristan', 'Uriah', 'Vance', 'Wade', 'Xander', 'Yusuf', 'Zane'];
const LAST = ['Ashford', 'Bramble', 'Calloway', 'Dunmore', 'Everly', 'Fairbanks', 'Garrison', 'Holloway', 'Ingram', 'Jessup', 'Kimball', 'Lockhart', 'Merriweather', 'Northcutt', 'Oakley', 'Prescott', 'Quarles', 'Rutherford', 'Sterling', 'Thornbury', 'Underhill', 'Vickery', 'Whitlock', 'Yardley'];
const POS = ['DB', 'DB', 'OL', 'OL', 'WR', 'WR', 'LB', 'RB', 'DL', 'QB', 'DE', 'TE', 'SN', 'CB', ''];

export function sampleBook(): OsBook {
  const r = rng(2027); const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const roster: RosterRec[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 100; i++) {
    let name = ''; do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (used.has(name)); used.add(name);
    const status = i < 90 ? 'Current' : i < 94 ? 'Incomer - HS' : i < 97 ? 'Incomer - 4-4' : i < 99 ? 'Incomer - JUCO' : 'REMOVED';
    const elig = i % 23 === 7 ? null : status.startsWith('Incomer') ? 4 : pick([1, 1, 1, 2, 2, 3, 4]);
    const tier = r();
    const caps = tier > 0.93 ? Math.round((400 + r() * 500) * 1e3) : tier > 0.7 ? Math.round((120 + r() * 220) * 1e3) : tier > 0.35 ? Math.round((20 + r() * 80) * 1e3) : pick([100, 500, 2500, 7500]);
    const fwd = elig != null && elig >= 2 && r() > 0.82 ? Math.round(caps * (0.4 + r() * 0.5) / 1000) * 1000 : 0;
    const departing = elig === 1 || status === 'REMOVED';
    const call = departing ? 'Replace' : caps >= 300000 ? pick(['Retain', 'Increase', 'Restructure']) : caps >= 60000 ? pick(['Hold', 'Hold', 'Retain', 'Restructure']) : 'Scout';
    const bsmClass = departing ? 'Replacement / Emergency' : caps >= 400000 ? 'Core Investment' : caps >= 60000 ? 'Functional Investment' : 'Developmental / Optionality';
    roster.push({
      id: 'S' + String(i + 1).padStart(3, '0'), athlete: name, pos: pick(POS), status, elig, cert: '',
      rosterState: departing ? 'Departing' : fwd ? 'Contracted 2027' : i % 17 === 3 ? 'Current' : 'Expected 2027',
      functionalRole: 'TBD', depthRole: 'TBD', caps2627: caps, caps2728: fwd, acqBasis: caps, mark: caps, low2027: null, high2027: null,
      bsmClass, call, decision: 'Observing', confidence: pick(['High', 'High', 'Medium', 'Low']), agent: '', nextDate: '', trigger: '', replLow: null, replHigh: null,
      retentionRisk: caps >= 300000 ? 'High' : 'Medium', portalRisk: r() > 0.6 ? 'High' : 'Medium', notes: '', owner: '', updated: '',
      uw: { ...EMPTY_UW, priority: departing ? '2027 REPLACEMENT' : caps >= 300000 ? 'P1 RETAIN' : caps >= 60000 ? 'P3 HOLD' : 'P4 OPTIONALITY',
        callText: departing ? 'NO 2027 RETENTION — REPLACE' : caps >= 300000 ? 'INCREASE / RETAIN' : caps >= 60000 ? 'HOLD / RE-UNDERWRITE' : 'RETAIN LOW-COST / SCOUT',
        band: departing ? '$0 new 2027 retention' : caps >= 60000 ? 'At/near current value unless role changes' : 'Low-cost developmental',
        fixedShare: departing ? '0%' : '35–50%', conditionalShare: departing ? '0%' : '50–65%',
        evidence: 'Synthetic sample record.', rationale: 'Require internal role, snap, assignment and replacement-cost grade.' },
    });
  }
  const pos = (group: string, current: number, need: number, targets: number, capital: number, note: string) =>
    ({ group, baseCurrent: current, baseNeed: need, baseTargets: targets, baseCapital: capital, current, need, targets, capital, note, source: 'Sample baseline' });
  return {
    meta: { title: 'Synthetic sample operating book', source: 'sample', loaded: '', sample: true, asOf: '2026-10-05' },
    inputs: { allocation2627: 16_000_000, forecastAvailable2627: 400_000, forecastCommitted2627: 15_600_000, separateBuyout: 25_000, classObligation2728: 5_500_000,
      springClassEntry: 300_000, priorBoardTotal: 6_500_000, targetCount: 16, classStatus: 'UNSIGNED PLANNING', basePortalBodies: 6, basePortalMix: 'TE 1 / DE 2 / DT 3' },
    assume: { growth: 0.04, utilFloor: 0.7, utilCeiling: 0.72, retentionReserve: null, replacementReserve: null, contingencyReserve: null, opportunityReserve: null, criticalGap: 2, highCapitalFloor: 160_000, agingDays: 14 },
    roster,
    positions: [
      pos('Quarterback', 4, 0, 1, 1_250_000, 'Target sits above a stated need of zero; additional QB spend is succession/depth.'),
      pos('Running Back', 6, 0, 1, 50_000, 'Low-cost depth against no stated need.'),
      pos('Tight End', 4, 1, 0, 0, 'Real need with no target attached.'),
      pos('Wide Receiver', 11, 2, 1, 900_000, 'One of two stated needs addressed.'),
      pos('Offensive Guard/Center', 8, 2, 1, 50_000, 'One of two stated needs addressed efficiently.'),
      pos('Offensive Tackle', 8, 2, 3, 1_200_000, 'Three targets against need of two; confirm intentional overcoverage.'),
      pos('Cornerback', 12, 3, 2, 200_000, 'Two of three stated needs addressed.'),
      pos('Safety', 7, 1, 2, 600_000, 'Two targets against one stated need; confirm intentional overcoverage.'),
      pos('Inside Linebacker', 6, 0, 1, 450_000, 'Capital deployed against zero stated need; confirm upgrade/insurance thesis.'),
      pos('Defensive End', 9, 4, 2, 375_000, 'Two of four stated needs remain.'),
      pos('Defensive Tackle', 8, 4, 1, 100_000, 'Only CRITICAL room in baseline; three needs remain.'),
      pos('Specialist (P/K/KO)', 3, 0, 0, 0, 'No stated need; keep position data clean.'),
    ],
    portal: [
      ['P0', 'DT', 3, 'STRUCTURAL DEFICIT', 'Baseline still shows three DT bodies unfilled after the incoming board.', 'Functional / Core', 200_000, 500_000, 'Winter portal', 'Pre-clear capital before market opens.'],
      ['P0', 'DE / EDGE', 2, 'STRUCTURAL DEFICIT', 'Two DE bodies remain unfilled after the class forecast.', 'Functional / Core', 250_000, 600_000, 'Winter portal', 'Acquire at least one proven disruption profile.'],
      ['P1', 'TE', 1, 'STRUCTURAL DEFICIT', 'One TE body remains in the baseline projection.', 'Functional', 75_000, 200_000, 'Winter portal or late acquisition', 'Do not overpay unless the player solves a defined role.'],
      ['P1', 'DB', 1, 'REPLACEMENT WATCH', 'Veteran DB exposure may roll off; certify returning starters.', 'Core / Functional', 150_000, 400_000, 'Hold reserve; activate on certified departure', 'Replacement reserve, not an automatic acquisition.'],
      ['P1', 'OL', 2, 'REPLACEMENT WATCH', 'Multiple veteran OL show one internal eligibility season.', 'Core / Functional', 225_000, 550_000, 'Hold reserve; winter portal if departure confirmed', 'Portal only after returning OL inventory is set.'],
      ['P2', 'WR', 1, 'PERFORMANCE OPTION', 'If retention restructures open a role, add a proven separator.', 'Core / Functional', 175_000, 500_000, 'Winter portal', 'Acquire only if restructures create a real role.'],
      ['P2', 'QB', 1, 'CONTINGENCY ONLY', 'QB room outcome determines whether a portal QB is needed.', 'Core / Functional', 500_000, 1_200_000, 'Contingent on QB room decision', 'No QB portal allocation until the incumbent decision.'],
    ].map(([priority, p, bodies, needType, why, role, low, high, timing, rule], i) => ({ id: 'PB' + (i + 1), priority: String(priority), pos: String(p), bodies: Number(bodies), needType: String(needType), why: String(why), role: String(role), low: Number(low), high: Number(high), timing: String(timing), rule: String(rule) })),
    triggers: [],
    scenarios: [
      { name: '<6 wins', signal: 'Replacement / readiness', retention: 'Protect verified anchors; restructure underperformance.', portal: 'Use portal capital on structural deficits and true upgrades.', utilization: 0.7, classObligation: 5_500_000, risk: 'Over-correcting with volume.', call: 'Repair without abandoning young core.' },
      { name: '6 wins', signal: 'Targeted repair', retention: 'Retain productive multi-year starters.', portal: 'Fund structural deficits first.', utilization: 0.705, classObligation: 5_500_000, risk: 'Paying continuity premium without conversion.', call: 'Keep core; repair defined gaps.' },
      { name: '8 wins', signal: 'Renew and finish', retention: 'Move early on outperformers.', portal: 'Selective scarce upgrades.', utilization: 0.715, classObligation: 5_500_000, risk: 'Market pressure on own roster.', call: 'Renew before leverage spikes.' },
      { name: '10 wins', signal: 'Protect continuity', retention: 'Highest retention priority.', portal: 'Portal opportunistic unless hard losses.', utilization: 0.72, classObligation: 5_500_000, risk: 'Success creates forward concentration.', call: 'Protect what proved it can win.' },
    ],
    classWindows: [
      { window: 'Jan–Jun 2027', amount: 300_000, fy: 'FY2026-27', type: 'Rounded planning', use: 'Spring entry', note: 'Approximate 5% entry amount across the class.' },
      { window: 'Jul–Dec 2027', amount: 3_400_000, fy: 'FY2027-28', type: 'Rounded planning', use: 'Fall window', note: 'Approximate 60% portion.' },
      { window: 'Jan–Jun 2028', amount: 2_100_000, fy: 'FY2027-28', type: 'Rounded planning', use: 'Continuing liability', note: 'Approximate 35% portion.' },
    ],
    classTargets: Array.from({ length: 16 }, (_, i) => ({ id: 'CT' + (i + 1), athlete: `Class Target ${String.fromCharCode(65 + i)}`, pos: ['OG/OC', 'OT', 'QB', 'RB', 'DE', 'CB', 'SAF', 'WR', 'DT', 'ILB'][i % 10],
      prior: [50_000, 500_000, 1_250_000, 50_000, 200_000, 100_000, 450_000, 900_000, 100_000, 450_000][i % 10], board: i % 3 ? 'GREEN' : 'ORANGE', rationale: i % 3 ? 'Closes stated need' : 'Position already covered', control: 'RECONCILE AGAINST CURRENT CLASS FORECAST' })),
    method: [
      ['Portfolio before player', 'Underwrite total roster → position group → role → athlete → valuation → structure → Open-to-Buy → authority.'],
      ['Price is not value', 'Current contract/CAPS is a historical acquisition fact, not the 2027 valuation.'],
      ['Football grade ≠ capital class', 'An elite grade can still be a Functional investment if the room is deep; scarcity and replacement cost drive Anchor status.'],
      ['Structure down', 'Reduce fixed exposure while maintaining upside through availability, utilization, retention and performance conditions.'],
      ['Structure up', 'A higher headline is supportable only where term, options, staged payments or conditions reduce current economic risk.'],
      ['Eligibility treatment', 'Internal eligibility inventory controls this book; individual compliance certification is required.'],
      ['Evidence standard', 'Public stats establish production signals; internal film/snap data is required before final authorization.'],
    ],
    sources: [['Sample data', 'Synthetic — load the workbook to replace it']],
    guide: DEFAULT_GUIDE,
  };
}
