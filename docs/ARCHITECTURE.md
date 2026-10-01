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
