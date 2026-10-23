import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';
import { Database } from 'firebase/database';
import { LogEntry, AppSettings } from './types';
import { 
  loadStoredData, 
  saveStoredData, 
  loadSettings, 
  saveSettings,
  getFullReportText,
  computeOutageSegments,
  formatDurationMinutes
} from './utils/storage';
import { playOutChime, playInChime, playClickSound, triggerHaptic } from './utils/audio';
import { initFirebase, auth as defaultAuth, db as defaultDb } from './firebase/config';
import { 
  subscribeToPowerStatus, 
  subscribeToLogs, 
  recordPowerEventCloud, 
  saveManualEntryCloud, 
  deleteEntryCloud, 
  clearAllCloud 
} from './firebase/db';
import { Header } from './components/Header';
import { PowerControlCard } from './components/PowerControlCard';
import { TimelineChart } from './components/TimelineChart';
import { ReportLog } from './components/ReportLog';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { AuthModal } from './components/AuthModal';
import { MigrationModal } from './components/MigrationModal';
import { WorkflowGuide } from './components/WorkflowGuide';
import { FloatingMobileBar } from './components/FloatingMobileBar';
import { Flame, Cloud, Database as DbIcon, Loader2, RefreshCw } from 'lucide-react';

export default function App() {
  // Main data state
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outAt, setOutAt] = useState<number | null>(null);
  const [localLog, setLocalLog] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Firebase state
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(defaultAuth);
  const [firebaseDb, setFirebaseDb] = useState<Database | null>(defaultDb);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<boolean>(false);

  // Undo state
  const [previousState, setPreviousState] = useState<{ log: LogEntry[]; outAt: number | null } | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ entry: LogEntry; index: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

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

  // Load initial local data from localStorage on mount
  useEffect(() => {
    const data = loadStoredData();
    setLocalLog(data.log);
    // If not yet connected to Firebase, use local data
    setLog(data.log);
    setOutAt(data.outAt);

    // Initial theme detection
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

  // Firebase Auth state listener
  useEffect(() => {
    if (!firebaseAuth) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
      if (user) {
        setNetworkError(false);
      }
    });
    return () => unsubscribe();
  }, [firebaseAuth]);

  // Real-time Database sync: connect immediately to online database
  useEffect(() => {
    if (!firebaseDb) {
      return;
    }

    setIsSyncing(true);
    let unsubStatus: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    try {
      // 1. Subscribe to online power_status
      unsubStatus = subscribeToPowerStatus(
        firebaseDb,
        (statusPayload) => {
          setIsSyncing(false);
          setNetworkError(false);
          if (statusPayload) {
            setOutAt(statusPayload.isOutage ? statusPayload.outAt : null);
          }
        },
        (err) => {
          console.warn('Realtime Database power_status notice:', err);
          setNetworkError(true);
          setIsSyncing(false);
        }
      );

      // 2. Subscribe to online logs
      unsubLogs = subscribeToLogs(
        firebaseDb,
        (cloudLogs) => {
          setIsSyncing(false);
          setNetworkError(false);
          if (cloudLogs && cloudLogs.length > 0) {
            setLog(cloudLogs);
            // Also keep local storage updated as an offline backup
            saveStoredData(cloudLogs, outAt);
          }
        },
        (err) => {
          console.warn('Realtime Database logs notice:', err);
          setNetworkError(true);
          setIsSyncing(false);
        }
      );
    } catch (err) {
      console.error('Firebase subscription initialization notice:', err);
      setNetworkError(true);
      setIsSyncing(false);
    }

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubLogs) unsubLogs();
    };
  }, [firebaseDb]);

  // Handle API key updates
  const handleApiKeySaved = (newKey: string) => {
    const instances = initFirebase(newKey);
    setFirebaseAuth(instances.auth);
    setFirebaseDb(instances.db);
  };

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

  // Core 1-tap power toggle handler (Online Cloud Realtime Database with Local Storage Fallback)
  const handleTogglePower = useCallback(async () => {
    const now = Date.now();
    setPreviousState({ log: [...log], outAt });
    if (undoTimeout) clearTimeout(undoTimeout);
    const t = setTimeout(() => setPreviousState(null), 9000);
    setUndoTimeout(t);

    triggerHaptic(45, settings.hapticsEnabled);
    const isNowOut = outAt === null;

    if (firebaseDb) {
      // Direct Online Cloud update in Firebase Realtime Database
      setIsSyncing(true);
      try {
        await recordPowerEventCloud(
          firebaseDb,
          isNowOut ? 'out' : 'in',
          now,
          currentUser
        );
        setIsSyncing(false);
        setNetworkError(false);

        // Also update local cache for offline resilience
        const newEntry: LogEntry = {
          id: `entry-${now}-${log.length}`,
          type: isNowOut ? 'out' : 'in',
          ts: now,
        };
        const newLog = [...log, newEntry];
        const newOutAt = isNowOut ? now : null;
        setLog(newLog);
        setOutAt(newOutAt);
        saveStoredData(newLog, newOutAt);

        if (isNowOut) {
          playOutChime(settings.soundEnabled);
          showToast('⚡ Electricity Out saved to Firebase Cloud (Online) ✓');
        } else {
          playInChime(settings.soundEnabled);
          showToast('💡 Electricity Back saved to Firebase Cloud (Online) ✓');
        }
      } catch (err: any) {
        console.warn('Firebase online save notice:', err);
        setIsSyncing(false);
        setNetworkError(true);
        // Fallback to local
        const newEntry: LogEntry = {
          id: `entry-${now}-${log.length}`,
          type: isNowOut ? 'out' : 'in',
          ts: now,
        };
        const newLog = [...log, newEntry];
        const newOutAt = isNowOut ? now : null;
        setLog(newLog);
        setOutAt(newOutAt);
        saveStoredData(newLog, newOutAt);
        showToast('Saved locally (Offline/Network warning)');
      }
    } else {
      // Local-only mode
      const newEntry: LogEntry = {
        id: `entry-${now}-${log.length}`,
        type: isNowOut ? 'out' : 'in',
        ts: now,
      };
      const newLog = [...log, newEntry];
      const newOutAt = isNowOut ? now : null;
      setLog(newLog);
      setOutAt(newOutAt);
      saveStoredData(newLog, newOutAt);

      if (isNowOut) {
        playOutChime(settings.soundEnabled);
        showToast('⚡ Electricity Out recorded locally');
      } else {
        playInChime(settings.soundEnabled);
        showToast('💡 Electricity Back recorded locally');
      }
    }
  }, [log, outAt, currentUser, firebaseDb, settings, undoTimeout, showToast]);

  // Undo handler
  const handleUndo = useCallback(async () => {
    if (!previousState) return;
    playClickSound(settings.soundEnabled);

    if (firebaseDb) {
      setIsSyncing(true);
      try {
        const lastEntry = log[log.length - 1];
        if (lastEntry) {
          await deleteEntryCloud(firebaseDb, lastEntry.id, previousState.log, currentUser);
        }
        setIsSyncing(false);
        setPreviousState(null);
        showToast('Reverted cloud state ✓');
      } catch (err: any) {
        setIsSyncing(false);
        setLog(previousState.log);
        setOutAt(previousState.outAt);
        saveStoredData(previousState.log, previousState.outAt);
        setPreviousState(null);
        showToast('Reverted locally');
      }
    } else {
      setLog(previousState.log);
      setOutAt(previousState.outAt);
      saveStoredData(previousState.log, previousState.outAt);
      setPreviousState(null);
      showToast('Reverted to previous state');
    }
  }, [previousState, currentUser, firebaseDb, log, settings, showToast]);

  // Delete an entry
  const handleDeleteEntry = useCallback(async (index: number) => {
    const target = log[index];
    if (!target) return;

    if (firebaseDb) {
      setIsSyncing(true);
      try {
        await deleteEntryCloud(firebaseDb, target.id, log, currentUser);
        setIsSyncing(false);
        playClickSound(settings.soundEnabled);
        showToast('Entry deleted from Firebase Cloud ✓');
      } catch (err: any) {
        setIsSyncing(false);
        const newLog = [...log];
        newLog.splice(index, 1);
        const lastEntry = newLog[newLog.length - 1];
        const newOutAt = lastEntry && lastEntry.type === 'out' ? lastEntry.ts : null;
        setLog(newLog);
        setOutAt(newOutAt);
        saveStoredData(newLog, newOutAt);
        playClickSound(settings.soundEnabled);
        showToast('Entry removed locally');
      }
    } else {
      const newLog = [...log];
      newLog.splice(index, 1);
      const lastEntry = newLog[newLog.length - 1];
      const newOutAt = lastEntry && lastEntry.type === 'out' ? lastEntry.ts : null;
      setLog(newLog);
      setOutAt(newOutAt);
      saveStoredData(newLog, newOutAt);
      playClickSound(settings.soundEnabled);
      showToast('Entry removed locally');
    }
  }, [log, currentUser, firebaseDb, settings, showToast]);

  // Edit or add entry from modal
  const handleSaveModalEntry = useCallback(async (
    entryData: { type: 'out' | 'in'; ts: number; note?: string; id?: string },
    editIndex?: number
  ) => {
    if (firebaseDb) {
      setIsSyncing(true);
      try {
        const entryId = entryData.id || `manual-${entryData.ts}-${Date.now()}`;
        const newEntry: LogEntry = {
          id: entryId,
          type: entryData.type,
          ts: entryData.ts,
          note: entryData.note,
        };
        const isLatest = typeof editIndex !== 'number' || editIndex === log.length - 1;
        await saveManualEntryCloud(firebaseDb, newEntry, currentUser, isLatest);
        setIsSyncing(false);
        showToast('Entry saved to Firebase Cloud ✓');
      } catch (err: any) {
        setIsSyncing(false);
        showToast('Saved locally (Cloud sync error)');
      }
    } else {
      const newLog = [...log];
      if (typeof editIndex === 'number' && editIndex >= 0 && editIndex < newLog.length) {
        newLog[editIndex] = {
          ...newLog[editIndex],
          type: entryData.type,
          ts: entryData.ts,
          note: entryData.note,
        };
      } else {
        newLog.push({
          id: entryData.id || `manual-${entryData.ts}-${Date.now()}`,
          type: entryData.type,
          ts: entryData.ts,
          note: entryData.note,
        });
      }
      newLog.sort((a, b) => a.ts - b.ts);
      const lastEntry = newLog[newLog.length - 1];
      const newOutAt = lastEntry && lastEntry.type === 'out' ? lastEntry.ts : null;
      setLog(newLog);
      setOutAt(newOutAt);
      saveStoredData(newLog, newOutAt);
      showToast(typeof editIndex === 'number' ? 'Entry updated locally' : 'Past entry added locally');
    }
  }, [currentUser, firebaseDb, log, showToast]);

  // Clear all logs with confirmation
  const handleClearAll = useCallback(async () => {
    if (log.length === 0 && outAt === null) return;
    if (window.confirm('Clear all recorded entries in VoltLog?')) {
      if (firebaseDb) {
        setIsSyncing(true);
        try {
          await clearAllCloud(firebaseDb, currentUser);
          setIsSyncing(false);
          setLog([]);
          setOutAt(null);
          saveStoredData([], null);
          showToast('All logs cleared from Firebase Cloud ✓');
        } catch (err: any) {
          setIsSyncing(false);
          setLog([]);
          setOutAt(null);
          saveStoredData([], null);
          showToast('Cleared locally');
        }
      } else {
        setLog([]);
        setOutAt(null);
        saveStoredData([], null);
        showToast('All local logs cleared');
      }
    }
  }, [log, outAt, currentUser, firebaseDb, showToast]);

  // Sample data generator for demonstration
  const handleAddSampleData = useCallback(() => {
    const now = Date.now();
    const h = 3600000;
    const samples: LogEntry[] = [
      { id: 'sample-1', type: 'out', ts: now - 18 * h, note: 'Morning grid fluctuation' },
      { id: 'sample-2', type: 'in', ts: now - 17.2 * h },
      { id: 'sample-3', type: 'out', ts: now - 11.5 * h, note: 'Feeder maintenance' },
      { id: 'sample-4', type: 'in', ts: now - 9.8 * h },
      { id: 'sample-5', type: 'out', ts: now - 3.5 * h, note: 'Transformer load shedding' },
      { id: 'sample-6', type: 'in', ts: now - 2.8 * h },
    ];
    setLog(samples);
    setOutAt(null);
    saveStoredData(samples, null);
    showToast('Loaded sample 24-hour power events');
  }, [showToast]);

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
        setIsAuthModalOpen(false);
        setIsMigrationModalOpen(false);
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
          currentUser={currentUser}
          isSyncing={isSyncing}
          networkError={networkError}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          localEntriesCount={localLog.length}
          onOpenMigration={() => setIsMigrationModalOpen(true)}
        />

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
              onAddSampleData={handleAddSampleData}
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
            · VoltLog Cloud Edition (dimlog-d0f35)
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
          saveStoredData(data.log, data.outAt);
        }}
        onClearAll={handleClearAll}
        onToast={showToast}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        auth={firebaseAuth}
        onApiKeySaved={handleApiKeySaved}
        onToast={showToast}
      />

      <MigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        localEntries={localLog}
        database={firebaseDb}
        currentUser={currentUser}
        onMigrationSuccess={(added, skipped) => {
          showToast(`Migrated ${added} records to Firebase!`);
        }}
        onClearLocalData={() => {
          localStorage.removeItem('power-report-v1');
          setLocalLog([]);
        }}
        onToast={showToast}
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
