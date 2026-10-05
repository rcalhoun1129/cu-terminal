/* Workbook ⇄ operating book. Reads the Roster Capital CEO Dashboard workbook (label-driven, so
   inserted rows and columns are tolerated) and writes the live book back out as .xlsx.
   Parsing runs in the browser; nothing is uploaded. */
import { loadXLSX } from '../data/importBook';
import { computeOs, type OsModel } from './engine';
import { DEFAULT_GUIDE } from './guide';
import { sampleBook } from './sample';
import { EMPTY_UW, type ClassTarget, type ClassWindow, type OsBook, type PortalRow, type PositionRow, type RosterRec, type ScenarioRow, type TriggerRow } from './types';

export type Cell = string | number | boolean | null | undefined;
export interface SheetRows { name: string; rows: Cell[][] }

const norm = (x: Cell) => String(x ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const str = (x: Cell) => (x == null ? '' : String(x).trim());
export function num(x: Cell): number | null {
  if (x == null || x === '') return null; if (typeof x === 'number') return isFinite(x) ? x : null;
  const t = String(x).replace(/[$,\s]/g, ''); if (/^-?\d+(\.\d+)?%$/.test(t)) return +t.slice(0, -1) / 100;
  return /^-?\d+(\.\d+)?$/.test(t) ? +t : null;
}
/** Excel serial or text → ISO date (YYYY-MM-DD); '' if empty or unreadable. */
export function isoDate(x: Cell): string {
  if (x == null || x === '') return '';
  if (typeof x === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(x) * 864e5).toISOString().slice(0, 10);
  const s = String(x).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = Date.parse(s); return isNaN(d) ? s : new Date(d).toISOString().slice(0, 10);
}

const sheetOf = (sheets: SheetRows[], name: string) => sheets.find((s) => norm(s.name) === norm(name))?.rows;
function headerRow(rows: Cell[][] | undefined, ...need: string[]): { i: number; col: (label: string) => number } | null {
  if (!rows) return null;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = (rows[i] || []).map(norm);
    if (need.every((n) => r.includes(norm(n)))) return { i, col: (label: string) => r.indexOf(norm(label)) };
  }
  return null;
}
function labelValue(rows: Cell[][] | undefined, label: string | RegExp, col = 1, labelCol = 0): Cell {
  if (!rows) return null;
  const hit = rows.find((r) => (typeof label === 'string' ? norm(r?.[labelCol]) === norm(label) : label.test(str(r?.[labelCol]))));
  return hit ? hit[col] : null;
}
/** Value in the row under a KPI label (dashboard-style "LABEL / value" blocks). */
function under(rows: Cell[][] | undefined, label: string): Cell {
  if (!rows) return null;
  for (let i = 0; i < rows.length - 1; i++) { const j = (rows[i] || []).findIndex((c) => norm(c) === norm(label)); if (j >= 0) return rows[i + 1]?.[j]; }
  return null;
}
const blank = (r: Cell[] | undefined) => !r || r.every((c) => c == null || c === '');

