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
import { LogEntry, AppSettings, UserProfile, TrashEntry, UserRole, UserStatus } from '../types';

export const SUPER_ADMIN_EMAIL = 'syssaltsync33@gmail.com';

export interface PowerStatusDoc {
  isOutage: boolean;
  outAt: number | null;
  updatedAt: number;
  updatedBy?: string;
  updatedByName?: string;
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
    console.error('[Firebase Error]:', err);
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
            updatedBy: val.updatedBy,
            updatedByName: val.updatedByName,
          });
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error('[Firebase Error] subscribeToPowerStatus failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firebase Error] subscribeToPowerStatus exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for all outage & restoration logs
 * Preserves legacy logs seamlessly (displays them normally)
 */
export function subscribeToOutageLogs(
  onUpdate: (logs: LogEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    const err = new Error('Firebase database instance is not initialized.');
    console.error('[Firebase Error]:', err);
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
                createdBy: item.createdBy || undefined,
                createdByName: item.createdByName || undefined,
                createdAt: item.createdAt ? Number(item.createdAt) : undefined,
                updatedBy: item.updatedBy || undefined,
                updatedByName: item.updatedByName || undefined,
                updatedAt: item.updatedAt ? Number(item.updatedAt) : undefined,
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
        console.error('[Firebase Error] subscribeToOutageLogs failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firebase Error] subscribeToOutageLogs exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Toggle / record a power outage or restoration event directly in Firebase
 * Attaches createdBy, createdByName, createdAt
 */
export async function recordPowerEventFirestore(
  type: 'out' | 'in',
  ts: number,
  user?: { uid: string; name: string },
  note?: string
): Promise<string> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firebase Error] recordPowerEventFirestore:', err);
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
      updatedBy: user?.uid || 'anonymous',
      updatedByName: user?.name || 'Operator',
    };
    updates[`logs/${entryId}`] = {
      id: entryId,
      type,
      ts,
      note: note || '',
      createdAt: Date.now(),
      ...(user ? { createdBy: user.uid, createdByName: user.name } : {}),
    };

    await update(ref(db), updates);
    return entryId;
  } catch (error: any) {
    console.error('[Firebase Error] Failed to record power event:', error);
    throw error;
  }
}

/**
 * Add or edit a manual outage entry
 * Preserves or sets createdBy / updatedBy
 */
export async function saveManualLogEntryFirestore(
  entry: { 
    id?: string; 
    type: 'out' | 'in'; 
    ts: number; 
    note?: string; 
    createdBy?: string; 
    createdByName?: string;
    createdAt?: number;
  },
  isLatest = false,
  user?: { uid: string; name: string }
): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firebase Error] saveManualLogEntryFirestore:', err);
    throw err;
  }

  try {
    const isEdit = !!entry.id && !entry.id.startsWith('manual-');
    const entryId = isEdit ? (entry.id as string) : (push(ref(db, 'logs')).key || `entry-${entry.ts}`);

    const updates: Record<string, any> = {};
    const recordPayload: Record<string, any> = {
      id: entryId,
      type: entry.type,
      ts: entry.ts,
      note: entry.note || '',
    };

    if (isEdit) {
      // Preserve existing creator info
      if (entry.createdBy) recordPayload.createdBy = entry.createdBy;
      if (entry.createdByName) recordPayload.createdByName = entry.createdByName;
      if (entry.createdAt) recordPayload.createdAt = entry.createdAt;

      // Add update audit
      recordPayload.updatedAt = Date.now();
      if (user) {
        recordPayload.updatedBy = user.uid;
        recordPayload.updatedByName = user.name;
      }
    } else {
      // New record
      recordPayload.createdAt = Date.now();
      if (user) {
        recordPayload.createdBy = user.uid;
        recordPayload.createdByName = user.name;
      }
    }

    updates[`logs/${entryId}`] = recordPayload;

    if (isLatest) {
      updates['power_status'] = {
        isOutage: entry.type === 'out',
        outAt: entry.type === 'out' ? entry.ts : null,
        updatedAt: Date.now(),
        updatedBy: user?.uid,
        updatedByName: user?.name,
      };
    }

    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firebase Error] Failed to save manual log entry:', error);
    throw error;
  }
}

/**
 * Soft delete: Moves record from `logs/{docId}` to `trash/{docId}`
 * Never permanently deletes on normal delete; saves who deleted it and when
 */
