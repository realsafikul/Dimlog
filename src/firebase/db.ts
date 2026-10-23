import { 
  ref, 
  set, 
  push, 
  remove, 
  update, 
  onValue, 
  get, 
  child, 
  Database 
} from 'firebase/database';
import { User } from 'firebase/auth';
import { LogEntry } from '../types';
import { db } from './config';

export interface PowerStatusPayload {
  isOutage: boolean;
  outAt: number | null;
  updatedAt: number;
  updatedBy?: string;
  updatedByEmail?: string;
}

export interface CloudLogEntry {
  id: string;
  type: 'out' | 'in';
  ts: number;
  note?: string;
  createdAt: number;
  createdBy?: string;
  createdByEmail?: string;
}

// Subscribe to real-time power status changes
export function subscribeToPowerStatus(
  database: Database,
  onUpdate: (status: PowerStatusPayload | null) => void,
  onError?: (err: Error) => void
) {
  const statusRef = ref(database, 'power_status');
  return onValue(
    statusRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.val());
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Firebase power_status subscription error:', error);
      if (onError) onError(error);
    }
  );
}

// Subscribe to real-time logs changes
export function subscribeToLogs(
  database: Database,
  onUpdate: (logs: LogEntry[]) => void,
  onError?: (err: Error) => void
) {
  const logsRef = ref(database, 'logs');
  return onValue(
    logsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: LogEntry[] = [];
        Object.keys(data).forEach((cloudKey) => {
          const item = data[cloudKey];
          list.push({
            id: item.id || cloudKey,
            type: item.type === 'out' ? 'out' : 'in',
            ts: Number(item.ts) || Date.now(),
            note: item.note || undefined,
          });
        });
        // Sort chronologically
        list.sort((a, b) => a.ts - b.ts);
        onUpdate(list);
      } else {
        onUpdate([]);
      }
    },
    (error) => {
      console.error('Firebase logs subscription error:', error);
      if (onError) onError(error);
    }
  );
}

// Toggle or update power cut state and log entry in one atomic operation
export async function recordPowerEventCloud(
  database: Database,
  type: 'out' | 'in',
  ts: number,
  currentUser?: User | null,
  note?: string
): Promise<{ success: boolean; entryId: string }> {
  const isOut = type === 'out';
  const newOutAt = isOut ? ts : null;

  const statusPayload: PowerStatusPayload = {
    isOutage: isOut,
    outAt: newOutAt,
    updatedAt: Date.now(),
    updatedBy: currentUser?.uid || 'anonymous',
    updatedByEmail: currentUser?.email || 'unauthenticated',
  };

  // Push new log entry with unique RTDB key
  const logsRef = ref(database, 'logs');
  const newLogRef = push(logsRef);
  const entryId = newLogRef.key || `cloud-${ts}-${Date.now()}`;

  const entryPayload: CloudLogEntry = {
    id: entryId,
    type,
    ts,
    note: note || undefined,
    createdAt: Date.now(),
    createdBy: currentUser?.uid || 'anonymous',
    createdByEmail: currentUser?.email || 'unauthenticated',
  };

  const updates: Record<string, any> = {};
  updates['power_status'] = statusPayload;
  updates[`logs/${entryId}`] = entryPayload;

  // Execute multi-path update in Firebase Realtime Database
  await update(ref(database), updates);

  return { success: true, entryId };
}

// Add or edit a specific manual entry
export async function saveManualEntryCloud(
  database: Database,
  entry: LogEntry,
  currentUser?: User | null,
  isLatest = false
): Promise<void> {
  const logsRef = ref(database, 'logs');
  const entryId = entry.id.startsWith('cloud-') || entry.id.startsWith('-') 
    ? entry.id 
    : (push(logsRef).key || `entry-${entry.ts}`);

  const payload: CloudLogEntry = {
    id: entryId,
    type: entry.type,
    ts: entry.ts,
    note: entry.note || undefined,
    createdAt: Date.now(),
    createdBy: currentUser?.uid || 'anonymous',
    createdByEmail: currentUser?.email || 'unauthenticated',
  };

  const updates: Record<string, any> = {};
  updates[`logs/${entryId}`] = payload;

  if (isLatest) {
    updates['power_status'] = {
      isOutage: entry.type === 'out',
      outAt: entry.type === 'out' ? entry.ts : null,
      updatedAt: Date.now(),
      updatedBy: currentUser?.uid || 'anonymous',
      updatedByEmail: currentUser?.email || 'unauthenticated',
    };
  }

  await update(ref(database), updates);
}

