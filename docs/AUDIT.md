# CU Buy-Side Capital Manager — Functional Audit

Audit of the single-file HTML reference application (`reference/cu-buyside-capital-manager.html`,
kept local and **gitignored** because it embeds restricted athlete-level data). This document
inventories every page, route, calculation, chart, data object, lifecycle model, index,
underwriting tool, transaction workflow, lifetime-capital calculation, source-control feature
and interaction. It deliberately contains no athlete names or athlete-level dollar figures.

The React + TypeScript refactor in `app/` must reproduce everything listed here; the parity test
(`app/src/engine/__tests__/parity.test.ts`) checks the engine numerically against the original.

---

## 1. Architecture of the reference file

| Layer | Original location | Role |
|---|---|---|
| Data | `window.CU_DATA` (inline JSON, ~800 KB) | players, contract episodes, third-party ledger, aliases, official rosters, file controls, Drive program data |
| State | global `S` | settings, filters, management assumptions, scenarios, comparison set, imported book, audit log |
| Utilities | `U` | sum / median / percentile (PERCENTILE.INC) / rank / grouping / formatting / month arithmetic / name normalisation |
| Model + analytics | `M`, `buildModel()`, `computeAnalytics()` → `M.A` | holdings, committed totals, market statistics, indexes, flows, heat, concentration, maturity, tape, alerts, data quality |
| Charts | `C` | hand-built SVG/HTML primitives |
| Shell | `NAV`, `R`, `route()`, `TRACE`, `TABLES`, `ACT` | hash router, sidebar, top bar, ticker, command bar, rail, tables, source-trace drawer, actions |
| Screens | `R.<name>(...args)` returning HTML, optional `R.<name>_after` binder | 76 screens (82 `R.*` entries including 6 binders) |
| Persistence | `localStorage['cu-bsm-state']` | `{assume, scenarios, compare}` |

Everything is recomputed by `refresh()` = `buildModel()` → `cmdIndex()` → `route()` whenever a
market-construction setting, an assumption or the imported book changes.

---

## 2. Data objects (`CU_DATA`)

| Object | Shape | Notes |
|---|---|---|
| `meta` | `asOf`, `built`, `sources[] {file,use,regime}`, `rosterUrls` | source hierarchy |
| `controls` | named numeric control cells from the source files | caps FY25-26 / FY26-27 / FY27-28 (est.), committed controls, Fall-25 spend (hard-coded vs formula), buyouts, forecast-tab totals, current-book totals |
| `reference.current2627Book` | caps, rows, buyout, cap, available, FY27-28 | the controlling current book |
| `players[]` (214) | `id, name, legal[], aliases[], seasons{2024,2025,2026:{onRoster,pos,bs,cls,school,acq}}, fallbackPos/Bs, lastPos, ticker, rslaStatus, elig, identity, offRosterNote, book{status,eligRem,history}` | canonical id = official roster name |
| `episodes[]` (514) | `id, pid, regime, season, kind, src, srcRaw, face, term, months{YYYY-MM:amt}, capital, capsBy{…}, status, signed, note, conf, …` | one row per agreement/amendment |
| `thirdParty[]` (24) | `pid, src, package, cuBase, paradigma, incentives, conf` | separate ledger, never added to CAPS |
| `aliases` (279) | normalised name → canonical id | used by name resolution / import |
| `rosters{2024,2025,2026}` | `{name,pos,cls,school}[]` (112 / 106 / 104) | official cubuffs.com rosters |
| `drive` | sources, capacity class, tiers, BSM grid, exposure types, shares, Big 12 reference, paid-to-date, master control rows, maturity, windows, utilization, budget, scenarios, stress, architecture, incoming class, Frampton draft, incentives, buyouts, games/EGR, rooms, season scenarios, 2027 schedule, operating calendar | Drive program data; every block carries `src {title,url,key}` |

### Episode kinds

| Kind | Season | Capital key | Meaning |
|---|---|---|---|
| `COLLECTIVE_2024` | 2024 | `COLL24` | collective scheduled payments Jun-24→May-25 |
| `COLLECTIVE_SP25` | 2025 | `SP25` | Spring-25 transition contracts — own episode, excluded from markets and lifetime months |
| `RSLA` | 2025 | `FY25-26`, `FY26-27(RSLA)`, `FY27-28(RSLA)` | institutional Y1 incl. amendment rows (`amend` ≥ 1) |
| `BUYOUT` | 2025 / 2026 | `FY25-26` / `FY26-27` | buyout installments, outside athlete CAPS |
| `SNAP26` | 2026 | `snap{FY26-27,F26,S27,FY27-28,SP26}` | Spring-26 forecast snapshot — history only, never counted |
| `FCST26` | 2026 | `FY26-27, F26, S27, FY27-28` | **controlling** current 26-27 book (`book:true`) |
| `IMPORT26` / imported `FCST26` | 2026 | as FCST26 | session import replacing the book |

