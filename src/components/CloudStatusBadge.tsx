import React from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

interface CloudStatusBadgeProps {
  isSyncing: boolean;
  networkError: boolean;
  isInitialLoading: boolean;
}

export const CloudStatusBadge: React.FC<CloudStatusBadgeProps> = ({
  isSyncing,
  networkError,
  isInitialLoading,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition shadow-xs ${
          networkError
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : isSyncing || isInitialLoading
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
        }`}
        title={
          networkError
            ? 'Cloud connection error - check Firestore settings / environment variables'
            : isInitialLoading
            ? 'Connecting to Firestore...'
            : isSyncing
            ? 'Saving to Firestore...'
            : 'Connected: Firestore live sync active'
        }
      >
        {isSyncing || isInitialLoading ? (
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
          {isInitialLoading
            ? 'Connecting...'
            : isSyncing
            ? 'Saving...'
            : networkError
            ? 'Cloud Error'
            : 'Firestore Online'}
        </span>
        <span className="sm:hidden">
          {isSyncing ? 'Sync' : networkError ? 'Error' : 'Online'}
        </span>
      </div>
    </div>
  );
};
