/* Roster Capital OS engine: every formula cell of the workbook as a pure function of the book.
   Sheet/cell references in comments point at the original workbook so each number can be traced. */
import type { OsBook, PortalRow, PositionRow, RosterRec, ScenarioRow } from './types';

export type Rag = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (typeof b === 'number' && isFinite(b) ? b : 0), 0);
const ACTION_CALLS = new Set(['Increase', 'Retain', 'Restructure', 'Replace']);
const CLOSED_DECISIONS = new Set(['Executed', 'Closed']);

/* ------------------------------------------------------------------ Roster Master AA–AG */
export interface RosterDerived {
  rec: RosterRec;
  highCapital: 'YES' | 'NO';                    // AA
  planningInventory: 'YES' | 'NO' | 'UNKNOWN';  // AB
  priority: 'P1' | 'P2' | 'P3';                 // AC
  readiness: 'READY' | 'INCOMPLETE' | 'ELIGIBILITY CERT NEEDED'; // AD
  currentPct: number;                           // AE — share of FY26-27 allocation
  forwardPct: number;                           // AF — share of projected FY27-28 allocation
  actionRequired: 'YES' | 'NO';                 // AG
  eligible2027: 'YES' | 'NO' | 'VERIFY';        // Retention Matrix E
  treatment: string;                            // Eligibility F
  overdue: boolean; daysToDecision: number | null;
}

export function deriveRecord(r: RosterRec, b: OsBook, projected: number): RosterDerived {
  const a = b.assume; const removed = r.status === 'REMOVED';
  const planningInventory = removed ? 'NO' : r.elig == null ? 'UNKNOWN' : r.elig >= 2 ? 'YES' : 'NO';
  const priority = r.call === 'Increase' || r.call === 'Retain' ? 'P1' : r.call === 'Restructure' || r.call === 'Replace' ? 'P2' : 'P3';
  const readiness = !r.cert ? 'ELIGIBILITY CERT NEEDED' : !r.pos || r.functionalRole === 'TBD' || r.depthRole === 'TBD' ? 'INCOMPLETE' : 'READY';
  const actionRequired = r.trigger || ACTION_CALLS.has(r.call) ? 'YES' : 'NO';
  const treatment = removed ? 'Removed / no retention' : r.elig == null ? 'Eligibility unknown — no authorization until verified.'
    : r.elig <= 1 ? 'Presumed 2026 final-year; build replacement case. Compliance re-certification required.'
      : `Known future inventory: ${r.elig - 1} season(s) remain after 2026, subject to compliance certification.`;
  const eligible2027 = removed ? 'NO' : r.elig == null ? 'VERIFY' : r.elig >= 2 ? 'YES' : 'NO';
  const daysToDecision = r.nextDate ? daysBetween(b.meta.asOf, r.nextDate) : null;
  const overdue = daysToDecision != null && daysToDecision < -a.agingDays && !CLOSED_DECISIONS.has(r.decision);
  return {
    rec: r, highCapital: r.caps2627 >= a.highCapitalFloor ? 'YES' : 'NO', planningInventory, priority, readiness,
    currentPct: b.inputs.allocation2627 ? r.caps2627 / b.inputs.allocation2627 : 0, forwardPct: projected ? r.caps2728 / projected : 0,
    actionRequired, eligible2027, treatment, overdue, daysToDecision,
  };
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 864e5);
}