Confidence labels: `VERIFIED`, `RECONCILED`, `ESTIMATED`, `FORECAST`, `NEEDS REVIEW`.

---

## 3. Engine (model + analytics)

### 3.1 Constants
`POSMAP` (official position → Buy-Side group), `GROUPS`, `COMPOSITE {SEC:[CB,S,DB]}`, 15 `TICKERS`
(`CUQB … CUSN`, `CUSEC` composite), `INDEX_UNIVERSE` (QB RB WR TE OL DL EDGE LB SEC), `SEASONS`
2024–2026, `SEASON_FY`, `SEASON_LABEL`, `REGIME`, `FY_MONTHS` (2024: Jun-24→May-25, 2025: Jul-25→Jun-26,
2026: Jul-26→Jun-27), `AS_OF = 2026-09-30`.

### 3.2 Default settings (`S`)
threshold $10,000 · metric `fy` · minN 3 · lowN 5 · band basis `pooled` · includeEarly false ·
fy 2026 · filters {season 2026, pos/acq/status/tier ALL, view core} · assumptions
{bid/target/auth/walk/reserve/top5/roomShare null, maturityDays 60, yoyAlert 10}.

### 3.3 `buildModel()`
1. `M.episodes` = data episodes, minus `FCST26` when a book is imported, plus imported episodes.
2. **Holdings** — one per player per season, from the season's controlling kind
   (2024 `COLLECTIVE_2024`, 2025 `RSLA`, 2026 `FCST26`): capital = Σ `capsBy[capKey]` (rounded to cents);
   `monthMap` = positive months inside the FY window; `face` = max face; `term` = last non-null term;
   `statusRaw`; `conf` (`NEEDS REVIEW` wins); `months` = count of paid months; `perMonth`; `m12 = capital/months×12`.
3. `mkHolding` — position: season roster pos → (2025 early enrollee: next-season pos, `early=true`) →
   (2026: prior-season pos) → (2024: episode `filePos`) → `fallbackPos`; acquisition channel from the
   season roster (early → next season; off-roster note → PORTAL; else UNKNOWN); flags `inSeason`, `onNext`, `onPrev`.
4. `M.committed` — 2024 Σ holdings; 2025 Σ holdings + 2025 buyouts; 2026 Σ holdings + 2026 buyouts' `FY26-27`.
5. `M.fy2728` = Σ `FY27-28` over `FCST26`/`IMPORT26` episodes.
6. **Lifetime player months** `M.pMonths` — all episodes except buyouts and `COLLECTIVE_SP25`;
   RSLA months ≥ Jul-26 dropped (superseded by the FY26-27 book).

### 3.4 Market observations & statistics
* `obs(s, g, {view, metric, anyRoster, acq})` — holdings in group, capital ≥ threshold (core) or > 0 (all),
  on that season's roster (or early enrollee if `includeEarly`), value = metric (FY CAPS / 12-month eq / per month).
* `stats()` — n, total, mean, median, P10/25/40/50/60/75/90, min, max (linear interpolation).
* `acqBucket()` — RETAINED / HS / JUCO / PORTAL / UNKNOWN.

