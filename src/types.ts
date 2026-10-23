export interface LogEntry {
  id: string;
  type: 'out' | 'in';
  ts: number; // Unix timestamp in ms
  note?: string;
}

export interface LegacyAppState {
  log: Array<{ type: 'out' | 'in'; ts: number; id?: string; note?: string }>;
  outAt: number | null;
}

export interface AppSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  fuelRateLitersPerHour: number;
  fuelCostPerLiter: number;
  currencySymbol: string;
}

export interface OutageSegment {
  outTs: number;
  inTs: number;
  live: boolean;
  durationMinutes: number;
  fuelEstimateLiters: number;
  costEstimate: number;
}
