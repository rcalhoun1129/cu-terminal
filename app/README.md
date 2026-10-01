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
