import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Database } from 'firebase/database';
import { User } from 'firebase/auth';
import { 
  X, 
  UploadCloud, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  FileCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { fmtTime, fmtDateShort, exportToJSON } from '../utils/storage';
import { migrateLocalEntriesToCloud } from '../firebase/db';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  localEntries: LogEntry[];
  database: Database | null;
  currentUser: User | null;
  onMigrationSuccess: (addedCount: number, skippedCount: number) => void;
  onClearLocalData: () => void;
  onToast: (msg: string) => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  localEntries,
  database,
  currentUser,
  onMigrationSuccess,
  onClearLocalData,
  onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [shouldClearLocal, setShouldClearLocal] = useState(false);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    exportToJSON(localEntries, null);
    setBackedUp(true);
    onToast('Local backup saved to your downloads ✓');
  };

  const handleMigrate = async () => {
    if (!database) {
      setErrorMsg('Firebase Database is not connected.');
      return;
    }
    if (!currentUser) {
      setErrorMsg('Please sign in with your authorized account before migrating data to the cloud.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setProgress({ current: 0, total: localEntries.length });

    try {
      const res = await migrateLocalEntriesToCloud(
        database,
        localEntries,
        currentUser,
        (current, total) => setProgress({ current, total })
      );

      setResult(res);
      onMigrationSuccess(res.added, res.skipped);

      if (shouldClearLocal) {
        onClearLocalData();
        onToast('Migrated to cloud and local cache cleared ✓');
      } else {
        onToast(`Migrated ${res.added} entries to cloud ✓`);
      }
    } catch (err: any) {
      console.error('Migration error:', err);
      setErrorMsg(err.message || 'Migration failed. Please check network connection and permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold">Cloud Migration Assistant</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Transfer your historical outage logs stored locally in this browser to the <strong>dimlog-d0f35</strong> Firebase Realtime Database. Duplicate entries will be automatically filtered out.
          </p>

          {/* Stats Summary */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Local Records Found
              </span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {localEntries.length}
              </div>
            </div>
            <button
              onClick={handleDownloadBackup}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                backedUp
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{backedUp ? 'Backup Saved ✓' : 'Export Backup First'}</span>
            </button>
          </div>

          {/* Preview of local entries */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Preview Records ({localEntries.length})</span>
              <span className="text-[10px] font-normal italic">Earliest to Latest</span>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              {localEntries.map((e, idx) => (
                <div
                  key={e.id || idx}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700/60 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        e.type === 'out' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="font-bold">
                      {e.type === 'out' ? 'Outage' : 'Restored'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {fmtDateShort(e.ts)} at {fmtTime(e.ts)}
                    </span>
                  </div>
                  {e.note && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {e.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User Authentication Status Check */}
          {!currentUser && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-none" />
              <span>
                You must sign in with an authorized account before saving data to Firebase.
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-none" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress Indicator */}
          {progress && loading && (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>Migrating records to Firebase...</span>
                <span className="font-mono">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-200"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Migration Result Banner */}
          {result && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Migration Complete!</span>
              </div>
              <div>
                Successfully added <strong className="font-mono">{result.added}</strong> new entries.{' '}
                {result.skipped > 0 && (
                  <span>
                    Skipped <strong className="font-mono">{result.skipped}</strong> duplicate records.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Safe retention checkbox (Requirement 10) */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldClearLocal}
                onChange={(e) => setShouldClearLocal(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Clear browser localStorage after successful cloud sync (uncheck to keep a local backup copy on this computer).
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleMigrate}
                disabled={loading || !currentUser || localEntries.length === 0}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>Start Migration</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
