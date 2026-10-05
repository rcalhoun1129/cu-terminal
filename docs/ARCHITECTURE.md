# Architecture — React + TypeScript refactor

The single-file reference app combined data, engine, state, rendering and event handling in
one script. The refactor splits these into five layers with one-way dependencies:

```
data  ──►  engine  ──►  state  ──►  ui / screens / shell
                 └────────────►  audit (trace drawer)
```

## 1. Data model — `app/src/data`
* `types.ts`: the full `CuData` shape (players, contract episodes, third-party ledger, rosters,
  aliases, controls, reference book block, Drive program data).
* `load.ts`: loads the local restricted JSON if it is present and falls back to the synthetic sample.
  It also parses a user-picked file in the browser (the extracted JSON or the original HTML).
* `sample/generate.ts`: deterministic synthetic dataset with fictional names. It covers every
  episode kind and Drive block, so every screen renders without real data.
* `importBook.ts`: the "re-import a newer 26-27 book" workflow (SheetJS loaded from cdnjs, header
  detection, amendment rows, fuzzy name resolution). Players that are not on a roster stay with
  the import (`ImportedBook.newPlayers`) and are not written into the base dataset.

## 2. Analytics engine — `app/src/engine`
These are pure functions of `(CuData, EngineSettings, ImportedBook | null)`. They have no DOM
or React dependency.
* `model.ts`: `buildModel()` builds holdings per season, market observations, statistics, bands,
  quotes, position indexes and CUBSMI, then the `A` analytics bundle.
* `lifecycle.ts` (season-grain Kaplan–Meier), `flows.ts` (churn, persistence, retention and
  replacement), `heat.ts`, `concentration.ts`, `maturity.ts` (maturity wall and cash schedule),
  `tape.ts` (transaction blotter), `alerts.ts`, `dq.ts` (data-quality rules).
* `underwrite.ts` (`uwCalc`, `fyAlloc`, `dealMonths`, `dealImpact`) and `scenarios.ts`
  (`applyScenario`, `scMetrics`): these calculations were inline in the reference screens.
* `controls.ts`: control cells whose keys contain an athlete surname are matched by pattern.
  This keeps names out of the code.

**Parity.** `engine/__tests__/parity.test.ts` extracts the original engine from the local
reference HTML, runs it in a Node `vm` and compares every analytic with the TypeScript engine
across 7 settings scenarios. The test skips when the reference file is absent, as it is in CI.

## 3. Application state — `app/src/state/store.ts`
* One external store read through `useSyncExternalStore`. It holds settings, filters,
  assumptions, scenarios, the comparison set, the imported book, form state, the audit log and
  the open trace.
* `getModel()` memoises the model on its inputs. Any change to threshold, metric, N limits, band
  basis, early-enrollee rule, view or assumptions rebuilds it.
* `setPath()` reproduces the reference `data-set` coercion: `f.` = filters, `a.` = assumptions,
  and `a.` changes are persisted.
* It persists the same localStorage key and shape as the reference: `cu-bsm-state` →
  `{assume, scenarios, compare}`.

## 4. Source / audit layer — `app/src/audit`, `ui/components.tsx`
* `Money` renders a figure that opens the **source audit drawer** when clicked. The drawer walks
  from the number to its player records, contract episodes and source file › sheet › row, with a
  confidence tag.
* `logAudit()` keeps the session audit log: settings, assumptions, imports, scenario changes and
  the comparison set.
* DQ notes that are specific to a dataset live in the data (`dqNotes`), not in code.

## 5. UI — `app/src/ui`, `app/src/shell`, `app/src/screens`
* `ui/components.tsx`: Panel, Kpi, Chg, tags, links, `Sel`/`Seg` (bound to `setPath`), `NavSel`,
  and `Table` (sortable, CSV export, row drill-down).
* `ui/charts.tsx`: SVG charts — horizontal bars, line, dot strip with bands, stacked, waterfall,
  treemap, survival, Lorenz, box plot, histogram, sparkline, month bars, scatter, capital stack
  and percentile bar.
* `shell/`:
  * `routes.tsx`: route registry; unknown routes fall back to home, as in the reference.
  * `Shell.tsx`: top bar and ticker, command bar, sidebar, intelligence rail, `data-go` /
    `data-tip` delegation, and a per-screen error boundary.
* `screens/`: one module per navigation section. `shared.tsx` holds cross-screen blocks such as
  the board table, ladder, quote, filter bar and tape table.

## 6. Verification performed
* `npm test` runs the engine parity test (7 scenarios), the sample-data model tests, and a jsdom
  render of every route on the sample data (113 tests).