/* ------------------------------------------------------------------ Position Inventory */
export type PosStatus = 'SURPLUS' | 'CRITICAL' | 'THIN' | 'STABLE';
export interface PositionDerived { row: PositionRow; net: number; status: PosStatus; baseNet: number; baseStatus: PosStatus; priority: string; drift: boolean }
const posStatus = (need: number, targets: number, net: number): PosStatus => (targets > need ? 'SURPLUS' : net >= 3 ? 'CRITICAL' : net > 0 ? 'THIN' : 'STABLE');
/** Executive Board M20:M31 */
export function positionPriority(group: string): string {
  if (group === 'Defensive Tackle' || group === 'Defensive End') return 'P0';
  if (group === 'Tight End') return 'P1';
  if (group === 'Wide Receiver' || group === 'Offensive Guard/Center' || group === 'Cornerback') return 'P2';
  return 'MONITOR';
}
export function derivePosition(row: PositionRow): PositionDerived {
  const net = Math.max(0, row.need - row.targets), baseNet = Math.max(0, row.baseNeed - row.baseTargets);
  return {
    row, net, status: posStatus(row.need, row.targets, net), baseNet, baseStatus: posStatus(row.baseNeed, row.baseTargets, baseNet), priority: positionPriority(row.group),
    drift: row.current !== row.baseCurrent || row.need !== row.baseNeed || row.targets !== row.baseTargets || row.capital !== row.baseCapital,
  };
}

/* ------------------------------------------------------------------ Portal Board */
export interface PortalDerived { row: PortalRow; lowReserve: number | null; highReserve: number | null }
export const portalReserve = (r: PortalRow) => ({
  row: r, lowReserve: r.pos && r.bodies != null ? r.bodies * (r.low ?? 0) : null, highReserve: r.pos && r.bodies != null ? r.bodies * (r.high ?? 0) : null,
});

/* ------------------------------------------------------------------ the full computation */
export interface ScorecardRow { category: string; metric: string; owner: string; value: number | null; fmt: 'money' | 'count'; guardrail: string; type: string; status: Rag; decision: string; source: string; cadence: string; definition: string; go: string }
export interface Exception { lvl: Rag; code: string; text: string; go: string; owner: string }