/* ------------------------------------------------------------------ import */
const RM_LABELS: [keyof RosterRec, string, 'n' | 's' | 'd'][] = [
  ['athlete', 'Athlete', 's'], ['pos', 'Pos', 's'], ['status', 'Current Status', 's'], ['elig', 'Elig. Seasons (Internal)', 'n'], ['cert', 'Compliance Cert 2027', 's'],
  ['rosterState', 'Roster State', 's'], ['functionalRole', 'Functional Role', 's'], ['depthRole', 'Depth Role', 's'], ['caps2627', '2026-27 CAPS', 'n'], ['caps2728', '2027-28 Existing CAPS', 'n'],
  ['acqBasis', 'Acquisition Basis', 'n'], ['mark', 'Current Economic Mark', 'n'], ['low2027', '2027 Low', 'n'], ['high2027', '2027 High', 'n'], ['bsmClass', 'BSM Capital Class', 's'],
  ['call', 'Economic Call', 's'], ['decision', 'Decision Status', 's'], ['confidence', 'Confidence', 's'], ['agent', 'Agent / Counterparty', 's'], ['nextDate', 'Next Decision Date', 'd'],
  ['trigger', 'Trigger Flag', 's'], ['replLow', 'Replacement Low', 'n'], ['replHigh', 'Replacement High', 'n'], ['retentionRisk', 'Retention Risk', 's'], ['portalRisk', 'Portal Risk', 's'],
  ['notes', 'Notes', 's'], ['owner', 'Owner', 's'], ['updated', 'Last Updated', 'd'],
];
const RM_DERIVED = ['High Capital Review?', '2027 Planning Inventory?', 'Decision Priority', 'Record Readiness', 'Current-Year Capital %', 'Forward Capital %', 'Action Required?'];
const UW_LABELS: [keyof RosterRec['uw'], string][] = [['priority', 'Priority'], ['callText', 'Economic call'], ['band', '2027 target / value band'], ['fixedShare', 'Fixed / protected share'],
  ['conditionalShare', 'Conditional / earned share'], ['evidence', 'Verified / observed evidence'], ['rationale', 'Forensic rationale'], ['rosterSource', 'CU roster source'], ['statsSource', 'Big 12 stats source']];

