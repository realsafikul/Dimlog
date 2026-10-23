export type UserRole = 'none' | 'view' | 'editor' | 'full';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export interface UserProfile {
  uid: string;
  username: string;
  displayName?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isAdmin?: boolean;
  createdAt: number;
  approvedAt?: number;
  approvedBy?: string;
}

export interface LogEntry {
  id: string;
  type: 'out' | 'in';
  ts: number; // Unix timestamp in ms
  note?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: number;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: number;
}

export interface TrashEntry {
  id: string;
  originalLog: LogEntry;
  deletedBy: string;
  deletedByName: string;
  deletedAt: number;
  originalPath: string; // 'logs'
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