export async function softDeleteLogEntryFirestore(
  targetLog: LogEntry,
  remainingLogs: LogEntry[],
  user: { uid: string; name: string }
): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firebase Error] softDeleteLogEntryFirestore:', err);
    throw err;
  }

  try {
    const docId = targetLog.id;
    const updates: Record<string, any> = {};

    // Remove from active logs
    updates[`logs/${docId}`] = null;

    // Add to trash path
    updates[`trash/${docId}`] = {
      id: docId,
      originalLog: {
        id: targetLog.id,
        type: targetLog.type,
        ts: targetLog.ts,
        note: targetLog.note || '',
        createdBy: targetLog.createdBy || null,
        createdByName: targetLog.createdByName || null,
        createdAt: targetLog.createdAt || null,
        updatedBy: targetLog.updatedBy || null,
        updatedByName: targetLog.updatedByName || null,
        updatedAt: targetLog.updatedAt || null,
      },
      deletedBy: user.uid,
      deletedByName: user.name,
      deletedAt: Date.now(),
      originalPath: 'logs',
    };

    // Recalculate power status from remaining logs
    const sorted = remainingLogs.filter((e) => e.id !== docId).sort((a, b) => a.ts - b.ts);
    const last = sorted[sorted.length - 1];

    updates['power_status'] = {
      isOutage: last ? last.type === 'out' : false,
      outAt: last && last.type === 'out' ? last.ts : null,
      updatedAt: Date.now(),
      updatedBy: user.uid,
      updatedByName: user.name,
    };

    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firebase Error] Failed to soft-delete log entry:', error);
    throw error;
  }
}

/**
 * Restore a soft-deleted item from trash back to `logs/{docId}`
 */
export async function restoreTrashEntryFirestore(
  trashEntry: TrashEntry,
  currentLogs: LogEntry[]
): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firebase Error] restoreTrashEntryFirestore:', err);
    throw err;
  }

  try {
    const docId = trashEntry.id;
    const updates: Record<string, any> = {};

    // Remove from trash
    updates[`trash/${docId}`] = null;

    // Restore to logs
    updates[`logs/${docId}`] = {
      ...trashEntry.originalLog,
      restoredAt: Date.now(),
    };

    // Recalculate power status including this restored entry
    const all = [...currentLogs, trashEntry.originalLog].sort((a, b) => a.ts - b.ts);
    const last = all[all.length - 1];

    updates['power_status'] = {
      isOutage: last ? last.type === 'out' : false,
      outAt: last && last.type === 'out' ? last.ts : null,
      updatedAt: Date.now(),
    };

    await update(ref(db), updates);
  } catch (error: any) {
    console.error('[Firebase Error] Failed to restore trash entry:', error);
    throw error;
  }
}

/**
 * Permanently delete a single item from trash (Admin only)
 */
export async function permanentlyDeleteTrashEntryFirestore(docId: string): Promise<void> {
  if (!db) {
    const err = new Error('Firebase database is not initialized.');
    console.error('[Firebase Error] permanentlyDeleteTrashEntryFirestore:', err);
    throw err;
  }

  try {
    const trashRef = ref(db, `trash/${docId}`);
    await remove(trashRef);
  } catch (error: any) {
    console.error('[Firebase Error] Failed to permanently delete trash entry:', error);
    throw error;
  }
}

/**
 * Real-time listener for Trash items (Admin only)
 */