export function parseWorkbook(fileName: string, sheets: SheetRows[], today = new Date().toISOString().slice(0, 10)): OsBook {
  const base = sampleBook();
  const rm = sheetOf(sheets, 'Roster Master'); const h = headerRow(rm, 'Athlete', '2026-27 CAPS');
  if (!rm || !h) throw new Error('No “Roster Master” sheet with “Athlete” and “2026-27 CAPS” headers was found.');
  const warnings: string[] = [];

  const rmat = sheetOf(sheets, 'Retention Matrix'); const hm = headerRow(rmat, 'Athlete', 'Economic call');
  const uwBy = new Map<string, RosterRec['uw']>();
  if (rmat && hm) for (const r of rmat.slice(hm.i + 1)) {
    const name = str(r[hm.col('Athlete')]); if (!name) continue;
    uwBy.set(name, Object.fromEntries(UW_LABELS.map(([k, l]) => [k, hm.col(l) >= 0 ? str(r[hm.col(l)]) : ''])) as unknown as RosterRec['uw']);
  }

  const roster: RosterRec[] = [];
  for (const r of rm.slice(h.i + 1)) {
    const name = str(r[h.col('Athlete')]); if (!name) continue;
    const rec = { id: 'R' + String(roster.length + 1).padStart(3, '0'), uw: uwBy.get(name) ?? { ...EMPTY_UW } } as RosterRec;
    for (const [k, l, t] of RM_LABELS) {
      const j = h.col(l); const v = j >= 0 ? r[j] : null;
      (rec as unknown as Record<string, unknown>)[k] = t === 'n' ? num(v) : t === 'd' ? isoDate(v) : str(v);
    }
    rec.caps2627 ??= 0; rec.caps2728 ??= 0;
    roster.push(rec);
  }

  const as = sheetOf(sheets, 'Assumptions');
  const aN = (label: string, dflt: number | null) => { const v = num(labelValue(as, label)); return v ?? dflt; };
  const fc = sheetOf(sheets, '2027 Forecast'); const md = sheetOf(sheets, 'Metric Definitions'); const ic = sheetOf(sheets, '2027 Incoming Class');
  const ceo = sheetOf(sheets, 'CEO Dashboard'); const sc = sheetOf(sheets, 'CEO Scorecard');
  const need = (v: number | null, what: string, d: number) => { if (v == null) { warnings.push(`${what} not found — sample value used`); return d; } return v; };
  const I = base.inputs;
  const inputs = {
    allocation2627: need(num(labelValue(fc, 'FY2026-27 Football Allocation')), 'FY26-27 allocation', I.allocation2627),
    forecastAvailable2627: need(num(labelValue(fc, 'FY2026-27 Forecast Available')) ?? num(under(ceo, 'FY26-27 FORECAST AVAILABLE')), 'FY26-27 forecast available', I.forecastAvailable2627),
    forecastCommitted2627: num(labelValue(md, 'FY2026-27 Forecast Committed', 4)) ?? 0,
    separateBuyout: num(labelValue(md, /buyout/i, 4)) ?? 0,
    classObligation2728: need(num(labelValue(fc, 'Proposed FY2027-28 Class Obligation')) ?? num(under(ic, 'FY27-28 CLASS FORECAST')), 'FY27-28 class obligation', I.classObligation2728),
    springClassEntry: num(labelValue(fc, 'Spring 2027 Class Entry')) ?? 0,
    priorBoardTotal: num(under(ic, 'PRIOR TARGET BOARD TOTAL')) ?? 0,
    targetCount: num(under(ic, 'TARGET COUNT')) ?? 0,
    classStatus: str(under(ic, 'CLASS STATUS')) || 'UNSIGNED PLANNING',
    basePortalBodies: num(under(ceo, 'BASE PORTAL BODIES')) ?? num(labelValue(sc, 'Base Portal Priority Bodies', 3, 1)) ?? 0,
    basePortalMix: str(labelValue(sc, 'Base Portal Priority Bodies', 4, 1)),
  };
  const B = base.assume;
  const assume = {
    growth: aN('FY2027-28 Growth Assumption', B.growth)!, utilFloor: aN('Target Utilization Floor', B.utilFloor)!, utilCeiling: aN('Target Utilization Ceiling', B.utilCeiling)!,
    retentionReserve: aN('Retention Reserve', null), replacementReserve: aN('Replacement Reserve', null), contingencyReserve: aN('Contingency Reserve', null), opportunityReserve: aN('Opportunity Reserve', null),
    criticalGap: aN('Critical Gap Threshold', B.criticalGap)!, highCapitalFloor: aN('High Capital Review Floor', B.highCapitalFloor)!, agingDays: aN('Retention Decision Aging', B.agingDays)!,
  };

  const pi = sheetOf(sheets, 'Position Inventory'); const hp = headerRow(pi, 'Position Group', 'Live Need');
  const positions: PositionRow[] = [];
  if (pi && hp) for (const r of pi.slice(hp.i + 1)) {
    const g = str(r[hp.col('Position Group')]); if (!g) { if (positions.length) break; continue; }
    const n = (l: string) => num(r[hp.col(l)]) ?? 0;
    positions.push({ group: g, baseCurrent: n('Baseline Current'), baseNeed: n('Baseline Need'), baseTargets: n('Baseline Targets'), baseCapital: n('Baseline Target Capital'),
      current: n('Live Current'), need: n('Live Need'), targets: n('Live Targets'), capital: n('Live Target Capital'), note: str(r[hp.col('Operating Note')]), source: str(r[hp.col('Source')]) });
  } else warnings.push('Position Inventory not found — sample positions used');

  const pb = sheetOf(sheets, 'Portal Board'); const hb = headerRow(pb, 'Priority', 'Position', 'Bodies');
  const portal: PortalRow[] = [];
  if (pb && hb) for (const r of pb.slice(hb.i + 1)) {
    const pr = str(r[hb.col('Priority')]); const p = str(r[hb.col('Position')]); const bodies = num(r[hb.col('Bodies')]);
    if (!(/^P\d$/.test(pr) || (!pr && p && bodies != null))) continue;
    portal.push({ id: 'PB' + (portal.length + 1), priority: pr, pos: p, bodies, needType: str(r[hb.col('Need Type')]), why: str(r[hb.col('Why Need Exists')]), role: str(r[hb.col('BSM Role Target')]),
      low: num(r[hb.col('Planning Low / Athlete')]), high: num(r[hb.col('Planning High / Athlete')]), timing: str(r[hb.col('Timing')]), rule: str(r[hb.col('Decision Rule')]) });
  }

  const tl = sheetOf(sheets, 'Trigger Log'); const ht = headerRow(tl, 'Date', 'Trigger Type');
  const triggers: TriggerRow[] = [];
  if (tl && ht) for (const r of tl.slice(ht.i + 1)) {
    const cells = ['Athlete / Position', 'Trigger Type', 'Observed Change', 'New Call'].map((l) => str(r[ht.col(l)]));
    if (cells.every((c) => !c)) continue;
    const subject = str(r[ht.col('Athlete / Position')]);
    triggers.push({ id: 'T' + (triggers.length + 1), date: isoDate(r[ht.col('Date')]), subject, rosterId: roster.find((x) => x.athlete === subject)?.id ?? null, type: str(r[ht.col('Trigger Type')]),
      observed: str(r[ht.col('Observed Change')]), priorCall: str(r[ht.col('Prior Call')]), newCall: str(r[ht.col('New Call')]), effect: str(r[ht.col('Capital Effect')]),
      product: str(r[ht.col('Required Product')]), owner: str(r[ht.col('Owner')]), status: str(r[ht.col('Status')]) || 'Open', applied: norm(r[ht.col('Applied to Master')]) === 'yes' });
  }

  const sf = sheetOf(sheets, 'Scenario Forecast'); const hs = headerRow(sf, 'Scenario', 'Utilization');
  const scenarios: ScenarioRow[] = [];
  if (sf && hs) for (const r of sf.slice(hs.i + 1)) {
    const n = str(r[hs.col('Scenario')]); if (!n) { if (scenarios.length) break; continue; }
    scenarios.push({ name: n, signal: str(r[hs.col('Season Signal')]), retention: str(r[hs.col('Retention Posture')]), portal: str(r[hs.col('Portal Posture')]),
      utilization: num(r[hs.col('Utilization')]) ?? assume.utilFloor, classObligation: num(r[hs.col('FY27-28 Class')]) ?? inputs.classObligation2728, risk: str(r[hs.col('Primary Risk')]), call: str(r[hs.col('Required Call')]) });
  }

  const hw = headerRow(ic, 'Forecast Window', 'Amount'); const classWindows: ClassWindow[] = [];
  if (ic && hw) for (const r of ic.slice(hw.i + 1)) {
    if (blank(r) || !str(r[hw.col('Forecast Window')])) break;
    classWindows.push({ window: str(r[hw.col('Forecast Window')]), amount: num(r[hw.col('Amount')]) ?? 0, fy: str(r[hw.col('Fiscal Year')]), type: str(r[hw.col('Type')]), use: str(r[hw.col('Use')]), note: str(r[hw.col('Note')]) });
  }
  const hct = headerRow(ic, 'Athlete', 'Prior Stated Target Value'); const classTargets: ClassTarget[] = [];
  if (ic && hct) for (const r of ic.slice(hct.i + 1)) {
    const n = str(r[hct.col('Athlete')]); if (!n) continue;
    classTargets.push({ id: 'CT' + (classTargets.length + 1), athlete: n, pos: str(r[hct.col('Position')]), prior: num(r[hct.col('Prior Stated Target Value')]) ?? 0, board: str(r[hct.col('Prior Board State')]),
      rationale: str(r[hct.col('Prior Rationale')]), control: str(r[hct.col('Current Control')]) });
  }

  const ms = sheetOf(sheets, 'Method & Sources'); const method: [string, string][] = []; const sources: [string, string][] = [];
  const hr = headerRow(ms, 'Rule', 'Application');
  if (ms && hr) for (const r of ms.slice(hr.i + 1)) { if (blank(r)) break; method.push([str(r[0]), str(r[1])]); }
  const hso = headerRow(ms, 'Source', 'URL / basis');
  if (ms && hso) for (const r of ms.slice(hso.i + 1)) { if (blank(r)) break; sources.push([str(r[0]), str(r[1])]); }
  const og = sheetOf(sheets, 'Operating Guide'); const hg = headerRow(og, 'Control', 'Where to Edit'); const guide: string[][] = [];
  if (og && hg) for (const r of og.slice(hg.i + 1)) {
    if (blank(r) || !str(r[0])) break;
    guide.push(['Control', 'Where to Edit', 'What Updates', 'Owner', 'Cadence', 'Rule', 'Do Not Do'].map((l) => str(r[hg.col(l)])));
  }

  return {
    meta: { title: fileName.replace(/\.[^.]+$/, ''), source: fileName, loaded: new Date().toISOString(), sample: false, asOf: today, ...(warnings.length ? { warnings } : {}) },
    inputs, assume, roster,
    positions: positions.length ? positions : base.positions, portal, triggers,
    scenarios: scenarios.length ? scenarios : base.scenarios.map((s) => ({ ...s, classObligation: inputs.classObligation2728 })),
    classWindows, classTargets, method: method.length ? method : base.method, sources, guide: guide.length ? guide : DEFAULT_GUIDE,
  };
}