### 3.5 Analytics (`M.A`)
| Output | Calculation |
|---|---|
| `market[g][s]` | stats of `obs`, plus room capital (all holdings in group), room count (in-season or early), paid (≥ threshold), paidAll (> 0), room list |
| `index[g][s]` | position index = 100 × median_s ÷ median_2024; N/A when either N < minN; `low` flag when N < lowN |
| `cubsmi.price[s]` | Laspeyres: weights w_p = 2024 core capital for universe positions with 2024 N ≥ lowN; level = 100 Σ w·rel ÷ Σ w over positions with N ≥ lowN in s; coverage; contribution points = 100·(w/Σw)·(rel−1) |
| `cubsmi.capital[s]` | 100 × core capital_s ÷ core capital_2024 |
| `cubsmi.term[s]` | 100 × median compensated months ÷ 2024 |
| `life` | presence per player; acquisition cohorts (on roster, not RETAINED); `km(filter, capital)` season-grain Kaplan–Meier: S12 pooled over 2024+2025 cohorts, S24 = S12 × conditional 2024-cohort survival, half-life label |
| `flow[2025\|2026][g]` | prev/cur paid core, departed, returning, retainedPaid, newAcq, retCur; player churn, capital churn, persistence, acquisition churn, retention premium (median Δ), median retained/acquired/portal/HS/JUCO/departed, replacement ratio, replacement premium (abs & %), acquisition premium |
| `heat[g]` | 7 components linearly scaled 0–100 (YoY median, replacement premium, capital churn, acquisition demand, capital growth, internal supply shortfall, maturity exposure ≤ Dec-26); score = mean when ≥ 3 observable; LOW/MODERATE/ACTIVE/TIGHT/EXTREME |
| `conc[s]` | sorted paid holdings, top-1/5/10/20 shares, Lorenz points, per-position total/top-1/top-3/lead |
| `maturity` | per FY26-27 holding: final scheduled month, paid-to-date and remaining vs `AS_OF`, FY27-28; bucket (MATURED, 30D, 60D, 90D·DEC, SPRING, JUNE, 12M, 18M, >18M); wall totals; monthly institutional cash (RSLA months ≥ Jul-26 excluded) |
| `tape` | transaction events (see §6) sorted by date desc with delta |
| `alerts` | see §8 |
| `dq` | data-quality register (see §9) |

### 3.6 Bands & quotes
* `bandPool(g, basis)` — pooled seasons / institutional 2025–26 / single season.
* `bands()` — EXCEPTION > P90 · PREMIUM P75–P90 · STARTER P60–P75 · ROTATION P40–P60 · DEPTH P25–P40 · DEVELOPMENT < P25.
* `bandOf(g, v)` — `—` when N < minN.
* `quote(g)` — BID/TARGET/AUTH/WALK = percentiles of the pool at the management anchors; null until all four anchors are set.

---

## 4. Pages and routes (hash router `#/<name>/<args…>`)