export function subscribeToTrash(
  onUpdate: (trash: TrashEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    if (onError) onError(new Error('Firebase DB not initialized'));
    return () => {};
  }

  try {
    const trashRef = ref(db, 'trash');
    return onValue(
      trashRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const items: TrashEntry[] = [];
          Object.keys(data).forEach((key) => {
            const item = data[key];
            if (item) {
              items.push({
                id: item.id || key,
                originalLog: item.originalLog || {},
                deletedBy: item.deletedBy || '',
                deletedByName: item.deletedByName || 'Unknown',
                deletedAt: Number(item.deletedAt) || Date.now(),
                originalPath: item.originalPath || 'logs',
              });
            }
          });
          items.sort((a, b) => b.deletedAt - a.deletedAt);
          onUpdate(items);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        console.error('[Firebase Error] subscribeToTrash failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firebase Error] subscribeToTrash exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for single user profile at users/{uid}
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
) {
  if (!db || !uid) return () => {};

  try {
    const userRef = ref(db, `users/${uid}`);
    return onValue(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.val() as UserProfile);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error('[Firebase Error] subscribeToUserProfile failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firebase Error] subscribeToUserProfile exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for all users (Admin view)
 */
export function subscribeToAllUsers(
  onUpdate: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
) {
  if (!db) {
    if (onError) onError(new Error('Firebase DB not initialized'));
    return () => {};
  }

  try {
    const usersRef = ref(db, 'users');
    return onValue(
      usersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list: UserProfile[] = [];
          Object.keys(data).forEach((key) => {
            const u = data[key];
            if (u) {
              list.push({
                uid: u.uid || key,
                username: u.username || 'User',
                displayName: u.displayName || u.username || 'User',
                email: u.email || '',
                role: u.role || 'none',
                status: u.status || 'pending',
                isAdmin: !!u.isAdmin,
                createdAt: Number(u.createdAt) || Date.now(),
                approvedAt: u.approvedAt ? Number(u.approvedAt) : undefined,
                approvedBy: u.approvedBy || undefined,
              });
            }
          });
          list.sort((a, b) => b.createdAt - a.createdAt);
          onUpdate(list);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        console.error('[Firebase Error] subscribeToAllUsers failed:', error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    console.error('[Firebase Error] subscribeToAllUsers exception:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Ensure super admin profile exists in database
 */
export async function ensureSuperAdminProfile(user: { uid: string; email: string; displayName?: string | null }): Promise<void> {
  if (!db) return;
  try {
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    const existing = snap.val();

    if (!existing || existing.role !== 'full' || existing.status !== 'approved' || !existing.isAdmin) {
      await update(userRef, {
        uid: user.uid,
        email: user.email,
        username: existing?.username || 'admin',
        displayName: user.displayName || 'Super Admin',
        role: 'full',
        status: 'approved',
        isAdmin: true,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error('[Firebase Error] ensureSuperAdminProfile failed:', err);
  }
}

/**
 * Create user record on sign-up (Request access)
 */
export async function createPendingUserProfile(user: { uid: string; username: string; email: string }): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${user.uid}`);
    await set(userRef, {
      uid: user.uid,
      username: user.username,
      displayName: user.username,
      email: user.email,
      role: 'none',
      status: 'pending',
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error('[Firebase Error] createPendingUserProfile failed:', err);
    throw err;
  }
}

/**
 * Admin: Approve a user with specific role
 */
export async function adminApproveUser(
  uid: string, 
  role: 'view' | 'editor' | 'full', 
  adminUid: string
): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, {
      role,
      status: 'approved',
      approvedAt: Date.now(),
      approvedBy: adminUid,
    });
  } catch (err) {
    console.error('[Firebase Error] adminApproveUser failed:', err);
    throw err;
  }
}

/**
 * Admin: Reject a user
 */
export async function adminRejectUser(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, {
      status: 'rejected',
      role: 'none',
    });
  } catch (err) {
    console.error('[Firebase Error] adminRejectUser failed:', err);
    throw err;
  }
}

/**
 * Admin: Update user role
 */
export async function adminUpdateUserRole(uid: string, role: UserRole): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, { role });
  } catch (err) {
    console.error('[Firebase Error] adminUpdateUserRole failed:', err);
    throw err;
  }
}

/**
 * Admin: Update user status (e.g. 'disabled' or 'approved')
 */
export async function adminUpdateUserStatus(uid: string, status: UserStatus): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, { status });
  } catch (err) {
    console.error('[Firebase Error] adminUpdateUserStatus failed:', err);
    throw err;
  }
}

/**
 * Admin: Delete user record from database
 */
export async function adminDeleteUserRecord(uid: string): Promise<void> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const userRef = ref(db, `users/${uid}`);
    await remove(userRef);
  } catch (err) {
    console.error('[Firebase Error] adminDeleteUserRecord failed:', err);
    throw err;
  }
}

/**
 * Download a full JSON backup of the entire database
 */
export async function fetchFullDatabaseBackup(): Promise<Record<string, any>> {
  if (!db) throw new Error('Firebase DB not initialized');
  try {
    const rootRef = ref(db);
    const snap = await get(rootRef);
    if (snap.exists()) {
      return {
        _exportMetadata: {
          app: 'VoltLog',
          exportedAt: new Date().toISOString(),
          exportedBy: 'Super Admin',
          source: 'Firebase Realtime Database',
        },
        ...snap.val(),
      };
    }
    return {
      _exportMetadata: {
        app: 'VoltLog',
        exportedAt: new Date().toISOString(),
        source: 'Firebase Realtime Database',
      },
    };
  } catch (err) {
    console.error('[Firebase Error] fetchFullDatabaseBackup failed:', err);
    throw err;
  }
}