/* ------------------------------------------------------------------ export */
/** The live book as sheets. Labels match the importer, so an exported file re-imports losslessly. */
export function bookToSheets(b: OsBook, m: OsModel = computeOs(b)): SheetRows[] {
  const byId = new Map(m.recs.map((d) => [d.rec.id, d]));
  const rmHeader = [...RM_LABELS.slice(0, 26).map((x) => x[1]), ...RM_DERIVED, 'Owner', 'Last Updated'];
  const rmRows = b.roster.map((r) => {
    const d = byId.get(r.id);
    const v = RM_LABELS.map(([k]) => r[k] as Cell);
    return [...v.slice(0, 26), d?.highCapital, d?.planningInventory, d?.priority, d?.readiness, d?.currentPct, d?.forwardPct, d?.actionRequired, r.owner, r.updated];
  });
  const A = b.assume, I = b.inputs;
  return [
    { name: 'CEO Dashboard', rows: [['COLORADO FOOTBALL // CEO ROSTER CAPITAL DASHBOARD'], [`Exported ${new Date().toISOString().slice(0, 10)} from the Roster Capital OS`], [],
      ['FY26-27 FORECAST AVAILABLE', 'PROJECTED FY27-28 ALLOCATION', 'EXISTING FY27-28 CAPS', 'PROPOSED FY27-28 CLASS', 'BASE PORTAL BODIES'],
      [I.forecastAvailable2627, m.projected, m.existing2728, I.classObligation2728, I.basePortalBodies], [],
      ['GROSS UNCOMMITTED BEFORE RESERVES', 'ROOM TO FLOOR', 'ROOM TO CEILING', 'TRUE OTB'], [m.gross, m.room70, m.room72, m.trueOtb ?? 'WITHHELD'], [],
      ['TOTAL ROSTER', '2+ SEASON PLANNING INVENTORY', '1-SEASON INVENTORY', 'BLANK ELIGIBILITY', 'CERTIFIED YES'],
      [m.counts.records, m.counts.inv2plus, m.counts.inv1, m.counts.blankElig, m.counts.certYes], [],
      ['Exception', 'Level', 'Detail', 'Owner'], ...m.exceptions.map((e) => [e.code, e.lvl, e.text, e.owner])] },
    { name: 'CEO Scorecard', rows: [['Category', 'Metric', 'Owner', 'Current', 'Guardrail', 'Type', 'Status', 'Decision', 'Source', 'Update', 'Definition'],
      ...m.scorecard.map((s) => [s.category, s.metric, s.owner, s.value ?? 'WITHHELD', s.guardrail, s.type, s.status, s.decision, s.source, s.cadence, s.definition])] },
    { name: 'Roster Master', rows: [rmHeader, ...rmRows] },
    { name: 'Retention Matrix', rows: [['Athlete', ...UW_LABELS.map((x) => x[1])], ...b.roster.map((r) => [r.athlete, ...UW_LABELS.map(([k]) => r.uw[k])])] },
    { name: 'Position Inventory', rows: [['Position Group', 'Baseline Current', 'Baseline Need', 'Baseline Targets', 'Baseline Target Capital', 'Baseline Net Need', 'Baseline Status',
      'Live Current', 'Live Need', 'Live Targets', 'Live Target Capital', 'Live Net Need', 'Live Status', 'Operating Note', 'Source'],
      ...m.positions.map(({ row: p, baseNet, baseStatus, net, status }) => [p.group, p.baseCurrent, p.baseNeed, p.baseTargets, p.baseCapital, baseNet, baseStatus, p.current, p.need, p.targets, p.capital, net, status, p.note, p.source])] },
    { name: 'Portal Board', rows: [['Priority', 'Position', 'Bodies', 'Need Type', 'Why Need Exists', 'BSM Role Target', 'Planning Low / Athlete', 'Planning High / Athlete', 'Low Reserve', 'High Reserve', 'Timing', 'Decision Rule'],
      ...m.portal.map(({ row: p, lowReserve, highReserve }) => [p.priority, p.pos, p.bodies, p.needType, p.why, p.role, p.low, p.high, lowReserve, highReserve, p.timing, p.rule]), [],
      ['Portal Reserve View', 'Low', 'High'], ['Structural deficits only', m.portalView.structural.low, m.portalView.structural.high],
      ['Replacement watches', m.portalView.replacement.low, m.portalView.replacement.high], ['Full gross board — NOT simultaneous spend', m.grossBoard.low, m.grossBoard.high]] },
    { name: 'Trigger Log', rows: [['Date', 'Athlete / Position', 'Trigger Type', 'Observed Change', 'Prior Call', 'New Call', 'Capital Effect', 'Required Product', 'Owner', 'Status', 'Applied to Master'],
      ...b.triggers.map((t) => [t.date, t.subject, t.type, t.observed, t.priorCall, t.newCall, t.effect, t.product, t.owner, t.status, t.applied ? 'Yes' : 'No'])] },
    { name: 'Assumptions', rows: [['Assumption', 'Value', 'Unit'], ['FY2027-28 Growth Assumption', A.growth, '%'], ['Target Utilization Floor', A.utilFloor, '%'], ['Target Utilization Ceiling', A.utilCeiling, '%'],
      ['Retention Reserve', A.retentionReserve, '$'], ['Replacement Reserve', A.replacementReserve, '$'], ['Contingency Reserve', A.contingencyReserve, '$'], ['Opportunity Reserve', A.opportunityReserve, '$'],
      ['Critical Gap Threshold', A.criticalGap, 'Bodies'], ['High Capital Review Floor', A.highCapitalFloor, '$'], ['Retention Decision Aging', A.agingDays, 'Days']] },
    { name: '2027 Forecast', rows: [['Forecast Metric', 'Value'], ['FY2026-27 Football Allocation', I.allocation2627], ['Growth Assumption', A.growth], ['Projected FY2027-28 Allocation', m.projected],
      ['Existing FY2027-28 CAPS', m.existing2728], ['Proposed FY2027-28 Class Obligation', I.classObligation2728], ['Gross Uncommitted Before Reserves', m.gross],
      ['Room to Floor', m.room70], ['Room to Ceiling', m.room72], ['Spring 2027 Class Entry', I.springClassEntry], ['FY2026-27 Forecast Available', I.forecastAvailable2627]] },
    { name: 'Capital Books', rows: [['Line Item', 'Value', 'Status'], ['Projected FY2027-28 Allocation', m.projected, 'PLANNING'], ['Existing FY2027-28 CAPS', m.existing2728, 'VERIFIED'],
      ['Proposed FY2027-28 Class Obligation', I.classObligation2728, 'PROPOSED'], ['Gross Uncommitted Before Reserves', m.gross, 'CALCULATED'], ['Structural Portal Low Case', m.portalView.structural.low, 'PLANNING'],
      ['Retention Reserve', A.retentionReserve, A.retentionReserve == null ? 'INPUT REQUIRED' : 'ENTERED'], ['Replacement Reserve', A.replacementReserve, A.replacementReserve == null ? 'INPUT REQUIRED' : 'ENTERED'],
      ['Contingency Reserve', A.contingencyReserve, A.contingencyReserve == null ? 'INPUT REQUIRED' : 'ENTERED'], ['Opportunity Reserve', A.opportunityReserve, A.opportunityReserve == null ? 'INPUT REQUIRED' : 'ENTERED'],
      ['TRUE OPEN-TO-BUY', m.trueOtb ?? 'WITHHELD', m.trueOtb == null ? 'WITHHELD' : 'CALCULATED']] },
    { name: 'Scenario Forecast', rows: [['Scenario', 'Season Signal', 'Retention Posture', 'Portal Posture', 'Utilization', 'FY27-28 Class', 'Retention + Acquisition Room', 'Held Outside Utilization', 'Primary Risk', 'Required Call'],
      ...m.scenarios.map(({ s, room, held }) => [s.name, s.signal, s.retention, s.portal, s.utilization, s.classObligation, room, held, s.risk, s.call])] },
    { name: '2027 Incoming Class', rows: [['TARGET COUNT', 'PRIOR TARGET BOARD TOTAL', 'FY27-28 CLASS FORECAST', 'CLASS STATUS'], [I.targetCount, I.priorBoardTotal, I.classObligation2728, I.classStatus], [],
      ['Forecast Window', 'Amount', 'Fiscal Year', 'Type', 'Use', 'Note'], ...b.classWindows.map((w) => [w.window, w.amount, w.fy, w.type, w.use, w.note]), [],
      ['Athlete', 'Position', 'Prior Stated Target Value', 'Prior Board State', 'Prior Rationale', 'Current Control'], ...b.classTargets.map((t) => [t.athlete, t.pos, t.prior, t.board, t.rationale, t.control])] },
    { name: 'Metric Definitions', rows: [['Metric', 'Definition', 'Source / Basis', 'Value Type', 'Current Value'], ['FY2026-27 Forecast Committed', '', '', '', I.forecastCommitted2627], ['Separate Buyout', '', '', '', I.separateBuyout]] },
    { name: 'Method & Sources', rows: [['Rule', 'Application'], ...b.method, [], ['Source', 'URL / basis'], ...b.sources] },
    { name: 'Operating Guide', rows: [['Control', 'Where to Edit', 'What Updates', 'Owner', 'Cadence', 'Rule', 'Do Not Do'], ...b.guide] },
  ];
}

/* ------------------------------------------------------------------ browser I/O (SheetJS from cdnjs) */
interface XlsxLib {
  read: (d: ArrayBuffer, o: object) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  writeFile: (wb: unknown, name: string) => void;
  utils: { sheet_to_json: (s: unknown, o: object) => Cell[][]; aoa_to_sheet: (rows: Cell[][]) => unknown; book_new: () => unknown; book_append_sheet: (wb: unknown, ws: unknown, name: string) => void };
}
const lib = () => (window as unknown as { XLSX: XlsxLib }).XLSX;

export async function readWorkbookFile(f: File): Promise<OsBook> {
  await loadXLSX();
  const wb = lib().read(await f.arrayBuffer(), { type: 'array' });
  const sheets = wb.SheetNames.map((name) => ({ name, rows: lib().utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) }));
  return parseWorkbook(f.name, sheets);
}
export async function writeWorkbookFile(b: OsBook, fileName: string) {
  await loadXLSX();
  const X = lib(); const wb = X.utils.book_new();
  for (const s of bookToSheets(b)) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c === undefined ? null : c)))), s.name.slice(0, 31));
  X.writeFile(wb, fileName);
}
