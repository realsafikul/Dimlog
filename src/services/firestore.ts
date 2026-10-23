import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
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
    console.error('[Firestore Error]: Firestore database instance is not initialized.');
    if (onError) onError(new Error('Firestore is not initialized. Check your environment variables.'));
    return () => {};
  }

  const statusDocRef = doc(db, 'power_status', 'current');
  return onSnapshot(
    statusDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as PowerStatusDoc);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('[Firestore Error] subscribeToPowerStatus failed:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Real-time listener for all outage & restoration logs
 */
export function subscribeToOutageLogs(
  onUpdate: (logs: LogEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    console.error('[Firestore Error]: Firestore database instance is not initialized.');
    if (onError) onError(new Error('Firestore is not initialized. Check your environment variables.'));
    return () => {};
  }

  const logsQuery = query(collection(db, 'outage_logs'), orderBy('ts', 'asc'));
  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const items: LogEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          type: data.type === 'out' ? 'out' : 'in',
          ts: Number(data.ts) || Date.now(),
          note: data.note || undefined,
        });
      });
      // Ensure sorted chronologically
      items.sort((a, b) => a.ts - b.ts);
      onUpdate(items);
    },
    (error) => {
      console.error('[Firestore Error] subscribeToOutageLogs failed:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Toggle / record a power outage or restoration event directly in Firestore
 */
export async function recordPowerEventFirestore(
  type: 'out' | 'in',
  ts: number,
  note?: string
): Promise<string> {
  if (!db) {
    const err = new Error('Firestore is not initialized. Check your environment variables.');
    console.error('[Firestore Error] recordPowerEventFirestore:', err);
    throw err;
  }

  try {
    const isOut = type === 'out';
    const statusDocRef = doc(db, 'power_status', 'current');
    const logsColRef = collection(db, 'outage_logs');

    // 1. Update the live power status document
    await setDoc(statusDocRef, {
      isOutage: isOut,
      outAt: isOut ? ts : null,
      updatedAt: Date.now(),
    });

    // 2. Add new record to outage_logs collection
    const newDoc = await addDoc(logsColRef, {
      type,
      ts,
      note: note || '',
      createdAt: Date.now(),
    });

    return newDoc.id;
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
    const err = new Error('Firestore is not initialized.');
    console.error('[Firestore Error] saveManualLogEntryFirestore:', err);
    throw err;
  }

  try {
    if (entry.id && !entry.id.startsWith('entry-') && !entry.id.startsWith('manual-')) {
      // Update existing document
      const docRef = doc(db, 'outage_logs', entry.id);
      await updateDoc(docRef, {
        type: entry.type,
        ts: entry.ts,
        note: entry.note || '',
        updatedAt: Date.now(),
      });
    } else {
      // Add new document
      await addDoc(collection(db, 'outage_logs'), {
        type: entry.type,
        ts: entry.ts,
        note: entry.note || '',
        createdAt: Date.now(),
      });
    }

    if (isLatest) {
      await setDoc(doc(db, 'power_status', 'current'), {
        isOutage: entry.type === 'out',
        outAt: entry.type === 'out' ? entry.ts : null,
        updatedAt: Date.now(),
      });
    }
  } catch (error: any) {
    console.error('[Firestore Error] Failed to save manual log entry:', error);
    throw error;
  }
}

/**
 * Delete a log entry from Firestore
 */
export async function deleteLogEntryFirestore(
  docId: string,
  remainingLogs: LogEntry[]
): Promise<void> {
  if (!db) {
    const err = new Error('Firestore is not initialized.');
    console.error('[Firestore Error] deleteLogEntryFirestore:', err);
    throw err;
  }

  try {
    await deleteDoc(doc(db, 'outage_logs', docId));

    // Update status if deleted item was the latest
    const sorted = remainingLogs.filter((e) => e.id !== docId).sort((a, b) => a.ts - b.ts);
    const last = sorted[sorted.length - 1];

    await setDoc(doc(db, 'power_status', 'current'), {
      isOutage: last ? last.type === 'out' : false,
      outAt: last && last.type === 'out' ? last.ts : null,
      updatedAt: Date.now(),
    });
  } catch (error: any) {
    console.error('[Firestore Error] Failed to delete log entry:', error);
    throw error;
  }
}

/**
 * Clear all logs and reset power status in Firestore
 */
export async function clearAllLogsFirestore(): Promise<void> {
  if (!db) {
    const err = new Error('Firestore is not initialized.');
    console.error('[Firestore Error] clearAllLogsFirestore:', err);
    throw err;
  }

  try {
    const snapshot = await getDocs(collection(db, 'outage_logs'));
    const batch = writeBatch(db);

    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    // Reset status document
    const statusRef = doc(db, 'power_status', 'current');
    batch.set(statusRef, {
      isOutage: false,
      outAt: null,
      updatedAt: Date.now(),
    });

    await batch.commit();
  } catch (error: any) {
    console.error('[Firestore Error] Failed to clear all logs:', error);
    throw error;
  }
}

/**
 * Save application settings to Firestore
 */
export async function saveSettingsFirestore(settings: AppSettings): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'settings', 'app_settings'), settings, { merge: true });
  } catch (error: any) {
    console.error('[Firestore Error] Failed to save settings:', error);
  }
}

/**
 * Real-time listener for app settings
 */
export function subscribeToSettings(
  onUpdate: (settings: AppSettings) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'settings', 'app_settings'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as AppSettings);
      }
    },
    (error) => {
      console.error('[Firestore Error] subscribeToSettings failed:', error);
    }
  );
}
