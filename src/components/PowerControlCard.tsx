import React from 'react';
import { Zap, ZapOff, RotateCcw, Clock, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import { formatDurationSeconds } from '../utils/storage';

interface PowerControlCardProps {
  isOutage: boolean;
  outageSeconds: number;
  stableSeconds: number;
  onTogglePower: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canAction?: boolean;
  onUnauthorizedAction?: () => void;
}

export const PowerControlCard: React.FC<PowerControlCardProps> = ({
  isOutage,
  outageSeconds,
  stableSeconds,
  onTogglePower,
  canUndo,
  onUndo,
  canAction = true,
  onUnauthorizedAction,
}) => {
  const handleClick = () => {
    if (!canAction) {
      if (onUnauthorizedAction) onUnauthorizedAction();
      return;
    }
    onTogglePower();
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 lg:p-7 shadow-xl shadow-indigo-950/5 dark:shadow-black/40 flex flex-col items-center justify-between transition-all">
      {/* Status Indicators Top Row */}
      <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-2">
        {/* Electricity Grid Status Pill */}
        <div className="flex flex-col p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Grid Electricity
          </span>
          <div className="flex items-center gap-2 mt-1.5 font-bold text-base sm:text-lg">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                isOutage
                  ? 'bg-rose-500 ring-4 ring-rose-500/25 animate-pulse'
                  : 'bg-emerald-500 ring-4 ring-emerald-500/25'
              }`}
            />
            <span className={isOutage ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-emerald-600 dark:text-emerald-400 font-black'}>
              {isOutage ? 'OUT' : 'ON'}
            </span>
          </div>
        </div>

        {/* Generator Status Pill */}
        <div className="flex flex-col p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Auto Generator
          </span>
          <div className="flex items-center gap-2 mt-1.5 font-bold text-base sm:text-lg">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                isOutage
                  ? 'bg-amber-500 ring-4 ring-amber-500/25 animate-ping'
                  : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
            <span className={isOutage ? 'text-amber-500 dark:text-amber-400 font-black' : 'text-slate-500 dark:text-slate-400'}>
              {isOutage ? 'RUNNING' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Big Push Button Container */}
      <div className="relative my-6 sm:my-8 flex flex-col items-center justify-center">
        {/* Pulsing ripples when active */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-44 sm:w-56 md:w-64 aspect-square rounded-full border-2 transition-opacity duration-700 ${
              isOutage
                ? 'border-emerald-500/40 animate-pulse-wave-1'
                : 'border-rose-500/40 animate-pulse-wave-1'
            }`}
          />
          <div
            className={`w-44 sm:w-56 md:w-64 aspect-square rounded-full border-2 transition-opacity duration-700 ${
              isOutage
                ? 'border-emerald-500/30 animate-pulse-wave-2'
                : 'border-rose-500/30 animate-pulse-wave-2'
            }`}
          />
        </div>

        {/* The Action Button */}
        <button
          onClick={handleClick}
          type="button"
          aria-label={isOutage ? 'Power restored, mark electricity back' : 'Power cut, mark electricity out'}
          className={`relative z-10 w-44 sm:w-52 md:w-60 aspect-square rounded-full flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 text-white font-black cursor-pointer shadow-2xl transition-all duration-200 transform active:scale-95 focus:outline-none focus-visible:ring-4 select-none ${
            !canAction
              ? 'opacity-85 hover:opacity-100 ' + (isOutage
                ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 shadow-emerald-500/20'
                : 'bg-gradient-to-br from-orange-600 via-rose-600 to-red-700 shadow-rose-500/20')
              : isOutage
              ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 shadow-emerald-500/40 focus-visible:ring-emerald-400 hover:brightness-105'
              : 'bg-gradient-to-br from-orange-500 via-rose-500 to-red-600 shadow-rose-500/40 focus-visible:ring-rose-400 hover:brightness-105'
          }`}
        >
          {isOutage ? (
            <>
              <Zap className="w-12 h-12 sm:w-16 sm:h-16 filter drop-shadow-md animate-bounce" />
              <div className="leading-tight text-center">
                <span className="block text-base sm:text-xl font-black tracking-wide uppercase">Electricity</span>
                <span className="block text-xl sm:text-2xl font-black tracking-wider uppercase underline decoration-2 underline-offset-4">Back</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-100 opacity-90">
                {canAction ? 'Tap to Restore' : 'Login to Record'}
              </span>
            </>
          ) : (
            <>
              <ZapOff className="w-12 h-12 sm:w-16 sm:h-16 filter drop-shadow-md" />
              <div className="leading-tight text-center">
                <span className="block text-base sm:text-xl font-black tracking-wide uppercase">Electricity</span>
                <span className="block text-xl sm:text-2xl font-black tracking-wider uppercase underline decoration-2 underline-offset-4">Out</span>
              </div>
              <span className="text-[11px] font-semibold text-rose-100 opacity-90">
                {canAction ? 'Tap on Power Cut' : 'Login to Record'}
              </span>
            </>
          )}
        </button>

        {/* Small "Login to take action" hint for unauthenticated visitors */}
        {!canAction && (
          <button
            onClick={onUnauthorizedAction}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition active:scale-95"
          >
            <Lock className="w-3 h-3" />
            <span>Login to take action</span>
          </button>
        )}
      </div>

      {/* Live Stopwatch & Status Duration */}
      <div className="w-full text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
          {isOutage ? (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse flex-none" />
              <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Outage running: <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">{formatDurationSeconds(outageSeconds)}</span>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-none" />
              <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Grid normal{stableSeconds > 0 ? (
                  <> · Stable: <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{formatDurationSeconds(stableSeconds)}</span></>
                ) : ' · Standing by'}
              </div>
            </>
          )}
        </div>

        {/* Undo Quick Action if applicable */}
        {canUndo && canAction && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={onUndo}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo accidental tap</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
