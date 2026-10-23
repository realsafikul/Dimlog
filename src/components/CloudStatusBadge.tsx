import React from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudOff, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { getApiKeySource } from '../firebase/config';

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
          networkError
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : isSyncing
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
        }`}
        title={
          currentUser
            ? `Connected to dimlog-d0f35 as ${currentUser.email} (${keySource === 'env' ? 'via Netlify env' : 'via stored key'})`
            : 'Online: Connected to Firebase Realtime Database (dimlog-d0f35)'
        }
      >
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : networkError ? (
          <CloudOff className="w-3.5 h-3.5 text-rose-500" />
        ) : (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}

        <span className="hidden sm:inline">
          {isSyncing
            ? 'Syncing...'
            : networkError
            ? 'Cloud Error'
            : currentUser
            ? `Staff (${currentUser.email?.split('@')[0]})`
            : 'Cloud Online'}
        </span>
        <span className="sm:hidden">
          {isSyncing ? 'Sync' : 'Cloud'}
        </span>
      </button>

      {/* Migration prompt badge if local entries exist */}
      {localEntriesCount > 0 && (
        <button
          onClick={onOpenMigration}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition active:scale-95 animate-pulse"
          title={`Upload ${localEntriesCount} existing local entries to online Firebase`}
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
