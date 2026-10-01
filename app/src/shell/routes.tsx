/* Route registry: hash route name → screen. Same names and argument order as the reference R[name](...args). */
import type { ComponentType } from 'react';
import { Alerts, Brief, Home, Monitor, Portfolio } from '../screens/command';
import { Comparables, Cubsmi, Curves, HeatScreen, Historical, Movers, Pos, Positions } from '../screens/markets';
import { Allocation, Changes, Concentration, Construction, Exposure, Room, Rooms, Roster } from '../screens/portfolio';
import { Contracts, Eligibility, PCompare, PLifecycle, PlayerScreen, Search, Securities, Tape } from '../screens/players';
import { CTenure, Cohorts, Economic, HalfLife, SurvivalScreen, Tenure } from '../screens/lifecycle';
import { Deal, Offer, PosUnderwrite, Replace, RetRep, Underwrite, Walkaway } from '../screens/underwrite';
import { DryPowder, Forecast, Maturity, Obligations, RForecast, Scenarios, WhatIf } from '../screens/forecast';
import { CohortRes, Htx, IComps, Methodology, Studies, Yoy } from '../screens/research';
import { AssumptionsScreen, AuditScreen, Crosswalk, Dq, Names, Recon, SettingsScreen } from '../screens/control';
import { BsmGrid, Budget, Buyouts, Calendar, December, Dispositions, Fvb, Games, Incentives, Pipeline, Plan2728, Sources, Tracking } from '../screens/program';

export type Screen = ComponentType<{ args: string[] }>;
const noArgs = (C: ComponentType): Screen => () => <C />;

export const ROUTES: Record<string, Screen> = {
  home: noArgs(Home), portfolio: noArgs(Portfolio), brief: noArgs(Brief), monitor: noArgs(Monitor), alerts: noArgs(Alerts), tracking: noArgs(Tracking),
  cubsmi: noArgs(Cubsmi), positions: noArgs(Positions), pos: Pos, heat: noArgs(HeatScreen), curves: noArgs(Curves), historical: Historical, movers: noArgs(Movers), comparables: noArgs(Comparables), games: noArgs(Games),
  roster: noArgs(Roster), rooms: noArgs(Rooms), room: Room, allocation: noArgs(Allocation), exposure: noArgs(Exposure), concentration: Concentration, construction: noArgs(Construction), changes: noArgs(Changes),
  dispositions: noArgs(Dispositions), incentives: noArgs(Incentives),
  securities: noArgs(Securities), search: Search, player: PlayerScreen, pcompare: noArgs(PCompare), contracts: noArgs(Contracts), plifecycle: noArgs(PLifecycle), eligibility: noArgs(Eligibility),
  tape: Tape, buyouts: noArgs(Buyouts),
  tenure: noArgs(Tenure), economic: noArgs(Economic), ctenure: noArgs(CTenure), survival: noArgs(SurvivalScreen), halflife: noArgs(HalfLife), cohorts: noArgs(Cohorts),
  underwrite: Underwrite, posunderwrite: noArgs(PosUnderwrite), retrep: RetRep, replace: Replace, deal: noArgs(Deal), offer: noArgs(Offer), walkaway: noArgs(Walkaway), pipeline: noArgs(Pipeline), bsmgrid: noArgs(BsmGrid),
  forecast: noArgs(Forecast), rforecast: noArgs(RForecast), maturity: Maturity, obligations: noArgs(Obligations), scenarios: noArgs(Scenarios), whatif: noArgs(WhatIf), drypowder: noArgs(DryPowder),
  december: noArgs(December), plan2728: noArgs(Plan2728), budget: noArgs(Budget), fvb: noArgs(Fvb),
  htx: noArgs(Htx), studies: noArgs(Studies), methodology: noArgs(Methodology), icomps: IComps, yoy: noArgs(Yoy), cohortres: noArgs(CohortRes),
  dq: Dq, recon: noArgs(Recon), crosswalk: noArgs(Crosswalk), names: noArgs(Names), assumptions: noArgs(AssumptionsScreen), settings: noArgs(SettingsScreen), audit: noArgs(AuditScreen),
  calendar: noArgs(Calendar), sources: noArgs(Sources),
};

/** Parse a decoded hash path into a known route name (unknown → home) and its arguments. */
export function parseRoute(h: string): { name: string; args: string[] } {
  const parts = h.split('/'); const name = parts[0];
  return ROUTES[name] ? { name, args: parts.slice(1) } : { name: 'home', args: parts.slice(1) };
}