| § | Page | Route | Key content |
|---|---|---|---|
| 01 | Executive Dashboard | `home` | 6 KPIs (roster capital, utilization, dry powder, active assets, paid assets, CUBSMI) with sparks; allocation bars; capital stack; market board; concentration; maturity; churn; persistence; latest tape; forward strip (season record, game rate, December set, FY27-28 spoken-for, room to target, next board item) |
| 01 | Portfolio Overview | `portfolio` | treemap by position, acquisition-mix stacked bars, room table |
| 01 | Daily Capital Brief | `brief` | generated narrative (capital, market moves, maturities, churn, alerts) + recent events |
| 01 | Market Monitor | `monitor` | CUBSMI chart, heat tiles, market board |
| 01 | Alerts | `alerts` | alert register + rule text |
| 01 | Tracking Registry | `tracking` | 21 tracked measures (historical/current/forward) with live values and links |
| 02 | CU Buy-Side Market Index | `cubsmi` | headline index, history (price/capital/term/replacement/retention), contribution bars, breakdown table, constituent board |
| 02 | Position Markets | `positions`, `pos/<TICKER>/<TAB>` | board; per-ticker terminal with tabs PRICE · CAPITAL · TENURE · CHURN · ACQUISITION · RETENTION · REPLACEMENT |
| 02 | Market Heat Map | `heat` | tiles + component table |
| 02 | Price Curves | `curves` | box plots, histogram, capital-vs-term scatter (filter bar) |
| 02 | Historical Markets | `historical/<season>/<g>` | season market table, optional focus note |
| 02 | Market Movers | `movers` | price risers/decliners, capital risers, churn risers |
| 02 | Market Comparables | `comparables` | position × channel median matrix |
| 02 | Game Capital · EGR | `games` | schedule/results/marks, game capital rate (book month ÷ games), EGR travel table, marks |
| 03 | Active Roster | `roster` | filtered holdings table (17 columns) |
| 03 | Position Rooms | `rooms`, `room/<g>` | tiles; room page with KPIs, treemap, replacement requirement, holdings |
| 03 | Capital Allocation | `allocation` | current bars, historical stacked shares, YoY table, two waterfalls (cap bridge, year bridge with residual) |
| 03 | Portfolio Exposure | `exposure` | current share − 2024–25 average share |
| 03 | Capital Concentration | `concentration/<season>` | top-N KPIs, Lorenz, per-position, largest holdings |
| 03 | Roster Construction | `construction` | players by channel and by band; roster members without core capital |
| 03 | Roster Changes | `changes` | 2025→2026 additions and exits |
| 03 | Room Dispositions | `dispositions` | dispositions, share vs Master Deck vs Big 12 reference |
| 03 | Incentive Exposure | `incentives` | headline / expected / floor-ceiling / book incentives, exposure types |
| 04 | Player Securities | `securities` | security master |
| 04 | Player Search | `search/<q>` | normalised fuzzy search over id/aliases/legal/ticker (debounced input) |
| 04 | Player security page | `player/<id>` | KPIs, monthly capital history with events, percentile bar, lifecycle, roster history, contract episodes, 26-27 book record, third-party package, transactions |
| 04 | Player Comparables | `pcompare` | up to 5 athletes side by side (persisted) |
| 04 | Contract History | `contracts` | all episodes |
| 04 | Lifecycle | `plifecycle` | program / economic / contract clocks, lifetime capital |
| 04 | Eligibility | `eligibility` | eligibility register incl. FY27-28 |
| 05 | Transaction Tape | `tape/<ACTION>/<YEAR>` | blotter; sub-pages BUY, RETAIN, RENEW (incl. INCREASE/REDUCE), AMEND, TERMINATE, EXIT, BUYOUT |
| 05 | Buyout Ledger | `buyouts` | register + ledger lines |
| 06 | Roster Tenure | `tenure` | median seasons by group; survival |
| 06 | Economic Tenure | `economic` | median compensated months; capital-vs-tenure scatter |
| 06 | Contract Tenure | `ctenure` | term by position, histogram, table |
| 06 | Roster Survival | `survival` | KM curves by position and channel, table |
| 06 | Capital Half-Life | `halflife` | leaderboard |
| 06 | Cohort Analysis | `cohorts` | cohort table |
| 07 | Player Underwriter | `underwrite/<g>` | form → market, assessment, quote, capital impact |
| 07 | Position Underwriter | `posunderwrite` | bands and quotes for every position |
| 07 | Retention vs Replacement | `retrep/<g>` | retention vs acquisition markets, spread |
| 07 | Replacement Cost | `replace/<id>` | four scenarios, historical replacements |
| 07 | Deal Builder | `deal` | formula or manual monthly schedule → FY impact, percentile, band |
| 07 | Offer Calculator | `offer` | ask → ladder, quote |
| 07 | Walk-Away Analysis | `walkaway` | walk by position, exception deals > P90 |
| 07 | Pipeline (Proposed) | `pipeline` | incoming class vs 5% standard, live offer draft |
| 07 | BSM Reference Grid | `bsmgrid` | illustrative grid vs observed tiers, capacity class |
| 08 | Capital Forecast | `forecast` | monthly outflows with FY-cumulative line, FY capacity, FY27-28 obligations |
| 08 | Roster Forecast | `rforecast` | roll-off indicator by position |
| 08 | Maturity Wall | `maturity/<days>` | buckets, released capital, maturing agreements |
| 08 | Future Obligations | `obligations` | FY26-27 + FY27-28 per player |
| 08 | Scenario Manager | `scenarios` | named scenarios with remove / set / add / scale ops (persisted) |
| 08 | What-If Analysis | `whatif` | room % change + add $ |
| 08 | Dry Powder Forecast | `drypowder` | unspent cap by month |
| 08 | December Decision Set | `december` | live classification CONTINUES / EXHAUSTED / RENEW-REPLACE |
| 08 | FY27-28 Forward Plan | `plan2728` | windows, utilization target, architecture, season scenarios |
| 08 | Budget & Stress | `budget` | allocation scenarios, S0–S3, stress A–D |
| 08 | Forecast vs Book | `fvb` | snapshot→book bridge, moves, detail |
| 09 | Historical Transactions | `htx` | full tape |
| 09 | Position Studies | `studies` | ticker tiles with sparks |
| 09 | Market Index Methodology | `methodology` | formulas and rules |
| 09 | Internal Comparables | `icomps/<id>` | 15 nearest transactions by log distance |
| 09 | Year-over-Year Analysis | `yoy` | medians, six line charts, YoY decomposition (price / population / term / turnover / residual) |
| 09 | Cohort Research | `cohortres` | roster vs capital survival by cohort/channel |
| 10 | Data Quality | `dq/<sev>` | severity counters, register, ledger confidence |
| 10 | Source Reconciliation | `recon` | 12 control-vs-computed rows; XLSX/CSV re-import of the 26-27 book |
| 10 | Position Crosswalk | `crosswalk` | POSMAP, position changes |
| 10 | Name Resolution | `names` | identity map |
| 10 | Assumptions | `assumptions` | quote anchors, thresholds |
| 10 | Market Settings | `settings` | threshold, minN, lowN, band basis, metric, early enrollees |
| 10 | Audit Log | `audit` | session events |
| 10 | Operating Calendar | `calendar` | phases, upcoming events with T-minus, standing structure |
| 10 | Drive Sources | `sources` | source catalog |

