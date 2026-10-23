import React from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudOff, RefreshCw, Key, AlertTriangle } from 'lucide-react';
import { getStoredApiKey, getApiKeySource } from '../firebase/config';

interface CloudStatusBadgeProps {
  currentUser: User | null;
  isSyncing: boolean;
  networkError: boolean;
  onClick: () => void;
  localEntriesCount: number;
  onOpenMigration: () => void;
}

export const CloudStatusBadge: React.FC<CloudStatusBadgeProps> = ({
  currentUser,
  isSyncing,
  networkError,
  onClick,
  localEntriesCount,
  onOpenMigration,
}) => {
  const keySource = getApiKeySource();
  const hasApiKey = keySource !== 'missing';

  return (
    <div className="flex items-center gap-1.5">
      {/* Cloud Status Trigger Button */}
      <button
        onClick={onClick}
        type="button"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition active:scale-95 shadow-xs ${
          !hasApiKey
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40'
            : networkError
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : isSyncing
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
            : currentUser
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
        }`}
        title={
          !hasApiKey
            ? 'Firebase API Key is missing. Click to configure VITE_FIREBASE_API_KEY.'
            : currentUser
            ? `Connected to dimlog-d0f35 as ${currentUser.email} (${keySource === 'env' ? 'via Netlify env' : 'via stored key'})`
            : 'Click to sign in with authorized staff account'
        }
      >
        {!hasApiKey ? (
          <Key className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
        ) : isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : networkError ? (
          <CloudOff className="w-3.5 h-3.5 text-rose-500" />
        ) : currentUser ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-amber-400" />
        )}

        <span className="hidden sm:inline">
          {!hasApiKey
            ? 'Set API Key'
            : isSyncing
            ? 'Syncing...'
            : networkError
            ? 'Cloud Error'
            : currentUser
            ? 'Cloud Synced'
            : 'Local Mode'}
        </span>
        <span className="sm:hidden">
          {!hasApiKey
            ? 'API Key'
            : currentUser
            ? 'Cloud'
            : 'Local'}
        </span>
      </button>

      {/* Migration prompt badge if local entries exist and user is logged in */}
      {currentUser && localEntriesCount > 0 && (
        <button
          onClick={onOpenMigration}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition active:scale-95 animate-pulse"
          title={`Migrate ${localEntriesCount} local entries to Firebase`}
        >
          <span>Migrate</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px]">
            {localEntriesCount}
          </span>
        </button>
      )}
    </div>
  );
};
