import React from 'react';
import { User } from 'firebase/auth';
import { 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX, 
  PlusCircle, 
  Keyboard, 
  Maximize2, 
  Minimize2,
  SlidersHorizontal
} from 'lucide-react';
import { CloudStatusBadge } from './CloudStatusBadge';

interface HeaderProps {
  currentTime: Date;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenManualEntry: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  currentUser: User | null;
  isSyncing: boolean;
  networkError: boolean;
  onOpenAuth: () => void;
  localEntriesCount: number;
  onOpenMigration: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTime,
  theme,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
  onOpenManualEntry,
  onOpenShortcuts,
  onOpenSettings,
  isFullscreen,
  onToggleFullscreen,
  currentUser,
  isSyncing,
  networkError,
  onOpenAuth,
  localEntriesCount,
  onOpenMigration,
}) => {
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="relative w-full text-center pt-2 pb-4">
      {/* Top utility bar */}
      <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
        {/* Creator Badge & Brand */}
        <div 
          className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/10 dark:bg-slate-900/60 backdrop-blur-md border border-slate-300/40 dark:border-slate-800 shadow-sm transition hover:scale-[1.02]"
          title="Built by Safikul Islam"
        >
          <svg 
            className="w-7 h-7 flex-none transition-transform duration-700 hover:rotate-180" 
            viewBox="0 0 64 64" 
            xmlns="http://www.w3.org/2000/svg" 
            role="img" 
            aria-label="Safikul Islam Brand Mark"
          >
            <defs>
              <linearGradient id="header-brand-lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="29" fill="none" stroke="url(#header-brand-lg)" strokeWidth="2.5" strokeDasharray="150 32" strokeLinecap="round" />
            <circle cx="32" cy="32" r="23" fill="url(#header-brand-lg)" opacity="0.16" />
            <text x="32" y="41" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="26" fill="url(#header-brand-lg)">SI</text>
            <polygon points="50,6 43,19 49,19 45,29 56,14 50,14" fill="#fbbf24" />
          </svg>
          <div className="flex flex-col text-left leading-none pr-1">
            <span className="font-serif italic font-bold text-xs bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Safikul Islam</span>
            <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400 mt-0.5">Creator</span>
          </div>
        </div>

        {/* Quick controls toolbar */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Cloud Status Indicator */}
          <CloudStatusBadge
            currentUser={currentUser}
            isSyncing={isSyncing}
            networkError={networkError}
            onClick={onOpenAuth}
            localEntriesCount={localEntriesCount}
            onOpenMigration={onOpenMigration}
          />

          {/* Add Manual Entry Button */}
          <button
            onClick={onOpenManualEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition active:scale-95 min-h-[38px]"
            title="Log past or custom outage event"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Past Entry</span>
            <span className="sm:hidden">Add</span>
          </button>

          {/* Sound & Haptics Toggle */}
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/60 transition active:scale-95"
            title={soundEnabled ? 'Sounds enabled' : 'Sounds muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/60 transition active:scale-95"
            title={`Toggle ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Settings / Rates */}
          <button
            onClick={onOpenSettings}
            aria-label="Generator & Fuel Settings"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/60 transition active:scale-95"
            title="Generator & Fuel Settings"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>

          {/* Keyboard shortcuts (visible on PC/tablet) */}
          <button
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/60 transition active:scale-95"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>

          {/* Fullscreen (desktop / tablet) */}
          <button
            onClick={onToggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="hidden lg:flex w-9 h-9 rounded-full items-center justify-center bg-slate-200/60 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/60 transition active:scale-95"
            title="Toggle fullscreen monitor view"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Title */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
        <span>⚡ VoltLog</span>
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
        Electricity Outage Tracker &amp; Automatic Generator Monitor
      </p>

      {/* Live Digital Clock */}
      <div 
        id="clock" 
        className="font-mono tabular-nums text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-100 mt-2 select-none"
      >
        {formattedTime}
      </div>
      <div id="date" className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
        {formattedDate}
      </div>
    </header>
  );
};