Unknown routes fall back to `home`; screen exceptions render a "Screen error" note.

---

## 5. Charts (`C`)
`hbars` (HTML), `line` (categorical x, base line, label de-collision), `dots` (jittered strip plot over band zones),
`stacked` (100% or absolute), `waterfall` (start/step/end with connectors), `treemap` (squarified),
`survival` (step curves at 0/12/24 mo + half-life line), `lorenz`, `box`, `hist` (with proposal mark),
`spark`, `monthBars` (as-of greying, optional cumulative line), `scatter`, `capstack`, `pctBar` (percentile ladder + marker).
Every mark may carry `data-tip` (tooltip) and `data-go` (drill-down route).

## 6. Transaction workflow (tape)
| Source | Action rule | Date |
|---|---|---|
| COLLECTIVE_2024 | RETAIN if 2024 acq RETAINED else BUY | first scheduled month |
| COLLECTIVE_SP25 | AMEND / RENEW (had 2024 holding) / BUY / TERMINATE (cancel) by status text | signed date else first month |
| RSLA | AMEND (amend > 0) / RETAIN / BUY; plus TERMINATE / EXPIRE / AMEND (revoked) parsed from status date | signed/sent date else first month |
| FCST26 / IMPORT26 | BUY (new) / INCREASE / REDUCE / RENEW vs FY25-26 holding | FY-dated |
| BUYOUT | BUYOUT | Jan-26 (FY25-26) / FY26-27 |
| Roster exit | EXIT for paid in-season players absent from next official roster | offseason |

## 7. Lifetime-capital calculation
`pMonths[pid]` sums positive scheduled months over all episodes except BUYOUT and COLLECTIVE_SP25,
dropping RSLA months ≥ Jul-26. Lifetime = Σ months; economic tenure = count of positive months;
cap per compensated month = lifetime ÷ count. The player page traces lifetime to each episode.

## 8. Alerts
Median YoY beyond ±`yoyAlert`%; holding above pooled position P90 (N ≥ lowN); maturities within
`maturityDays` (30/60/90 → Oct/Nov/Dec-26); top-5 concentration > threshold; dry powder < reserve (crit);
room share > threshold; imported book (dq); next calendar event; FY27-28 spoken-for; December decision set.

## 9. Source / audit layer
* **Source trace** — every `money()` value registers trace items `{pid, eid, amount, src?}`; clicking opens a
  drawer: number → players → episodes → source file › sheet › row → source name → confidence.
* **Tables** — sortable headers (numeric columns default descending), CSV export (uses `raw` → `v` → stripped `f`).
* **Audit log** — `logAudit()` on session open, setting changes, CSV export, comparison, scenarios, anchors, import.
* **Data-quality register** — fixed reconciliation items, unverified identities, missing positions,
  revoked/superseded episodes, third-party records, status-label conflicts, zero-value book records,
  future-dated signatures, season-grain and date-coerced eligibility caveats.
* **Reconciliation** — computed totals vs file control cells with difference.
* **Import** — XLSX/CSV via SheetJS from cdnjs; header detection, month columns, amendment rows,
  alias + Levenshtein (≥ 0.88) name resolution, unmatched list, revert.

## 10. Interactions
Hash routing & back/forward · sidebar collapse · intelligence rail toggle · command bar (`/` to focus,
arrows, Enter, Esc; tickers, players, `MAT n`, `CHURN g`, `UNDERWRITE g`, year tapes) · scrolling ticker
tape (pauses on hover, reduced-motion aware) · FY selector · filter bar (season, position, acquisition,
status, tier, view, metric) · segmented controls · `data-navsel` route selects · hover tooltips ·
drill-down on any mark/row · trace drawer (Esc closes) · sortable tables · CSV export · forms on
underwriting, deal, offer, scenario, what-if, assumptions, settings · file import · localStorage persistence.

## 11. Known data observations (no athlete detail)
* Spring-26 snapshot SP26 column total differs from the forecast-tab "Sp26 committed" control; the app
  does not reconcile that control (shown here for completeness).
* Fall-25 spend: hard-coded control vs formula differ by $99.97 (flagged in DQ).
* FY27-28: book CAPS column exceeds scheduled months by $12,890 hard-coded on 7 rows (flagged).
* Several Drive figures are stale vs the book (RCMS September spend) and are flagged in DQ.
