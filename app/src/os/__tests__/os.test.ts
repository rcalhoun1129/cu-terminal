/* Roster Capital OS: engine rules, workbook round trip, the trigger → master operating loop,
   and (local only) parity with the cached formula values of the real workbook. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { computeOs, derivePosition } from '../engine';
import { sampleBook } from '../sample';
import { addRecord, logTrigger, os, setAssume, setInput, setTriggerStatus, updateRecord } from '../store';
import { bookToSheets, parseWorkbook, type Cell, type SheetRows } from '../workbook';

const close = (a: number | null, b: number) => expect(a).toBeCloseTo(b, 2);

describe('engine', () => {
  it('forecast and capacity follow the 2027 Forecast formulas', () => {
    const b = sampleBook(); const m = computeOs(b); const A = b.assume, I = b.inputs;
    close(m.projected, I.allocation2627 * (1 + A.growth));
    close(m.gross, m.projected - m.existing2728 - I.classObligation2728);
    close(m.room70, m.projected * A.utilFloor - m.existing2728 - I.classObligation2728);
    close(m.room72, m.projected * A.utilCeiling - m.existing2728 - I.classObligation2728);
    close(m.existing2728, b.roster.reduce((a, r) => a + r.caps2728, 0));
  });
  it('True OTB stays withheld until all four reserves are entered', () => {
    const b = sampleBook(); expect(computeOs(b).trueOtb).toBeNull();
    b.assume = { ...b.assume, retentionReserve: 1e6, replacementReserve: 5e5, contingencyReserve: 2.5e5 };
    expect(computeOs(b).trueOtb).toBeNull();
    b.assume.opportunityReserve = 2.5e5; const m = computeOs(b);
    close(m.trueOtb, m.gross - 2e6 - m.portalView.structural.low);
  });
  it('position status rules', () => {
    const p = (need: number, targets: number) => derivePosition({ group: 'X', baseCurrent: 0, baseNeed: need, baseTargets: targets, baseCapital: 0, current: 0, need, targets, capital: 0, note: '', source: '' });
    expect(p(0, 1).status).toBe('SURPLUS'); expect(p(4, 1).status).toBe('CRITICAL'); expect(p(2, 0).status).toBe('THIN'); expect(p(2, 2).status).toBe('STABLE');
  });
  it('record derivations follow Roster Master AA–AG', () => {
    const b = sampleBook(); const r = { ...b.roster[0], caps2627: 200000, elig: 1, call: 'Replace', cert: '', status: 'Current', trigger: '' }; b.roster = [r];
    const d = computeOs(b).recs[0];
    expect([d.highCapital, d.planningInventory, d.priority, d.readiness, d.actionRequired]).toEqual(['YES', 'NO', 'P2', 'ELIGIBILITY CERT NEEDED', 'YES']);
    close(d.currentPct, 200000 / b.inputs.allocation2627);
  });
});

describe('workbook round trip', () => {
  it('an exported book re-imports with the same inputs', () => {
    const b = sampleBook(); b.assume.retentionReserve = 750000;
    b.triggers = [{ id: 'T1', date: '2026-10-01', subject: b.roster[3].athlete, rosterId: b.roster[3].id, type: 'Major injury', observed: 'Out for season', priorCall: 'Hold', newCall: 'Replace', effect: '', product: 'Memo', owner: 'Buy-Side', status: 'Open', applied: true }];
    const back = parseWorkbook('x.xlsx', bookToSheets(b), '2026-10-05');
    const strip = (x: typeof b) => ({ ...x, meta: null, guide: null, sources: null, roster: x.roster.map(({ id: _id, ...r }) => r), classTargets: x.classTargets.map(({ id: _id, ...r }) => r), portal: x.portal.map(({ id: _id, ...r }) => r),
      triggers: x.triggers.map(({ id: _id, rosterId, ...t }) => ({ ...t, athlete: x.roster.find((r) => r.id === rosterId)?.athlete })) });
    expect(strip(back)).toEqual(strip(b));
  });
  it('rejects a workbook without a Roster Master', () => {
    expect(() => parseWorkbook('x.xlsx', [{ name: 'Sheet1', rows: [['a']] }])).toThrow(/Roster Master/);
  });
});

describe('operating loop', () => {
  it('trigger → master re-underwrite → close clears the flag; edits are undoable', () => {
    os._reset(sampleBook());
    const id = addRecord('Test Athlete', 'WR');
    updateRecord(id, { call: 'Hold', caps2627: 300000 });
    const before = computeOs(os.get().book).capsTotal;
    logTrigger({ date: '2026-10-05', subject: 'Test Athlete', rosterId: id, type: 'Breakout production', observed: '20%+ snap change', priorCall: '', newCall: 'Increase', effect: '', product: '', owner: 'Buy-Side', status: 'Open' }, true);
    let r = os.get().book.roster.find((x) => x.id === id)!;
    expect([r.call, r.trigger, r.decision]).toEqual(['Increase', 'Breakout production', 'Under Review']);
    expect(os.get().book.triggers[0].priorCall).toBe('Hold');
    setTriggerStatus(os.get().book.triggers[0].id, 'Closed');
    r = os.get().book.roster.find((x) => x.id === id)!; expect(r.trigger).toBe('');
    setInput('classObligation2728', 1); expect(os.get().book.scenarios.every((s) => s.classObligation === 1)).toBe(true);
    setAssume('growth', 0.1); os.undo(); expect(os.get().book.assume.growth).toBe(0.04);
    expect(computeOs(os.get().book).capsTotal).toBe(before);
  });
});

/* ------------------------------------------------------------------ local parity with the real workbook */
const ref = process.env.CU_OS_WORKBOOK || join(__dirname, '../../../../reference/roster-capital-os.xlsx');
describe.skipIf(!existsSync(ref))('parity with the reference workbook (local only)', () => {
  const wb = XLSX.read(readFileSync(ref));
  const sheets: SheetRows[] = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) }));
  const cell = (s: string, a: string) => (wb.Sheets[s][a] as { v?: unknown } | undefined)?.v as number | string | undefined;
  const book = parseWorkbook('ref.xlsx', sheets); const m = computeOs(book);

  it('imports every master record and input', () => {
    expect(book.meta.warnings ?? []).toEqual([]);
    expect(m.counts.records).toBe(cell('CEO Dashboard', 'A19'));
    expect(book.portal.length).toBeGreaterThan(0); expect(book.positions.length).toBe(12); expect(book.scenarios.length).toBe(4);
    expect(book.roster.filter((r) => r.uw.priority).length).toBe(m.counts.records);
  });
  it('2027 Forecast, Capital Books and Scenario values match the workbook', () => {
    ['B8', 'B9', 'B11', 'B12', 'B13'].forEach((a, i) => close([m.projected, m.existing2728, m.gross, m.room70, m.room72][i], cell('2027 Forecast', a) as number));
    close(m.capsTotal, cell('Executive Board', 'D6') as number);
    expect(m.trueOtb == null ? 'WITHHELD' : m.trueOtb).toBe(cell('Capital Books', 'B17'));
    close(m.portalView.structural.low, cell('Capital Books', 'B12') as number);
    close(m.portalView.structural.low, cell('Portal Board', 'B16') as number); close(m.portalView.structural.high, cell('Portal Board', 'C16') as number);
    close(m.portalView.replacement.low, cell('Portal Board', 'B17') as number); close(m.grossBoard.high, cell('Portal Board', 'C19') as number);
    m.scenarios.forEach((s, i) => { close(s.room, cell('Scenario Forecast', 'G' + (5 + i)) as number); close(s.held, cell('Scenario Forecast', 'H' + (5 + i)) as number); });
  });
  it('dashboard counts match the workbook', () => {
    const C = m.counts;
    expect([C.inv2plus, C.inv1, C.blankElig, C.certYes, C.removed]).toEqual([cell('CEO Dashboard', 'D19'), cell('CEO Dashboard', 'G19'), cell('CEO Dashboard', 'J19'), cell('CEO Dashboard', 'M19'), cell('Executive Board', 'M12')]);
    expect(C.certUnpopulated).toBe(cell('CEO Dashboard', 'K26')); expect(m.netNeed).toBe(cell('CEO Dashboard', 'K30'));
  });
  it('Roster Master AA–AD and AG match row by row; positions match', () => {
    m.recs.forEach((d, i) => {
      const row = 2 + i; const got = [d.highCapital, d.planningInventory, d.priority, d.readiness, d.actionRequired];
      expect(got, d.rec.id).toEqual(['AA', 'AB', 'AC', 'AD', 'AG'].map((c) => cell('Roster Master', c + row)));
    });
    m.positions.forEach((p, i) => { expect([p.baseNet, p.baseStatus, p.net, p.status]).toEqual(['F', 'G', 'L', 'M'].map((c) => cell('Position Inventory', c + (6 + i)))); });
  });
  it('eligibility treatment text matches the Eligibility sheet', () => {
    const rows = sheets.find((s) => s.name === 'Eligibility')!.rows.slice(1).filter((r) => r[0]);
    const byName = new Map(m.recs.map((d) => [d.rec.athlete, d.treatment]));
    for (const r of rows) expect(byName.get(String(r[0]))).toBe(r[5]);
  });
});
