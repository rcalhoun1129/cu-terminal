/** Inputs to the engine. Everything the reference app read from the global `S` while computing. */
export type Metric = 'fy' | '12m' | 'month';
export type BandBasis = 'pooled' | 'inst' | '2024' | '2025' | '2026';
export type View = 'core' | 'all';

export interface Assumptions {
  bid: number | null; target: number | null; auth: number | null; walk: number | null;
  reserve: number | null; top5: number | null; roomShare: number | null; maturityDays: number; yoyAlert: number;
}
export interface Filters { season: 2024 | 2025 | 2026; pos: string; acq: string; status: string; tier: string; regime: string; view: View }

export interface EngineSettings {
  threshold: number; metric: Metric; minN: number; lowN: number; band: BandBasis; includeEarly: boolean;
  view: View; assume: Assumptions;
}

export const DEFAULT_ASSUME: Assumptions = { bid: null, target: null, auth: null, walk: null, reserve: null, top5: null, roomShare: null, maturityDays: 60, yoyAlert: 10 };
export const DEFAULT_FILTERS: Filters = { season: 2026, pos: 'ALL', acq: 'ALL', status: 'ALL', tier: 'ALL', regime: 'ALL', view: 'core' };
export const DEFAULT_ENGINE: EngineSettings = {
  threshold: 10000, metric: 'fy', minN: 3, lowN: 5, band: 'pooled', includeEarly: false, view: 'core', assume: { ...DEFAULT_ASSUME },
};
