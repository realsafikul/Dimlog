import React from 'react';
import { Zap, ZapOff, Copy, Lock } from 'lucide-react';

interface FloatingMobileBarProps {
  isOutage: boolean;
  onTogglePower: () => void;
  onCopyAll: () => void;
  hasEntries: boolean;
  canAction?: boolean;
  onUnauthorizedAction?: () => void;
}

export const FloatingMobileBar: React.FC<FloatingMobileBarProps> = ({
  isOutage,
  onTogglePower,
  onCopyAll,
  hasEntries,
  canAction = true,
  onUnauthorizedAction,
}) => {
  const handleToggle = () => {
    if (!canAction) {
      if (onUnauthorizedAction) onUnauthorizedAction();
      return;
    }
    onTogglePower();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 md:hidden shadow-lg transition-transform">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2 pl-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isOutage
                ? 'bg-rose-500 animate-ping'
                : 'bg-emerald-500'
            }`}
          />
          <div className="leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Grid Power
            </span>
            <span className={`text-xs font-black ${isOutage ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {isOutage ? 'OUTAGE' : 'ONLINE'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasEntries && (
            <button
              onClick={onCopyAll}
              aria-label="Copy Report"
              className="h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
          )}

          <button
            onClick={handleToggle}
            className={`h-11 px-4 rounded-xl font-black text-xs text-white flex items-center gap-1.5 shadow-md active:scale-95 transition ${
              !canAction
                ? 'bg-slate-700 opacity-90'
                : isOutage
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-orange-500 to-rose-600 shadow-rose-500/25'
            }`}
          >
            {!canAction ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Login</span>
              </>
            ) : isOutage ? (
              <>
                <Zap className="w-4 h-4" />
                <span>Electricity Back</span>
              </>
            ) : (
              <>
                <ZapOff className="w-4 h-4" />
                <span>Electricity Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