* Browser sweep (Playwright): every route, every position-terminal tab and the parameterised
  routes render with no console errors, on both the sample data and the local restricted data.
  The sweep also checked the trace drawer, Esc, the command bar, the settings rebuild, table
  sort and tile drill-down.
* Screen-text diff against the original (local only): for 98 routes, the rendered text of the
  main pane was compared line by line with the original HTML in the same browser. The only
  differences are the intentional ones listed below.

## 7. Intentional deviations from the reference
Each change below either removes athlete names from code or fixes a defect. Numbers are
unchanged.
1. **Names are not hard-coded.** The reference embedded athlete names and athlete-level figures in
   screen text. Those values are now derived from the dataset:
   * Buyout KPIs (open, blocked, removed) come from the buyout register rows.
   * The installment note is built from the buyout episodes.
   * The pipeline variance athlete comes from the class rows.
   * The September game count comes from the schedule (it was hard-coded as 4).
   * The RCMS gap, the December exhausted-set difference, the FY27-28 hard-coded amount and
     row count, the Fall-25 gap, the book record count and the planning denominator are all
     computed.

   Labels that named an athlete now say "F26 buyout". The "live offer" row in the tracking
   registry no longer names the athlete.
2. **Wording.** The December note no longer asserts that the difference "exactly" matches the
   Working Analysis eligibility conflicts, because that fact is not in the data. It now says
   "compare with". The games footnote no longer names a game number.
3. **Metric rebuild.** In the reference, changing the price metric from the Settings select
   re-rendered without rebuilding the model. Now every setting change rebuilds the model.
4. **Import isolation.** Players added by an imported book are kept with the import and are
   removed with it on "Revert". The reference wrote them into the base dataset.
5. **Builds exclude restricted data.** `vite build` deletes `*.restricted.*` files from `dist/`.

## 8. Roster Capital OS — `app/src/os`, `app/src/screens/os.tsx`
The CEO Dashboard workbook (20 sheets) is converted into a module with the same one-way layering:
* `types.ts`: the operating book. One field per workbook input cell: Roster Master input columns
  A–Z/AH/AI plus the Retention Matrix narrative, Position Inventory, Portal Board, Trigger Log,
  Scenario Forecast, Incoming Class, Assumptions and the source-reported program figures. The
  dropdown lists come from the `Lists` sheet and the in-cell validations.
* `engine.ts`: `computeOs(book)` computes every formula cell. That covers Roster Master AA–AG,
  2027 Forecast, Capital Books (with True OTB withheld until all four reserves are set),
  Position Inventory net need and status, Portal reserves, Scenario room, Executive Board / CEO
  Dashboard counts, a CEO Scorecard with computed status, and an exception queue (red → yellow →
  gray, each with an owner and a link).
* `workbook.ts`: a label-driven importer (tolerates inserted rows and columns) and an exporter
  whose output re-imports without loss.
* `store.ts`: an immutable book with an undo stack, a change log and localStorage persistence.
  The operating loop lives here: logging a trigger can write the new call and trigger flag to the
  master record and move its decision to Under Review, and closing the trigger clears the flag.

**Parity.** With the real workbook present locally, the tests check these values against the
cached formula values: Forecast B8–B13, CAPS total, Capital Books B12/B17, Portal Board B16–C19,
Scenario G/H, dashboard counts, Roster Master AA–AD/AG for every row, Position Inventory F/G/L/M,
and the Eligibility treatment text.

**Deviations from the workbook.** Each one fixes a defect or removes a duplicate input:
1. Roster Master AE/AF ("Current-Year / Forward Capital %") divided by the growth rate
   (`'2027 Forecast'!B7` = 4%), which gave values such as 13,830,000. The OS divides by the FY26-27
   allocation and by the projected FY27-28 allocation.
2. Several values were typed in more than once: the class obligation (Capital Books B8, Control
   Center B8, Scorecard D9), FY26-27 forecast available, and the structural portal low case
   (Capital Books B12). The OS keeps each as a single input or formula.
3. Capital Books reserves (B13:B16) were not linked to Assumptions B8:B11. They are linked now.
4. Scorecard statuses were painted by hand. They are now computed from each guardrail.
5. The Executive Board position table read the baseline columns. The OS uses the live columns
   and still shows the baseline.
6. Retention Decision Aging had no formula. It now flags decisions that are more than N days
   past their Next Decision Date.
7. The Critical Gap Threshold assumption (2) is not used by the workbook's status formula, which
   hard-codes ≥ 3. The OS keeps ≥ 3 so results match, and labels the assumption as a reference
   value.