export function computeOs(b: OsBook) {
  const I = b.inputs, a = b.assume;
  /* 2027 Forecast B6:B15 */
  const projected = I.allocation2627 * (1 + a.growth);
  const roster = b.roster.filter((r) => r.athlete.trim() !== '');
  const existing2728 = sum(roster.map((r) => r.caps2728));
  const capsTotal = sum(roster.map((r) => r.caps2627));
  const gross = projected - existing2728 - I.classObligation2728;
  const room70 = projected * a.utilFloor - existing2728 - I.classObligation2728;
  const room72 = projected * a.utilCeiling - existing2728 - I.classObligation2728;
  const ledgerResidual = I.allocation2627 - capsTotal - I.separateBuyout;

  const recs = roster.map((r) => deriveRecord(r, b, projected));
  /* Executive Board / CEO Dashboard counts */
  const records = roster.length;
  const numericElig = roster.filter((r) => r.elig != null).length;
  const counts = {
    records,
    inv2plus: roster.filter((r) => r.elig != null && r.elig >= 2 && r.status !== 'REMOVED').length,
    inv1: roster.filter((r) => r.elig === 1).length,
    blankElig: records - numericElig,
    certYes: roster.filter((r) => r.cert === 'Yes').length,
    certNo: roster.filter((r) => r.cert === 'No').length,
    certPending: roster.filter((r) => r.cert === 'Pending').length,
    certUnpopulated: records - roster.filter((r) => r.cert === 'Yes' || r.cert === 'No' || r.cert === 'Pending').length,
    removed: roster.filter((r) => r.status === 'REMOVED').length,
    highCapital: recs.filter((d) => d.highCapital === 'YES').length,
    actionRequired: recs.filter((d) => d.actionRequired === 'YES').length,
    ready: recs.filter((d) => d.readiness === 'READY').length,
    overdue: recs.filter((d) => d.overdue).length,
  };

  /* Position Inventory */
  const positions = b.positions.map(derivePosition);
  const netNeed = sum(positions.map((p) => p.net));
  const baseNetNeed = sum(positions.map((p) => p.baseNet));

  /* Portal Board B16:C19 */
  const portal = b.portal.map(portalReserve);
  const byNeed = (t: string) => portal.filter((p) => p.row.needType === t);
  const res = (ps: PortalDerived[]) => ({ low: sum(ps.map((p) => p.lowReserve)), high: sum(ps.map((p) => p.highReserve)), bodies: sum(ps.map((p) => p.row.bodies)) });
  const portalView = {
    structural: res(byNeed('STRUCTURAL DEFICIT')), replacement: res(byNeed('REPLACEMENT WATCH')),
    performance: res(byNeed('PERFORMANCE OPTION')), contingency: res(byNeed('CONTINGENCY ONLY')), all: res(portal),
  };
  const grossBoard = { low: portalView.structural.low + portalView.replacement.low, high: portalView.structural.high + portalView.replacement.high };

  /* Capital Books B6:B17 — reserves come from Assumptions B8:B11 */
  const reserves = [a.retentionReserve, a.replacementReserve, a.contingencyReserve, a.opportunityReserve];
  const reservesSet = reserves.filter((x) => x != null && isFinite(x)).length;
  const trueOtb = reservesSet < 4 ? null : gross - sum(reserves) - portalView.structural.low;

  /* Scenario Forecast G5:H8 */
  const scenarios = b.scenarios.map((s: ScenarioRow) => ({ s, room: projected * s.utilization - existing2728 - s.classObligation, held: projected * (1 - s.utilization) }));

  /* Decision mix */
  const group = <K extends string>(key: (d: RosterDerived) => K) => {
    const m = new Map<K, { n: number; caps: number; fwd: number }>();
    for (const d of recs) { const k = key(d); const g = m.get(k) || { n: 0, caps: 0, fwd: 0 }; g.n++; g.caps += d.rec.caps2627; g.fwd += d.rec.caps2728; m.set(k, g); }
    return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((x, y) => y.caps - x.caps);
  };
  const mix = { call: group((d) => d.rec.call || '—'), bsmClass: group((d) => d.rec.bsmClass || '—'), state: group((d) => d.rec.rosterState || '—'),
    decision: group((d) => d.rec.decision || '—'), pos: group((d) => d.rec.pos || '—'), readiness: group((d) => d.readiness) };
  const classDiff = I.priorBoardTotal - I.classObligation2728;
  const openTriggers = b.triggers.filter((t) => t.status !== 'Closed');

  /* CEO Scorecard D6:D17 with live status (the workbook painted these by hand) */
  const pos = (v: number | null, okIfNull: Rag = 'GRAY'): Rag => (v == null ? okIfNull : v > 0 ? 'GREEN' : 'RED');
  const scorecard: ScorecardRow[] = [
    { category: 'CAPITAL', metric: 'FY26-27 Forecast Available', owner: 'Buy-Side', value: I.forecastAvailable2627, fmt: 'money', guardrail: '> $0', type: 'Verified forecast', status: pos(I.forecastAvailable2627), decision: 'Protect remaining flexibility.', source: 'Roster Capital Strategy', cadence: 'Weekly', definition: 'Source-reported available/uncommitted capacity.', go: 'osassume' },
    { category: 'CAPITAL', metric: 'Projected FY27-28 Allocation', owner: 'Finance / Buy-Side', value: projected, fmt: 'money', guardrail: 'Not approved', type: 'Planning', status: 'YELLOW', decision: 'Use for planning only.', source: '2027 Forecast', cadence: 'Monthly', definition: `${pct(a.growth)} growth assumption from current allocation.`, go: 'oscapital' },
    { category: 'CAPITAL', metric: 'Existing FY27-28 CAPS', owner: 'Buy-Side', value: existing2728, fmt: 'money', guardrail: 'Informational', type: 'Verified ledger', status: 'GREEN', decision: 'Know existing forward burden.', source: 'Roster Master', cadence: 'Weekly', definition: 'Exact sum of current FY27-28 CAPS ledger.', go: 'osroster' },
    { category: 'CAPITAL', metric: 'Proposed FY27-28 Class', owner: 'Recruiting / Buy-Side', value: I.classObligation2728, fmt: 'money', guardrail: 'Unsigned', type: 'Proposed', status: 'YELLOW', decision: 'Do not classify as committed.', source: 'Roster Capital Outlook', cadence: 'On change', definition: 'Aggregate class planning obligation.', go: 'osclass' },
    { category: 'CAPITAL', metric: `Room to ${pct(a.utilFloor)}`, owner: 'Buy-Side', value: room70, fmt: 'money', guardrail: '> $0', type: 'Calculated', status: pos(room70), decision: 'Primary planned retention + acquisition capacity.', source: '2027 Forecast', cadence: 'Weekly', definition: 'Room before the utilization floor.', go: 'oscapital' },
    { category: 'CAPITAL', metric: `Room to ${pct(a.utilCeiling)}`, owner: 'Buy-Side', value: room72, fmt: 'money', guardrail: '> $0', type: 'Calculated', status: pos(room72), decision: 'Upper planned range before exception.', source: '2027 Forecast', cadence: 'Weekly', definition: 'Room before the utilization ceiling.', go: 'oscapital' },
    { category: 'ROSTER', metric: '2+ Season Planning Inventory', owner: 'Compliance / Personnel', value: counts.inv2plus, fmt: 'count', guardrail: 'Planning only', type: 'Internal count', status: 'YELLOW', decision: 'Certify eligibility before authorization.', source: 'Roster Master', cadence: 'Weekly', definition: 'Non-removed rows showing 2+ seasons; not certified.', go: 'osroster/inv2' },
    { category: 'ROSTER', metric: '1-Season Inventory', owner: 'Personnel', value: counts.inv1, fmt: 'count', guardrail: 'Replacement planning', type: 'Internal count', status: 'YELLOW', decision: 'Convert expiring production into replacement plan.', source: 'Roster Master', cadence: 'Weekly', definition: 'Rows showing exactly one season remaining.', go: 'osroster/inv1' },
    { category: 'ROSTER', metric: 'Blank Eligibility Records', owner: 'Compliance', value: counts.blankElig, fmt: 'count', guardrail: '0', type: 'Data quality', status: counts.blankElig === 0 ? 'GREEN' : 'RED', decision: 'Resolve internal eligibility blanks before forward authorization.', source: 'Roster Master', cadence: 'Weekly', definition: 'Count = roster records minus numeric eligibility values.', go: 'osroster/blank' },
    { category: 'ACQUISITION', metric: 'Appendix A Net Remaining Need', owner: 'Player Personnel', value: netNeed, fmt: 'count', guardrail: 'Source baseline', type: 'Live inventory', status: netNeed > 0 ? 'YELLOW' : 'GREEN', decision: 'Maintain as personnel updates.', source: 'Position Inventory', cadence: 'Weekly', definition: 'Net need across all position groups (live columns).', go: 'ospositions' },
    { category: 'ACQUISITION', metric: 'Base Portal Priority Bodies', owner: 'Player Personnel', value: I.basePortalBodies, fmt: 'count', guardrail: I.basePortalMix, type: 'Planning priority', status: 'YELLOW', decision: 'Pre-clear sourcing and capital.', source: 'Roster Capital Strategy Base Case', cadence: 'Weekly', definition: 'Base-case priority acquisition requirement.', go: 'osportal' },
    { category: 'RISK', metric: 'True Open-to-Buy', owner: 'Decision Room', value: trueOtb, fmt: 'money', guardrail: 'Reserve inputs required', type: trueOtb == null ? 'Withheld' : 'Calculated', status: trueOtb == null ? 'YELLOW' : trueOtb > 0 ? 'GREEN' : 'RED', decision: 'Set reserves before using True OTB.', source: 'Capital Books', cadence: 'Monthly', definition: 'Blank until all four protected reserve inputs are entered.', go: 'oscapital' },
  ];

  /* Exceptions queue: red → yellow, each with an owner and a place to act */
  const ex: Exception[] = [];
  if (counts.blankElig) ex.push({ lvl: 'RED', code: 'BLANK ELIGIBILITY', text: `${counts.blankElig} record(s) have no internal eligibility value — resolve before forward authorization.`, go: 'osroster/blank', owner: 'Compliance' });
  if (room70 <= 0) ex.push({ lvl: 'RED', code: 'NO ROOM TO FLOOR', text: `Existing CAPS + proposed class exceed the ${pct(a.utilFloor)} line by ${money(-room70)}.`, go: 'oscapital', owner: 'Buy-Side' });
  if (trueOtb != null && trueOtb <= 0) ex.push({ lvl: 'RED', code: 'NEGATIVE OTB', text: `True Open-to-Buy is ${money(trueOtb)} after reserves and the structural portal low case.`, go: 'oscapital', owner: 'Decision Room' });
  for (const p of positions.filter((p) => p.status === 'CRITICAL')) ex.push({ lvl: 'RED', code: 'CRITICAL ROOM', text: `${p.row.group}: net need ${p.net} after ${p.row.targets} target(s).`, go: 'ospositions', owner: 'Player Personnel' });
  if (counts.overdue) ex.push({ lvl: 'RED', code: 'DECISION AGING', text: `${counts.overdue} decision(s) are more than ${a.agingDays} days past their decision date.`, go: 'osdecisions/overdue', owner: 'Buy-Side' });
  if (openTriggers.length) ex.push({ lvl: 'YELLOW', code: 'OPEN TRIGGERS', text: `${openTriggers.length} trigger event(s) still need a re-underwrite.`, go: 'ostriggers', owner: 'Assigned owner' });
  if (trueOtb == null) ex.push({ lvl: 'YELLOW', code: 'OTB WITHHELD', text: `${4 - reservesSet} of 4 protected reserves not entered — True OTB stays withheld.`, go: 'osassume', owner: 'Decision Room' });
  if (counts.certUnpopulated) ex.push({ lvl: 'YELLOW', code: 'CERT UNPOPULATED', text: `${counts.certUnpopulated} record(s) have no 2027 compliance certification entry (workflow, not a determination).`, go: 'osroster/cert', owner: 'Compliance' });
  const hcOpen = recs.filter((d) => d.highCapital === 'YES' && d.rec.decision === 'Observing' && d.actionRequired === 'YES').length;
  if (hcOpen) ex.push({ lvl: 'YELLOW', code: 'HIGH CAPITAL REVIEW', text: `${hcOpen} athlete(s) at or above ${money(a.highCapitalFloor)} need an action and are still Observing.`, go: 'osdecisions/hc', owner: 'Buy-Side' });
  if (classDiff) ex.push({ lvl: 'YELLOW', code: 'CLASS RECONCILIATION', text: `Prior target board differs from the class forecast by ${money(classDiff)}; do not allocate by athlete.`, go: 'osclass', owner: 'Buy-Side' });
  for (const p of positions.filter((p) => p.status === 'THIN')) ex.push({ lvl: 'YELLOW', code: 'THIN ROOM', text: `${p.row.group}: net need ${p.net}.`, go: 'ospositions', owner: 'Player Personnel' });
  const incomplete = recs.filter((d) => d.readiness === 'INCOMPLETE').length;
  if (incomplete) ex.push({ lvl: 'GRAY', code: 'ROLES TBD', text: `${incomplete} certified record(s) still have a TBD functional or depth role.`, go: 'osroster/incomplete', owner: 'Coaching Staff' });

  return {
    projected, existing2728, capsTotal, gross, room70, room72, ledgerResidual, recs, counts, positions, netNeed, baseNetNeed,
    portal, portalView, grossBoard, reserves, reservesSet, trueOtb, scenarios, mix, classDiff, openTriggers, scorecard, exceptions: ex,
    utilization: { existing: projected ? existing2728 / projected : 0, committed: projected ? (existing2728 + I.classObligation2728) / projected : 0 },
  };
}
export type OsModel = ReturnType<typeof computeOs>;

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d === 0 && Math.round(v * 1000) % 10 ? 1 : d)}%`;
export function money(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const s = v < 0 ? '−' : ''; const x = Math.abs(v);
  return s + (x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}K` : `$${x.toFixed(0)}`);
}
