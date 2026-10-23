import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  UserProfile, 
  LogEntry, 
  TrashEntry, 
  UserRole, 
  UserStatus,
  AppSettings
} from '../types';
import { 
  subscribeToAllUsers, 
  subscribeToTrash, 
  adminApproveUser, 
  adminRejectUser, 
  adminUpdateUserRole, 
  adminUpdateUserStatus, 
  adminDeleteUserRecord,
  restoreTrashEntryFirestore,
  permanentlyDeleteTrashEntryFirestore,
  softDeleteLogEntryFirestore,
  fetchFullDatabaseBackup,
  SUPER_ADMIN_EMAIL
} from '../services/firestore';
import { 
  fmtTime, 
  fmtDateShort, 
  fmtDateFull, 
  getFullReportText, 
  getWhatsAppReportText,
  exportToCSV
} from '../utils/storage';
import { 
  ShieldCheck, 
  Users, 
  Trash2, 
  Database, 
  FileText, 
  Activity, 
  X, 
  LogOut, 
  Check, 
  UserPlus, 
  RotateCcw, 
  Download, 
  AlertTriangle, 
  Search, 
  Loader2, 
  Clock, 
  Flame, 
  Layers, 
  UserCheck, 
  UserX,
  Edit3
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  outAt: number | null;
  settings: AppSettings;
  onEditLog: (entry: LogEntry, index: number) => void;
  onToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  logs,
  outAt,
  settings,
  onEditLog,
  onToast,
}) => {
  const { currentUser, userProfile, isAdmin, logout, adminCreateUser } = useAuth();
  
  // Tabs: overview, logs, reports, users, trash, backup
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'reports' | 'users' | 'trash' | 'backup'>('overview');

  // Real-time data lists
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [trashList, setTrashList] = useState<TrashEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTrash, setLoadingTrash] = useState(true);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('editor');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // Filter & Search states
  const [logsSearch, setLogsSearch] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Subscribe to Users & Trash when modal is open
  useEffect(() => {
    if (!isOpen || !isAdmin) return;

    setLoadingUsers(true);
    setLoadingTrash(true);

    const unsubUsers = subscribeToAllUsers(
      (users) => {
        setAllUsers(users);
        setLoadingUsers(false);
      },
      (err) => {
        console.error('[Admin Panel] Failed to load users:', err);
        setLoadingUsers(false);
      }
    );

    const unsubTrash = subscribeToTrash(
      (trash) => {
        setTrashList(trash);
        setLoadingTrash(false);
      },
      (err) => {
        console.error('[Admin Panel] Failed to load trash:', err);
        setLoadingTrash(false);
      }
    );

    return () => {
      unsubUsers();
      unsubTrash();
    };
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  // Split users into pending & approved
  const pendingUsers = allUsers.filter((u) => u.status === 'pending');
  const approvedUsers = allUsers.filter((u) => u.status !== 'pending');

  // Approve User
  const handleApprove = async (uid: string, role: UserRole) => {
    setActionLoadingId(uid);
    try {
      await adminApproveUser(uid, role === 'none' ? 'editor' : role, currentUser?.uid || 'admin');
      onToast(`User approved as ${role} ✓`);
    } catch (err: any) {
      console.error('[Admin Error] handleApprove failed:', err);
      onToast(`Failed to approve user: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject User
  const handleReject = async (uid: string) => {
    if (!window.confirm('Reject this access request?')) return;
    setActionLoadingId(uid);
    try {
      await adminRejectUser(uid);
      onToast('Access request rejected');
    } catch (err: any) {
      console.error('[Admin Error] handleReject failed:', err);
      onToast(`Failed to reject user: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Change Role
  const handleChangeRole = async (uid: string, role: UserRole) => {
    setActionLoadingId(uid);
    try {
      await adminUpdateUserRole(uid, role);
      onToast(`Role updated to ${role} ✓`);
    } catch (err: any) {
      console.error('[Admin Error] handleChangeRole failed:', err);
      onToast(`Failed to update role: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle User Status (Disable/Enable)
  const handleToggleStatus = async (user: UserProfile) => {
    const nextStatus: UserStatus = user.status === 'disabled' ? 'approved' : 'disabled';
    setActionLoadingId(user.uid);
    try {
      await adminUpdateUserStatus(user.uid, nextStatus);
      onToast(`User status set to ${nextStatus}`);
    } catch (err: any) {
      console.error('[Admin Error] handleToggleStatus failed:', err);
      onToast(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete User Record
  const handleDeleteUser = async (uid: string, username: string) => {
    if (!window.confirm(`Permanently remove user record for @${username}?`)) return;
    setActionLoadingId(uid);
    try {
      await adminDeleteUserRecord(uid);
      onToast(`User @${username} removed`);
    } catch (err: any) {
      console.error('[Admin Error] handleDeleteUser failed:', err);
      onToast(`Failed to delete user: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Admin directly creates a user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);
    setIsCreatingUser(true);

    try {
      await adminCreateUser(newUsername, newPassword, newRole);
      onToast(`User @${newUsername.trim()} created with ${newRole} access ✓`);
      setNewUsername('');
      setNewPassword('');
    } catch (err: any) {
      console.error('[Admin Error] adminCreateUser failed:', err);
      setCreateUserError(err.message || 'Failed to create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Soft Delete a log (Admin action)
  const handleSoftDeleteLog = async (entry: LogEntry) => {
    if (!window.confirm(`Move this log from ${fmtTime(entry.ts)} to Trash? (You can restore it later)`)) {
      return;
    }
    try {
      await softDeleteLogEntryFirestore(
        entry,
        logs,
        { uid: currentUser?.uid || 'admin', name: userProfile?.username || 'Super Admin' }
      );
      onToast('Log moved to Trash ✓');
    } catch (err: any) {
      console.error('[Admin Error] Soft delete failed:', err);
      onToast(`Failed to delete: ${err.message}`);
    }
  };

  // Restore trash entry
  const handleRestoreTrash = async (trashEntry: TrashEntry) => {
    try {
      await restoreTrashEntryFirestore(trashEntry, logs);
      onToast('Entry restored to active logs ✓');
    } catch (err: any) {
      console.error('[Admin Error] Restore failed:', err);
      onToast(`Failed to restore: ${err.message}`);
    }
  };

  // Permanently delete from trash
  const handlePermanentDelete = async (docId: string) => {
    if (!window.confirm('Permanently delete this entry from trash? This cannot be undone.')) {
      return;
    }
    try {
      await permanentlyDeleteTrashEntryFirestore(docId);
      onToast('Entry permanently deleted from trash');
    } catch (err: any) {
      console.error('[Admin Error] Permanent delete failed:', err);
      onToast(`Failed to delete: ${err.message}`);
    }
  };

  // Full Database Backup Download
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const data = await fetchFullDatabaseBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voltlog-complete-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Full database JSON backup downloaded ✓');
    } catch (err: any) {
      console.error('[Admin Error] Backup download failed:', err);
      onToast(`Backup failed: ${err.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fade">
      <div className="relative w-full max-w-5xl h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">VoltLog Super Admin Panel</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  Master Control
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged in as <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser?.email || SUPER_ADMIN_EMAIL}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex items-center gap-1.5 active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="Close Admin Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold bg-white dark:bg-slate-900 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Logs ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`relative px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users</span>
            {pendingUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('trash')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'trash'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash ({trashList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'backup'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Alert banner for pending user requests */}
              {pendingUsers.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-none animate-bounce" />
                    <div>
                      <div className="text-xs sm:text-sm font-bold">
                        {pendingUsers.length} pending access {pendingUsers.length === 1 ? 'request' : 'requests'} waiting for approval!
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        Review users in the Users tab to grant View, Editor, or Full access.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95 shadow-sm"
                  >
                    Review Now
                  </button>
                </div>
              )}

              {/* Status Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Grid Status</div>
                  <div className="text-xl font-black mt-1 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${outAt !== null ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                    <span className={outAt !== null ? 'text-rose-500' : 'text-emerald-500'}>
                      {outAt !== null ? 'OUTAGE' : 'ONLINE'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Logs</div>
                  <div className="text-2xl font-black mt-1 font-mono text-indigo-600 dark:text-indigo-400">
                    {logs.length}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Approved Users</div>
                  <div className="text-2xl font-black mt-1 font-mono text-emerald-600 dark:text-emerald-400">
                    {approvedUsers.length}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Trash Bin</div>
                  <div className="text-2xl font-black mt-1 font-mono text-amber-600 dark:text-amber-400">
                    {trashList.length}
                  </div>
                </div>
              </div>

              {/* Safety Rules & Access Levels Explanation */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Access Levels &amp; Safety Protocol</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">👀 View Only</div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Can view the live dashboard, 24h timeline, all logs and reports. Cannot create, edit, or delete anything.
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">✍️ Editor</div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Can record power outages/restores and add manual entries. Can edit/delete ONLY their own entries. Cannot touch legacy records.
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="font-bold text-purple-600 dark:text-purple-400 mb-1">⚡ Full Access</div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Can perform all operational actions on all entries (create, edit, soft-delete to trash). Bulk delete is disabled for all users.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    placeholder="Search logs by creator, time, date, note..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Showing {logs.length} cloud records
                </div>
              </div>

              <div className="space-y-2">
                {logs
                  .slice()
                  .reverse()
                  .filter((entry) => {
                    if (!logsSearch.trim()) return true;
                    const q = logsSearch.toLowerCase();
                    const creator = (entry.createdByName || 'Legacy / Unknown').toLowerCase();
                    const note = (entry.note || '').toLowerCase();
                    const time = fmtTime(entry.ts).toLowerCase();
                    const date = fmtDateShort(entry.ts).toLowerCase();
                    return creator.includes(q) || note.includes(q) || time.includes(q) || date.includes(q);
                  })
                  .map((entry, idx) => {
                    const isOut = entry.type === 'out';
                    const creatorLabel = entry.createdByName || 'Legacy / Unknown';
                    const originalIndex = logs.findIndex((l) => l.id === entry.id);

                    return (
                      <div
                        key={entry.id || idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-3 hover:border-indigo-500/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-3 h-3 rounded-full flex-none ${
                              isOut ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                              <span>{isOut ? 'Electricity Out' : 'Electricity Back'}</span>
                              <span className="font-mono text-slate-500 font-normal">
                                {fmtTime(entry.ts)} ({fmtDateShort(entry.ts)})
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  entry.createdByName
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {entry.createdByName ? `👤 ${entry.createdByName}` : '🏷️ Legacy / Unknown'}
                              </span>
                            </div>
                            {entry.note && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                                Note: {entry.note}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => {
                              onEditLog(entry, originalIndex >= 0 ? originalIndex : 0);
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-indigo-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleSoftDeleteLog(entry)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex items-center gap-1"
                            title="Soft delete to Trash"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Trash</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-base font-bold">Shift &amp; Power Log Export Center</h3>
                <p className="text-xs text-slate-500">
                  Export formatted reports for administrative documentation, client billing, WhatsApp updates, or Excel spreadsheets.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => {
                      const text = getFullReportText(logs);
                      if (text) {
                        navigator.clipboard.writeText(text).then(() => onToast('Report copied to clipboard ✓'));
                      }
                    }}
                    className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex flex-col items-center justify-center gap-2 hover:bg-indigo-100 transition"
                  >
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <span>Copy Full Text Report</span>
                  </button>

                  <button
                    onClick={() => {
                      const text = getWhatsAppReportText(logs);
                      if (text) {
                        navigator.clipboard.writeText(text).then(() => onToast('WhatsApp report copied ✓'));
                      }
                    }}
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 transition"
                  >
                    <Check className="w-5 h-5 text-emerald-500" />
                    <span>Copy WhatsApp Summary</span>
                  </button>

                  <button
                    onClick={() => {
                      exportToCSV(logs);
                      onToast('CSV exported ✓');
                    }}
                    className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 font-bold text-xs flex flex-col items-center justify-center gap-2 hover:bg-purple-100 transition"
                  >
                    <Download className="w-5 h-5 text-purple-500" />
                    <span>Export to CSV (Excel)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: USERS (PENDING / APPROVED / DIRECT CREATE) */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* SECTION: Direct Create User by Admin */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold">Create User Directly (Admin Provision)</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Create a new user account instantly without logging yourself out. The account will be immediately approved with the selected role.
                </p>

                {createUserError && (
                  <div className="mb-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                    {createUserError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. shift_lead"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Password (min 6 chars)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Access Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                    >
                      <option value="editor">Editor (Can create &amp; edit own entries)</option>
                      <option value="full">Full (Can edit/soft-delete all entries)</option>
                      <option value="view">View (Read-only observer)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isCreatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Create User</span>
                  </button>
                </form>
              </div>

              {/* SECTION: Pending Requests */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-bold">Pending Access Requests</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {pendingUsers.length}
                    </span>
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading requests...</div>
                ) : pendingUsers.length === 0 ? (
                  <div className="py-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                    No pending access requests.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingUsers.map((user) => (
                      <div
                        key={user.uid}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>@{user.username}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              Requested on {fmtDateShort(user.createdAt)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{user.email}</div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
                          <button
                            onClick={() => handleApprove(user.uid, 'editor')}
                            disabled={actionLoadingId === user.uid}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 shadow-sm"
                          >
                            Approve (Editor)
                          </button>
                          <button
                            onClick={() => handleApprove(user.uid, 'full')}
                            disabled={actionLoadingId === user.uid}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition active:scale-95 shadow-sm"
                          >
                            Approve (Full)
                          </button>
                          <button
                            onClick={() => handleApprove(user.uid, 'view')}
                            disabled={actionLoadingId === user.uid}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95"
                          >
                            View Only
                          </button>
                          <button
                            onClick={() => handleReject(user.uid)}
                            disabled={actionLoadingId === user.uid}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition active:scale-95"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: Approved & Existing Users */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold">Approved Users &amp; Permissions</h3>
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading users...</div>
                ) : approvedUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No approved users yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {approvedUsers.map((user) => {
                      const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL || user.isAdmin;
                      const isDisabled = user.status === 'disabled';

                      return (
                        <div
                          key={user.uid}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition gap-3 ${
                            isDisabled
                              ? 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>@{user.username}</span>
                              {isSuperAdmin && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  Super Admin
                                </span>
                              )}
                              {isDisabled && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{user.email}</div>
                          </div>

                          {!isSuperAdmin && (
                            <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                              {/* Role Selector */}
                              <select
                                value={user.role}
                                onChange={(e) => handleChangeRole(user.uid, e.target.value as UserRole)}
                                disabled={actionLoadingId === user.uid || isDisabled}
                                className="px-2.5 py-1 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold"
                              >
                                <option value="view">Role: View</option>
                                <option value="editor">Role: Editor</option>
                                <option value="full">Role: Full</option>
                              </select>

                              {/* Disable / Enable Toggle */}
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={actionLoadingId === user.uid}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition ${
                                  isDisabled
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {isDisabled ? 'Enable' : 'Disable'}
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => handleDeleteUser(user.uid, user.username)}
                                disabled={actionLoadingId === user.uid}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: TRASH (SOFT-DELETED ENTRIES RESTORE / PURGE) */}
          {activeTab === 'trash' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-500 flex-none" />
                <span>
                  All deleted records are safely kept in this Trash bin. You can restore any record back into active logs, or permanently remove it.
                </span>
              </div>

              {loadingTrash ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading trash bin...</div>
              ) : trashList.length === 0 ? (
                <div className="py-12 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                  <Trash2 className="w-8 h-8 text-slate-400 opacity-40 mb-2" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Trash is empty.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    No records have been deleted.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {trashList.map((item) => {
                    const log = item.originalLog;
                    const isOut = log.type === 'out';

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className={isOut ? 'text-rose-500' : 'text-emerald-500'}>
                              {isOut ? 'Electricity Out' : 'Electricity Back'}
                            </span>
                            <span className="font-mono text-slate-500 font-normal">
                              {fmtTime(log.ts)} ({fmtDateShort(log.ts)})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Created by: <span className="font-semibold">{log.createdByName || 'Legacy / Unknown'}</span> · Deleted by: <span className="font-semibold">{item.deletedByName}</span> on {fmtDateShort(item.deletedAt)} at {fmtTime(item.deletedAt)}
                          </div>
                          {log.note && (
                            <div className="text-xs text-slate-400 italic mt-0.5">Note: {log.note}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleRestoreTrash(item)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 flex items-center gap-1.5 shadow-sm"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition active:scale-95 flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Purge</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-base font-bold">One-Click Complete Database Backup</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Download a complete, uncompressed JSON snapshot directly from Firebase Realtime Database.
                  This backup includes all power grid status records, outage logs with ownership metadata, user accounts &amp; permissions, settings, and the soft-deleted trash bin.
                </p>

                <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1 font-mono text-slate-700 dark:text-slate-300">
                  <div>✓ Path: /power_status (Current grid &amp; generator telemetry)</div>
                  <div>✓ Path: /logs ({logs.length} historical power events)</div>
                  <div>✓ Path: /users ({allUsers.length} operator &amp; admin accounts)</div>
                  <div>✓ Path: /trash ({trashList.length} soft-deleted recoverable records)</div>
                  <div>✓ Path: /settings (Fuel rates and notification preferences)</div>
                </div>

                <button
                  onClick={handleDownloadBackup}
                  disabled={backupLoading}
                  className="w-full sm:w-auto py-3 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:brightness-105 shadow-md shadow-indigo-500/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Download Full Database Backup (JSON)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
