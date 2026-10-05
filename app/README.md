# CU Buy-Side Capital Manager — React + TypeScript

A maintainable React 19 + TypeScript rebuild of the single-file HTML terminal. It covers the same
75 screens, routes, calculations, charts and interactions, with the UI, application state, data
model, analytics engine and source/audit layer kept in separate modules.
See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/AUDIT.md`](../docs/AUDIT.md).

## Data handling (important)

This repository is public. **Real athlete data is never committed.**

* With no local data, the app runs on a deterministic **synthetic sample** of fictional athletes
  (`src/data/sample/generate.ts`). The top-bar badge then reads `SAMPLE DATA`.
* Real data is used locally in one of two ways:
  1. **Extract once.** Put the original HTML at `reference/cu-buyside-capital-manager.html`
     (gitignored), or point `CU_REFERENCE_HTML` at it, then run `npm run extract`. This writes
     `public/data/cu-data.restricted.json` and `data/cu-data.restricted.json`, both gitignored.
     `npm run dev` serves the file to the app.
  2. **Load in the browser.** Click the dataset badge and pick the extracted JSON or the original
     HTML file. It is read in the browser only and never uploaded.
* `npm run build` never copies `*.restricted.*` files into `dist/`. A build therefore contains no
  athlete data.

## Roster Capital OS (nav section 00)

The "Colorado Football Roster Capital CEO Dashboard" workbook runs as a live operating system
inside the app (`#/os`). The workbook's blue input cells are editable fields and its formula
cells are computed by `src/os/engine.ts`, so one edit flows to every dashboard, as the workbook's
cross-sheet formulas did.

* **Load your workbook:** open *Roster Capital OS › CEO Dashboard* and click **Import workbook**.
  The file is parsed in the browser (SheetJS from cdnjs) and kept in this browser's local storage
  (`cu-os-book`). It is never uploaded or committed. **Clear local data** removes it.
* **Operate:** edit Roster Master records (inline or in the record view), move decisions through
  the Decision Board (Observing → … → Closed), adjust live position inventory, portal targets,
  scenarios, assumptions and reserves (True OTB calculates once all four reserves are entered),
  and log trigger events that re-underwrite the master record in the same step. Every change
  goes into the change log and can be undone.
* **Export:** **Export .xlsx** writes the live book (inputs and computed values) to a workbook
  that re-imports without loss.
* With no workbook loaded the OS runs on a synthetic sample book (`src/os/sample.ts`).
* `src/os/__tests__/os.test.ts` checks the engine against the real workbook's cached formula
  values when it is present at `reference/roster-capital-os.xlsx` (gitignored) or
  `$CU_OS_WORKBOOK`; that block is skipped otherwise.

## Commands

```bash
npm install          # .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:5173
npm run typecheck
npm test             # engine parity (needs the local reference file; skipped otherwise),
                     # sample-data model tests, and a render smoke test of every route
npm run build && npm run preview
```

## Layout

| Layer | Path | Responsibility |
|---|---|---|
| Data model | `src/data` | `CuData` types, dataset loading, synthetic sample, 26-27 book import (SheetJS) |
| Analytics engine | `src/engine` | Pure functions: model, markets, CUBSMI, bands and quotes, lifecycle (KM), flows, heat, concentration, maturity, tape, alerts, DQ, underwriting, scenarios |
| Application state | `src/state/store.ts` | One external store (`useSyncExternalStore`), memoised model, persisted slices (`cu-bsm-state`) |
| Source / audit | `src/audit` + `Money` in `src/ui` | Number → records → contract episodes → source file › sheet › row drawer; audit log |
| UI kit | `src/ui` | Panels, KPIs, tables (sort, CSV), selects, SVG charts |
| Shell | `src/shell` | Hash router, route registry, nav, top bar + ticker, command bar, rail, tooltips |
| Screens | `src/screens` | One module per navigation section |
| Roster Capital OS | `src/os`, `src/screens/os.tsx` | Operating book types, workbook formula engine, workbook import/export, sample book, undoable store |
