/* Roster Capital OS — the operating book. This is the input layer of the
   "Colorado Football Roster Capital CEO Dashboard" workbook: every blue input cell of the
   workbook is a field here, and every formula cell is computed by `engine.ts`. */

/** Dropdown lists (workbook `Lists` sheet and in-cell data validations). */
export const LISTS = {
  call: ['Retain', 'Increase', 'Hold', 'Restructure', 'Recycle', 'Replace', 'Scout', 'Exit'],
  decision: ['Observing', 'Under Review', 'Authorized', 'Negotiating', 'Agreed', 'Executed', 'Closed'],
  confidence: ['High', 'Medium', 'Low'],
  need: ['Closed', 'Monitor', 'Thin', 'Priority', 'Critical'],
  acquisition: ['Starter upgrade', 'Starter replacement', 'Rotation', 'Developmental', 'Emergency depth'],
  bsmClass: ['Portfolio Anchor', 'Core Investment', 'Functional Investment', 'Developmental / Optionality', 'Replacement / Emergency'],
  rosterState: ['Current', 'Contracted 2027', 'Expected 2027', 'Target 2027', 'Stress 2027', 'Departing'],
  trigger: ['Starter change', 'Major injury', '20%+ snap change', 'Breakout production', 'Material underperformance', 'Agent change',
    'Transfer indication', 'Eligibility change', 'NFL declaration', 'Incoming commitment', 'Portal acquisition', 'Scheme change', 'Contract dispute'],
  cert: ['Yes', 'No', 'Pending'],
  risk: ['High', 'Medium', 'Low'],
  owner: ['Buy-Side', 'Player Personnel', 'Coaching Staff', 'Compliance', 'Finance', 'Decision Room'],
  triggerStatus: ['Open', 'In Review', 'Closed'],
  portalPriority: ['P0', 'P1', 'P2', 'P3'],
  portalNeed: ['STRUCTURAL DEFICIT', 'REPLACEMENT WATCH', 'PERFORMANCE OPTION', 'CONTINGENCY ONLY'],
  status: ['Current', 'Incomer - HS', 'Incomer - 4-4', 'Incomer - JUCO', 'REMOVED'],
} as const;

/** One athlete = one master record (workbook `Roster Master`, input columns A–Z, AH, AI). */
export interface RosterRec {
  id: string;
  athlete: string; pos: string; status: string; elig: number | null; cert: string; rosterState: string;
  functionalRole: string; depthRole: string; caps2627: number; caps2728: number; acqBasis: number | null; mark: number | null;
  low2027: number | null; high2027: number | null; bsmClass: string; call: string; decision: string; confidence: string;
  agent: string; nextDate: string; trigger: string; replLow: number | null; replHigh: number | null; retentionRisk: string; portalRisk: string;
  notes: string; owner: string; updated: string;
  /** Retention-underwriting narrative (workbook `Retention Matrix`), keyed to the master record. */
  uw: RetentionUw;
}
export interface RetentionUw { priority: string; callText: string; band: string; fixedShare: string; conditionalShare: string; evidence: string; rationale: string; rosterSource: string; statsSource: string }
export const EMPTY_UW: RetentionUw = { priority: '', callText: '', band: '', fixedShare: '', conditionalShare: '', evidence: '', rationale: '', rosterSource: '', statsSource: '' };
export const ROSTER_FIELDS: (keyof Omit<RosterRec, 'id' | 'uw'>)[] = ['athlete', 'pos', 'status', 'elig', 'cert', 'rosterState', 'functionalRole', 'depthRole', 'caps2627', 'caps2728',
  'acqBasis', 'mark', 'low2027', 'high2027', 'bsmClass', 'call', 'decision', 'confidence', 'agent', 'nextDate', 'trigger', 'replLow', 'replHigh', 'retentionRisk', 'portalRisk', 'notes', 'owner', 'updated'];

/** `Position Inventory` — baseline (Appendix A, read-only) and live (personnel-controlled) inputs. */
export interface PositionRow { group: string; baseCurrent: number; baseNeed: number; baseTargets: number; baseCapital: number; current: number; need: number; targets: number; capital: number; note: string; source: string }

/** `Portal Board` target rows. Low/High reserve = bodies × planning low/high. */
export interface PortalRow { id: string; priority: string; pos: string; bodies: number | null; needType: string; why: string; role: string; low: number | null; high: number | null; timing: string; rule: string }

/** `Trigger Log` — event-driven re-underwriting. */
export interface TriggerRow { id: string; date: string; subject: string; rosterId: string | null; type: string; observed: string; priorCall: string; newCall: string; effect: string; product: string; owner: string; status: string; applied: boolean }

export interface ScenarioRow { name: string; signal: string; retention: string; portal: string; utilization: number; classObligation: number; risk: string; call: string }
export interface ClassWindow { window: string; amount: number; fy: string; type: string; use: string; note: string }
export interface ClassTarget { id: string; athlete: string; pos: string; prior: number; board: string; rationale: string; control: string }

export interface OsAssumptions {
  growth: number; utilFloor: number; utilCeiling: number;
  retentionReserve: number | null; replacementReserve: number | null; contingencyReserve: number | null; opportunityReserve: number | null;
  criticalGap: number; highCapitalFloor: number; agingDays: number;
}
/** Source-reported program figures (blue inputs on `2027 Forecast`, `Executive Board`, `CEO Dashboard`). */
export interface OsInputs {
  allocation2627: number; forecastAvailable2627: number; forecastCommitted2627: number; separateBuyout: number;
  classObligation2728: number; springClassEntry: number; priorBoardTotal: number; targetCount: number; classStatus: string; basePortalBodies: number; basePortalMix: string;
}

export interface OsBook {
  meta: { title: string; source: string; loaded: string; sample: boolean; asOf: string; warnings?: string[] };
  inputs: OsInputs; assume: OsAssumptions;
  roster: RosterRec[]; positions: PositionRow[]; portal: PortalRow[]; triggers: TriggerRow[];
  scenarios: ScenarioRow[]; classWindows: ClassWindow[]; classTargets: ClassTarget[];
  /** Reference text (Method & Sources, Operating Guide). Data-specific, so it travels with the book. */
  method: [string, string][]; sources: [string, string][]; guide: string[][];
}