// Delete an entry from cloud
export async function deleteEntryCloud(
  database: Database,
  entryId: string,
  remainingLogs: LogEntry[],
  currentUser?: User | null
): Promise<void> {
  const updates: Record<string, any> = {};
  updates[`logs/${entryId}`] = null;

  // If the deleted item might affect the latest power status
  const sortedRemaining = [...remainingLogs].filter(e => e.id !== entryId).sort((a, b) => a.ts - b.ts);
  const lastEntry = sortedRemaining[sortedRemaining.length - 1];

  updates['power_status'] = {
    isOutage: lastEntry ? lastEntry.type === 'out' : false,
    outAt: lastEntry && lastEntry.type === 'out' ? lastEntry.ts : null,
    updatedAt: Date.now(),
    updatedBy: currentUser?.uid || 'anonymous',
    updatedByEmail: currentUser?.email || 'unauthenticated',
  };

  await update(ref(database), updates);
}

// Clear all logs from cloud
export async function clearAllCloud(
  database: Database,
  currentUser?: User | null
): Promise<void> {
  const updates: Record<string, any> = {
    logs: null,
    power_status: {
      isOutage: false,
      outAt: null,
      updatedAt: Date.now(),
      updatedBy: currentUser?.uid || 'anonymous',
      updatedByEmail: currentUser?.email || 'unauthenticated',
    },
  };
  await update(ref(database), updates);
}

// Migration tool with duplicate prevention
export async function migrateLocalEntriesToCloud(
  database: Database,
  localEntries: LogEntry[],
  currentUser: User | null,
  onProgress?: (processed: number, total: number) => void
): Promise<{ added: number; skipped: number }> {
  if (!localEntries.length) return { added: 0, skipped: 0 };

  // Fetch current existing logs from cloud to check for duplicates
  const snapshot = await get(ref(database, 'logs'));
  const existingCloudMap = new Map<string, boolean>();

  if (snapshot.exists()) {
    const data = snapshot.val();
    Object.values(data).forEach((item: any) => {
      const key = `${item.type}-${item.ts}`;
      existingCloudMap.set(key, true);
    });
  }

  let added = 0;
  let skipped = 0;
  const updates: Record<string, any> = {};

  for (let i = 0; i < localEntries.length; i++) {
    const entry = localEntries[i];
    const key = `${entry.type}-${entry.ts}`;

    if (existingCloudMap.has(key)) {
      skipped++;
    } else {
      const newKey = push(ref(database, 'logs')).key || `migrated-${entry.ts}-${i}`;
      updates[`logs/${newKey}`] = {
        id: newKey,
        type: entry.type,
        ts: entry.ts,
        note: entry.note || undefined,
        createdAt: Date.now(),
        createdBy: currentUser?.uid || 'migrator',
        createdByEmail: currentUser?.email || 'migrator',
      };
      existingCloudMap.set(key, true);
      added++;
    }

    if (onProgress) {
      onProgress(i + 1, localEntries.length);
    }
  }

  if (Object.keys(updates).length > 0) {
    // Sort local entries to compute latest status
    const sorted = [...localEntries].sort((a, b) => a.ts - b.ts);
    const latest = sorted[sorted.length - 1];
    if (latest) {
      updates['power_status'] = {
        isOutage: latest.type === 'out',
        outAt: latest.type === 'out' ? latest.ts : null,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || 'migrator',
        updatedByEmail: currentUser?.email || 'migrator',
      };
    }

    await update(ref(database), updates);
  }

  return { added, skipped };
}
