import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogEntry, AppSettings } from './types';
import { 
  loadSettings, 
  saveSettings,
  getFullReportText,
  computeOutageSegments,
  formatDurationMinutes
} from './utils/storage';
import { playOutChime, playInChime, playClickSound, triggerHaptic } from './utils/audio';
import { 
  subscribeToPowerStatus, 
  subscribeToOutageLogs, 
  recordPowerEventFirestore, 
  saveManualLogEntryFirestore, 
  deleteLogEntryFirestore, 
  clearAllLogsFirestore 
} from './services/firestore';
import { Header } from './components/Header';
import { PowerControlCard } from './components/PowerControlCard';
import { TimelineChart } from './components/TimelineChart';
import { ReportLog } from './components/ReportLog';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WorkflowGuide } from './components/WorkflowGuide';
import { FloatingMobileBar } from './components/FloatingMobileBar';
import { Flame, Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';

export default function App() {
  // Main data state directly synchronized with Firestore
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outAt, setOutAt] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Firestore loading & error states
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Undo state
  const [previousState, setPreviousState] = useState<{ log: LogEntry[]; outAt: number | null } | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ entry: LogEntry; index: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Toast banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimer, setToastTimer] = useState<NodeJS.Timeout | null>(null);

  // Scroll listener for mobile thumb bar
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  // Toast trigger helper
  const showToast = useCallback((msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMessage(msg);
    const t = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    setToastTimer(t);
  }, [toastTimer]);

  // Initial theme detection
  useEffect(() => {
    const savedTheme = localStorage.getItem('voltlog-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  // Sync theme with HTML root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('voltlog-theme', theme);
  }, [theme]);

  // Real-time Firestore synchronization on mount (no login required)
  useEffect(() => {
    setIsInitialLoading(true);
    let unsubStatus: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    try {
      // 1. Live Firestore listener for power_status
      unsubStatus = subscribeToPowerStatus(
        (statusDoc) => {
          setErrorMessage(null);
          if (statusDoc) {
            setOutAt(statusDoc.isOutage ? statusDoc.outAt : null);
          } else {
            setOutAt(null);
          }
        },
        (error) => {
          console.error('[Firestore Error] Failed to fetch live power status:', error);
          setErrorMessage(`Failed to load power status from Firestore: ${error.message}`);
        }
      );

      // 2. Live Firestore listener for outage_logs
      unsubLogs = subscribeToOutageLogs(
        (cloudLogs) => {
          setIsInitialLoading(false);
          setErrorMessage(null);
          setLog(cloudLogs);
        },
        (error) => {
          console.error('[Firestore Error] Failed to fetch outage logs:', error);
          setIsInitialLoading(false);
          setErrorMessage(`Failed to load outage logs from Firestore: ${error.message}`);
        }
      );
    } catch (err: any) {
      console.error('[Firestore Error] Initialization failed:', err);
      setIsInitialLoading(false);
      setErrorMessage(err?.message || 'Failed to connect to Firebase Firestore.');
    }

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  // Real-time second clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll listener for mobile thumb bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 280) {
        setIsScrolledDown(true);
      } else {
        setIsScrolledDown(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Live stopwatch calculations
  const nowMs = currentTime.getTime();
  const outageSeconds = outAt !== null ? Math.max(0, Math.floor((nowMs - outAt) / 1000)) : 0;

  // Time since last power restoration
  const stableSeconds = useMemo(() => {
    if (outAt !== null) return 0;
    const lastInEntry = [...log].reverse().find((e) => e.type === 'in');
    if (!lastInEntry) return 0;
    return Math.max(0, Math.floor((nowMs - lastInEntry.ts) / 1000));
  }, [log, outAt, nowMs]);

  // Core 1-tap power toggle handler using Firestore
  const handleTogglePower = useCallback(async () => {
    const now = Date.now();
    setPreviousState({ log: [...log], outAt });
    if (undoTimeout) clearTimeout(undoTimeout);
    const t = setTimeout(() => setPreviousState(null), 9000);
    setUndoTimeout(t);

    triggerHaptic(45, settings.hapticsEnabled);
    const isNowOut = outAt === null;

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      await recordPowerEventFirestore(isNowOut ? 'out' : 'in', now);
      setIsSyncing(false);

      if (isNowOut) {
        playOutChime(settings.soundEnabled);
        showToast('⚡ Electricity Out saved to Firestore · Generator ON');
      } else {
        playInChime(settings.soundEnabled);
        showToast('💡 Electricity Back saved to Firestore · Generator OFF');
      }
    } catch (err: any) {
      console.error('[Firestore Error] handleTogglePower failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to save power event to Firestore: ${err.message || 'Check firestore.rules'}`);
      showToast('⚠️ Firestore save failed');
    }
  }, [log, outAt, settings, undoTimeout, showToast]);

  // Undo handler using Firestore
  const handleUndo = useCallback(async () => {
    if (!previousState) return;
    playClickSound(settings.soundEnabled);

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const lastEntry = log[log.length - 1];
      if (lastEntry) {
        await deleteLogEntryFirestore(lastEntry.id, previousState.log);
      }
      setIsSyncing(false);
      setPreviousState(null);
      showToast('Reverted previous state in Firestore ✓');
    } catch (err: any) {
      console.error('[Firestore Error] handleUndo failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to undo in Firestore: ${err.message}`);
    }
  }, [previousState, log, settings, showToast]);

  // Delete an entry from Firestore
  const handleDeleteEntry = useCallback(async (index: number) => {
    const target = log[index];
    if (!target) return;

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      await deleteLogEntryFirestore(target.id, log);
      setIsSyncing(false);
      playClickSound(settings.soundEnabled);
      showToast('Entry deleted from Firestore ✓');
    } catch (err: any) {
      console.error('[Firestore Error] handleDeleteEntry failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to delete entry in Firestore: ${err.message}`);
    }
  }, [log, settings, showToast]);

  // Edit or add entry to Firestore
  const handleSaveModalEntry = useCallback(async (
    entryData: { type: 'out' | 'in'; ts: number; note?: string; id?: string },
    editIndex?: number
  ) => {
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const isLatest = typeof editIndex !== 'number' || editIndex === log.length - 1;
      await saveManualLogEntryFirestore(entryData, isLatest);
      setIsSyncing(false);
      showToast('Entry saved to Firestore ✓');
    } catch (err: any) {
      console.error('[Firestore Error] handleSaveModalEntry failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to save entry in Firestore: ${err.message}`);
    }
  }, [log, showToast]);

  // Clear all logs from Firestore with confirmation
  const handleClearAll = useCallback(async () => {
    if (log.length === 0 && outAt === null) return;
    if (window.confirm('Clear all recorded entries from Firestore online database?')) {
      setIsSyncing(true);
      setErrorMessage(null);

      try {
        await clearAllLogsFirestore();
        setIsSyncing(false);
        setLog([]);
        setOutAt(null);
        showToast('All logs cleared from Firestore ✓');
      } catch (err: any) {
        console.error('[Firestore Error] handleClearAll failed:', err);
        setIsSyncing(false);
        setErrorMessage(`Failed to clear logs in Firestore: ${err.message}`);
      }
    }
  }, [log, outAt, showToast]);

  // Keyboard shortcuts listener for PC users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === ' ' || e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        handleTogglePower();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const text = getFullReportText(log);
        if (text) {
          navigator.clipboard.writeText(text).then(() => showToast('Report copied ✓'));
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingEntry(null);
        setIsManualModalOpen(true);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setSettings((s) => {
          const next = { ...s, soundEnabled: !s.soundEnabled };
          saveSettings(next);
          showToast(next.soundEnabled ? 'Sounds unmuted' : 'Sounds muted');
          return next;
        });
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setIsManualModalOpen(false);
        setIsSettingsOpen(false);
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePower, log, showToast]);

  // Generator analytics calculations
  const generatorStats = useMemo(() => {
    const segments = computeOutageSegments(log, outAt, currentTime.getTime());
    let totalMinutes = 0;
    segments.forEach((s) => {
      totalMinutes += s.durationMinutes;
    });

    const hours = totalMinutes / 60;
    const fuelLiters = hours * settings.fuelRateLitersPerHour;
    const estimatedCost = fuelLiters * settings.fuelCostPerLiter;

    return {
      runMinutes: totalMinutes,
      fuelLiters: fuelLiters.toFixed(1),
      estimatedCost: estimatedCost.toFixed(2),
    };
  }, [log, outAt, currentTime, settings]);

  return (
    <div className="min-h-screen bg-[#0a0d1c] dark:bg-[#0a0d1c] text-[#eef1ff] relative overflow-x-hidden transition-colors selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Ambient background glowing blobs */}
      <div className="fixed -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none animate-blob-slow" />
      <div className="fixed -bottom-32 -right-32 w-96 h-96 rounded-full bg-fuchsia-600/20 blur-3xl pointer-events-none animate-blob-reverse" />

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 md:pb-12 pt-safe pl-safe pr-safe">
        {/* Error Message Banner */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg backdrop-blur-md animate-fade">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-none" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-rose-300 hover:text-white hover:bg-rose-500/20 transition flex-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <Header
          currentTime={currentTime}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          soundEnabled={settings.soundEnabled}
          onToggleSound={() => {
            const next = { ...settings, soundEnabled: !settings.soundEnabled };
            setSettings(next);
            saveSettings(next);
            showToast(next.soundEnabled ? 'Sounds unmuted' : 'Sounds muted');
          }}
          onOpenManualEntry={() => {
            setEditingEntry(null);
            setIsManualModalOpen(true);
          }}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          isSyncing={isSyncing}
          networkError={!!errorMessage}
          isInitialLoading={isInitialLoading}
        />

        {/* Initial Loading Shimmer */}
        {isInitialLoading && (
          <div className="my-8 p-6 rounded-3xl bg-white/5 border border-slate-700/60 flex flex-col items-center justify-center gap-3 text-center backdrop-blur-md animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-300">
              Connecting to Firestore &amp; fetching online power grid records...
            </div>
          </div>
        )}

        {/* Responsive Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mt-4 items-start">
          {/* Left Column (Primary Control & Telemetry on desktop, Top section on mobile) */}
          <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
            {/* The Main Tactile Power Control Card */}
            <PowerControlCard
              isOutage={outAt !== null}
              outageSeconds={outageSeconds}
              stableSeconds={stableSeconds}
              onTogglePower={handleTogglePower}
              canUndo={!!previousState}
              onUndo={handleUndo}
            />

            {/* Generator Runtime & Fuel Telemetry Card */}
            <section className="rounded-3xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xl shadow-indigo-950/5 dark:shadow-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Generator Telemetry
                  </h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[11px] font-semibold text-indigo-500 hover:underline"
                >
                  Configure Rates
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Runtime
                  </div>
                  <div className="font-mono tabular-nums text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                    {formatDurationMinutes(generatorStats.runMinutes)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Est. Fuel
                  </div>
                  <div className="font-mono tabular-nums text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                    {generatorStats.fuelLiters} L
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Est. Cost
                  </div>
                  <div className="font-mono tabular-nums text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {settings.currencySymbol}{generatorStats.estimatedCost}
                  </div>
                </div>
              </div>
            </section>

            {/* Operational Workflow Guide (Desktop Placement) */}
            <div className="hidden lg:block">
              <WorkflowGuide />
            </div>
          </div>

          {/* Right Column (24h Interactive Graph & Report Log) */}
          <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-6">
            {/* Interactive 24-Hour Timeline Chart */}
            <TimelineChart
              log={log}
              outAt={outAt}
              settings={settings}
              onToast={showToast}
            />

            {/* Outage Log & Shift Report */}
            <ReportLog
              log={log}
              outAt={outAt}
              onDeleteEntry={handleDeleteEntry}
              onEditEntry={(entry, index) => {
                setEditingEntry({ entry, index });
                setIsManualModalOpen(true);
              }}
              onClearAll={handleClearAll}
              onToast={showToast}
            />

            {/* Operational Workflow Guide (Mobile/Tablet Placement) */}
            <div className="lg:hidden">
              <WorkflowGuide />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium pb-4">
          <p>
            Crafted by{' '}
            <span className="font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Safikul Islam
            </span>{' '}
            · VoltLog Online Firestore Edition
          </p>
        </footer>
      </main>

      {/* Floating Mobile Bar */}
      {isScrolledDown && (
        <FloatingMobileBar
          isOutage={outAt !== null}
          onTogglePower={handleTogglePower}
          onCopyAll={() => {
            const text = getFullReportText(log);
            if (text) {
              navigator.clipboard.writeText(text).then(() => showToast('Report copied ✓'));
            }
          }}
          hasEntries={log.length > 0}
        />
      )}

      {/* Modals */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveModalEntry}
        editingEntry={editingEntry}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          saveSettings(newSettings);
        }}
        log={log}
        outAt={outAt}
        onImportJSON={(data) => {
          setLog(data.log);
          setOutAt(data.outAt);
        }}
        onClearAll={handleClearAll}
        onToast={showToast}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold shadow-2xl border border-slate-700 dark:border-slate-200 pointer-events-none animate-bounce transition-all text-center max-w-[90vw] truncate">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
