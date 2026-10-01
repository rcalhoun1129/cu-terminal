/* Data model for the CU Buy-Side Capital Manager. Mirrors window.CU_DATA in the reference app. */

export type Season = 2024 | 2025 | 2026;
export type SeasonKey = '2024' | '2025' | '2026';
export type Conf = 'VERIFIED' | 'RECONCILED' | 'ESTIMATED' | 'FORECAST' | 'NEEDS REVIEW' | string;
export type Acq = 'RETAINED' | 'PORTAL' | 'HS' | 'JUCO' | 'UNKNOWN';
export type MonthMap = Record<string, number>;

export interface SourceRef { title: string; url: string; key: string }

export interface PlayerSeason {
  onRoster: boolean; pos?: string | null; bs?: string | null; cls?: string | null; school?: string | null; acq: Acq | string;
}
export interface Player {
  id: string; name: string; legal: string[]; aliases: string[];
  seasons: Record<SeasonKey, PlayerSeason>;
  fallbackPos?: string | null; fallbackBs?: string | null; lastPos?: string | null;
  ticker: string; rslaStatus: string; elig: string; identity: string; offRosterNote?: string;
  book?: { status: string; eligRem: string; history: string } | null;
}

export type EpisodeKind = 'COLLECTIVE_2024' | 'COLLECTIVE_SP25' | 'RSLA' | 'BUYOUT' | 'SNAP26' | 'FCST26' | 'IMPORT26';
export interface Episode {
  id: string; pid: string; regime: string; season: number; kind: EpisodeKind;
  src: string; srcRaw?: string; face?: number | null; faceRaw?: string | null; face2023?: number | null;
  designation?: string; filePos?: string; term?: number | null; termRaw?: string | null;
  months: MonthMap; snapMonths?: MonthMap; snap?: Record<string, number>; snapBuyout?: boolean;
  capital: number; capsBy: Record<string, number>; incentives?: number;
  status?: string; rowStatus?: string; cuAction?: string; pdfStatus?: string; summerAdd?: boolean;
  signed?: string | null; sent?: string | null; created?: string | null; note?: string; conf: Conf;
  amend?: number; book?: boolean; imported?: boolean; eligRem?: string; history?: string; rslaVersion?: string; rslaMods?: string;
  baseFee?: number | null; incentivesTotal?: number | null;
}
export interface ThirdParty { pid: string; src: string; srcRaw: string; package: number; cuBase: number; paradigma: number; incentives: number; conf: Conf }
export interface RosterEntry { name: string; pos: string; cls: string; school: string }

export interface GameRow {
  g: number; date: string; month: string; opp: string; site: string; conf: string; status: string;
  result: string | null; cu: number | null; op: number | null; gamebook: string; participation: string;
  mark?: string; note?: string; markSrc?: string; resultSrc?: string; dq?: string;
}
/** Data-specific narrative notes that the reference app hard-coded. Kept with the data so code stays data-agnostic. */
export interface DqNote { sev: Conf; area: string; item: string; detail: string; pid?: string; eid?: string; slot?: 1 | 2 }

export interface Drive {
  sources: { key: string; title: string; url: string; modified: string; use: string }[];
  capacityClass: { class: string; range: string; basis: string; src: SourceRef; classes: [string, string][] };
  tiers: [string, string][];
  grid: { label: string; src: SourceRef; cols: string[]; rows: [string, ...([number, number] | null)[]][]; gridToBs: Record<string, string[]> };
  exposureTypes: string[];
  shares: { label: string; src: SourceRef; rows: [string, number, number][]; lines: { roster: number; capital: number; def: string } };
  big12: { label: string; src: SourceRef; rows: [string, number][] };
  paid: Record<string, unknown>;
  master: { src: SourceRef; rows: [string, number, string][] };
  maturity: { src: SourceRef; cols: string[]; rows: [string, number, number, number, number, number][]; total: number[];
    shares: { maturing: number; renew: number; exhausted: number; nRenew: number; nExhausted: number; nSpring: number }; stress: [string, number][] };
  windows: { src: SourceRef; w1: [string, number, number][]; w23: [string, number, number][] };
  utilization: { src: SourceRef; low: number; high: number; mid: number; growth: number; alloc: number; executed: number; proposed: number; variance2728: number;
    ceilLow: number; ceilHigh: number; allowLow: number; allowHigh: number; reserveLow: number; reserveHigh: number; cashJulDec27: number; carryJanJun28: number };
  budget: { src: SourceRef; cols: string[]; label: string; rows: [string, ...number[]][] };
  scenarios: { src: SourceRef; label: string; rows: [string, number, number, number, number][]; premium: number };
  stress: { src: SourceRef; rows: [string, number, number, number, number, number][] };
  architecture: { src: SourceRef; ee: number[]; transfer: number[]; status: string; recs: string[] };
  klass: { src: SourceRef; status: string; stated: number; outline: number; spring: number; placeholder: number; variance: number; reconciled2728: number;
    propJan27: number; propJulDec27: number; propJanJun28: number; above: number; below: number; rows: [string, string, number, number, number, number][] };
  /** Live offer to a prospect (stored under a prospect-specific key in the source; normalised on load). */
  liveOffer: { src: SourceRef; status: string; name: string; cls: string; rs: number; bspNil: number; activation: number; max: number; months: MonthMap; note: string };
  incentives: { src: SourceRef; pool: number; floor: number; ceiling: number; expectedPct: [number, number]; expected: [number, number]; rows: [string, number, string][]; bookF26: number; note: string };
  buyouts: { src: SourceRef; term: string; rows: [string, string, number | null, string, string][] };
  games: { src: SourceRef; resultSrc: SourceRef; schedule: GameRow[]; method: string;
    egr: { src: SourceRef; game: string; travelCap: number; rate: number; pct: number; travelers: number; rows: [string, number | null, number, number | null, number][]; total: number };
    rcmsSept: number; marks: string[] };
  rooms: { src: SourceRef; rows: [string, string][]; reasons: string[]; reasonNote: string; traveled: number };
  seasonScen: { src: SourceRef; label: string; rows: [string, string, string, string][] };
  schedule2027: { src: SourceRef; text: string };
  calendar: { src: SourceRef; phases: [string, string][]; reserves: string[]; ccir: [string, string][]; readiness: string[]; events: [string, string, string][] };
}

export interface CuData {
  meta: { asOf: string; built: string; sources: { file: string; use: string; regime: string }[]; rosterUrls: Record<string, string>; synthetic?: boolean };
  controls: Record<string, number>;
  reference: { current2627Book: { label: string; caps: number; rows: number; buyout: number; cap: number; available: number; caps2728: number; cap2728: number; available2728: number; conf: string } };
  drive: Drive;
  players: Player[];
  episodes: Episode[];
  thirdParty: ThirdParty[];
  aliases: Record<string, string>;
  rosters: Record<SeasonKey, RosterEntry[]>;
  /** Fixed data-quality notes (see dq.ts). Optional: derived by the extractor for the reference dataset. */
  dqNotes?: DqNote[];
}

/** A session import of a newer 26-27 book (replaces FCST26 episodes). */
export interface ImportedBook {
  file: string; rows: number; total: number; episodes: Episode[]; unmatched: { raw: string; id: string }[]; months: number; newPlayers: Player[];
}
