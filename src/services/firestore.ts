import { 
  ref, 
  onValue, 
  set, 
  push, 
  remove, 
  update, 
  get, 
  Database 
} from 'firebase/database';
import { db } from '../firebase.js';
import { LogEntry, AppSettings } from '../types';

export interface PowerStatusDoc {
  isOutage: boolean;
  outAt: number | null;
  updatedAt: number;
}

/**
 * Real-time listener for current power grid status
 */
export function subscribeToPowerStatus(
  onUpdate: (data: PowerStatusDoc | null) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    const err = new Error('Firebase database instance is not initialized.');
    console.error('[Firestore Error]:', err);
    if (onError) onError(err);
    return () => {};
  }

  try {
    const statusRef = ref(db, 'power_status');
    return onValue(
      statusRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          onUpdate({
            isOutage: !!val.isOutage,
            outAt: typeof val.outAt === 'number' ? val.outAt : null,
            updatedAt: Number(val.updatedAt) || Date.now(),
          });
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error('[Firestore Error] subscribeToPowerStatus failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firestore Error] subscribeToPowerStatus exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for all outage & restoration logs
 */
export function subscribeToOutageLogs(
  onUpdate: (logs: LogEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    const err = new Error('Firebase database instance is not initialized.');
    console.error('[Firestore Error]:', err);
    if (onError) onError(err);
    return () => {};
  }

  try {
    const logsRef = ref(db, 'logs');
    return onValue(
      logsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const items: LogEntry[] = [];
          Object.keys(data).forEach((key) => {
            const item = data[key];
            if (item) {
              items.push({
                id: item.id || key,
                type: item.type === 'out' ? 'out' : 'in',
                ts: Number(item.ts) || Date.now(),
                note: item.note || undefined,
              });
            }
          });
          // Sort chronologically
          items.sort((a, b) => a.ts - b.ts);
          onUpdate(items);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        console.error('[Firestore Error] subscribeToOutageLogs failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firestore Error] subscribeToOutageLogs exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Toggle / record a power outage or restoration event directly in Firebase
 */
export async function recordPowerEventFirestore(
  type: 'out' | 'in',
  ts: number,
  note?: string
): Promise<string> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firestore Error] recordPowerEventFirestore:', err);
    throw err;
  }

  try {
    const isOut = type === 'out';
    const logsRef = ref(db, 'logs');
    const newDocRef = push(logsRef);
    const entryId = newDocRef.key || `log-${ts}-${Date.now()}`;

    const updates: Record<string, any> = {};
    updates['power_status'] = {
      isOutage: isOut,
      outAt: isOut ? ts : null,
      updatedAt: Date.now(),
      updatedBy: 'operator',
    };
    updates[`logs/${entryId}`] = {
      id: entryId,
      type,
      ts,
      note: note || '',
      createdAt: Date.now(),
    };

    await update(ref(db), updates);
    return entryId;
  } catch (error: any) {
    console.error('[Firestore Error] Failed to record power event:', error);
    throw error;
  }
}

/**
 * Add or edit a manual outage entry
 */
export async function saveManualLogEntryFirestore(
  entry: { id?: string; type: 'out' | 'in'; ts: number; note?: string },
  isLatest = false
): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firestore Error] saveManualLogEntryFirestore:', err);
    throw err;
  }

  try {
    const entryId = entry.id && !entry.id.startsWith('manual-')
      ? entry.id
      : (push(ref(db, 'logs')).key || `entry-${entry.ts}`);

    const updates: Record<string, any> = {};
    updates[`logs/${entryId}`] = {
      id: entryId,
      type: entry.type,
      ts: entry.ts,
      note: entry.note || '',
      updatedAt: Date.now(),
    };

    if (isLatest) {
      updates['power_status'] = {
        isOutage: entry.type === 'out',
        outAt: entry.type === 'out' ? entry.ts : null,
        updatedAt: Date.now(),
      };
    }

    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firestore Error] Failed to save manual log entry:', error);
    throw error;
  }
}

/**
 * Delete a log entry from Firebase
 */
export async function deleteLogEntryFirestore(
  docId: string,
  remainingLogs: LogEntry[]
): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firestore Error] deleteLogEntryFirestore:', err);
    throw err;
  }

  try {
    const updates: Record<string, any> = {};
    updates[`logs/${docId}`] = null;

    const sorted = remainingLogs.filter((e) => e.id !== docId).sort((a, b) => a.ts - b.ts);
    const last = sorted[sorted.length - 1];

    updates['power_status'] = {
      isOutage: last ? last.type === 'out' : false,
      outAt: last && last.type === 'out' ? last.ts : null,
      updatedAt: Date.now(),
    };

    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firestore Error] Failed to delete log entry:', error);
    throw error;
  }
}

/**
 * Clear all logs and reset power status in Firebase
 */
export async function clearAllLogsFirestore(): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firestore Error] clearAllLogsFirestore:', err);
    throw err;
  }

  try {
    const updates: Record<string, any> = {
      logs: null,
      power_status: {
        isOutage: false,
        outAt: null,
        updatedAt: Date.now(),
      },
    };
    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firestore Error] Failed to clear all logs:', error);
    throw error;
  }
}
