import type { Season } from '../data/types';

/** Official seasonal position → Buy-Side group. */
export const POSMAP: Record<string, string> = {
  QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', ATH: 'ATH', OL: 'OL', OT: 'OL', OG: 'OL', C: 'OL', IOL: 'OL', DL: 'DL', DT: 'DL', DE: 'EDGE',
  LB: 'LB', ILB: 'LB', OLB: 'LB', CB: 'CB', S: 'S', DB: 'DB', PK: 'PK', K: 'PK', 'PK/P': 'PK', P: 'P', 'P/PK': 'P', SN: 'SN', LS: 'SN',
};
export const GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'DB', 'PK', 'P', 'SN', 'ATH'];
export const COMPOSITE: Record<string, string[]> = { SEC: ['CB', 'S', 'DB'] };

export interface Ticker { t: string; g: string; name: string; composite?: boolean }
export const TICKERS: Ticker[] = [
  { t: 'CUQB', g: 'QB', name: 'Quarterback' }, { t: 'CURB', g: 'RB', name: 'Running Back' }, { t: 'CUWR', g: 'WR', name: 'Wide Receiver' },
  { t: 'CUTE', g: 'TE', name: 'Tight End' }, { t: 'CUOL', g: 'OL', name: 'Offensive Line' }, { t: 'CUDL', g: 'DL', name: 'Defensive Line (interior)' },
  { t: 'CUEDGE', g: 'EDGE', name: 'Edge / Defensive End' }, { t: 'CULB', g: 'LB', name: 'Linebacker' }, { t: 'CUCB', g: 'CB', name: 'Cornerback' },
  { t: 'CUS', g: 'S', name: 'Safety' }, { t: 'CUDB', g: 'DB', name: 'Defensive Back (generic)' }, { t: 'CUSEC', g: 'SEC', name: 'Secondary composite (CB+S+DB)', composite: true },
  { t: 'CUPK', g: 'PK', name: 'Placekicker' }, { t: 'CUP', g: 'P', name: 'Punter' }, { t: 'CUSN', g: 'SN', name: 'Snapper' },
];
export const INDEX_UNIVERSE = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'SEC'];
export const SEASONS: Season[] = [2024, 2025, 2026];
export const SEASON_FY: Record<number, string> = { 2024: 'COLL-24', 2025: 'FY25-26', 2026: 'FY26-27' };
export const SEASON_LABEL: Record<number, string> = {
  2024: '2024 · Collective', 2025: '2025 · FY25-26 Institutional Y1', 2026: '2026 · FY26-27 Institutional Y2 (current book)',
};
export const REGIME: Record<number, string> = { 2024: 'COLLECTIVE', 2025: 'INSTITUTIONAL Y1', 2026: 'INSTITUTIONAL Y2' };
export const FY_MONTHS: Record<number, [string, string]> = { 2024: ['2024-06', '2025-05'], 2025: ['2025-07', '2026-06'], 2026: ['2026-07', '2027-06'] };
export const CAPKEY: Record<number, string> = { 2024: 'COLL24', 2025: 'FY25-26', 2026: 'FY26-27' };
export const KIND_FOR: Record<number, string> = { 2024: 'COLLECTIVE_2024', 2025: 'RSLA', 2026: 'FCST26' };
export const AS_OF = '2026-09-30';
export const AS_OF_M = '2026-09';
export const PICK_G = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'DB', 'SEC', 'PK', 'P', 'SN'];
export const BANDS = ['EXCEPTION', 'PREMIUM', 'STARTER', 'ROTATION', 'DEPTH', 'DEVELOPMENT'] as const;
