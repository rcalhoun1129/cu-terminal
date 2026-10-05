/* Operating guide (workbook `Operating Guide`) and metric lineage. Process text only — no athlete data. */
export const GUIDE_HEADER = ['Control', 'Where to edit', 'What updates', 'Owner', 'Cadence', 'Rule', 'Do not do'];
export const DEFAULT_GUIDE: string[][] = [
  ['Athlete status / role', 'Roster Master', 'Dashboard, position gaps, decisions', 'Personnel / Buy-Side', 'Weekly', 'One athlete = one master record', 'Do not duplicate athlete rows across operating sheets'],
  ['Eligibility certification', 'Roster Master › Compliance Cert 2027', 'Future inventory, risk, decision readiness', 'Compliance', 'Event driven', 'Pending is a governance stop', 'Do not infer eligibility from class label'],
  ['Economic call', 'Roster Master › Economic Call', 'CEO scorecard, decision counts', 'Buy-Side', 'Weekly', 'Retain / Increase / Hold / Restructure / Recycle / Replace / Scout / Exit', 'Do not let current price determine the call'],
  ['Position targets', 'Position Inventory › live columns', 'Physical gap', 'Personnel', 'Monthly / trigger', 'Target body count is an operating assumption', 'Do not confuse body count with functional inventory'],
  ['Incoming class', '2027 Incoming Class', 'Capital forecast + position inventory', 'Recruiting / Buy-Side', 'On commitment change', 'Class remains its own capital book', 'Do not blend with portal or retention'],
  ['Portal need', 'Portal Board', 'Portal reserve + dashboard', 'Personnel / Buy-Side', 'Daily in market', 'Every target tied to a role and need type', 'Do not add names before need is established'],
  ['Reserves', 'Assumptions', 'Capital Books + True OTB', 'Decision Room', 'Monthly', 'Reserve first, spend second', 'Do not treat unspent money as free'],
  ['Trigger event', 'Trigger Log', 'Requires Roster Master re-underwrite', 'Assigned owner', 'Event driven', 'Every material event gets a decision response', 'Do not wait for month-end'],
  ['CEO review', 'CEO Dashboard / CEO Scorecard', 'Executive view', 'Leadership', 'Weekly', 'Review red → yellow → green, owner and action', 'Do not turn dashboard into a narrative report'],
];
export const OPERATING_LOOP = ['Roster state', 'Position need', 'Capital need', 'Decision', 'Structure', 'New roster state'];
