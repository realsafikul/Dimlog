import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { 
  subscribeToPowerStatus, 
  subscribeToOutageLogs, 
  recordPowerEventFirestore, 
  saveManualLogEntryFirestore, 
  softDeleteLogEntryFirestore
} from './services/firestore';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { PowerControlCard } from './components/PowerControlCard';
import { TimelineChart } from './components/TimelineChart';
import { ReportLog } from './components/ReportLog';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WorkflowGuide } from './components/WorkflowGuide';
import { FloatingMobileBar } from './components/FloatingMobileBar';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Flame, Loader2, AlertCircle, Clock, X, ShieldAlert } from 'lucide-react';

function AppContent() {
  const { 
    currentUser, 
    userProfile, 
    isAdmin, 
    isApproved, 
    userRole, 
    canCreate, 
    canEditEntry, 
    canDeleteEntry 
  } = useAuth();

  // Main data state directly synchronized with Firebase Realtime Database
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outAt, setOutAt] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Loading & error states
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Undo state (only available if user can perform actions)
  const [previousState, setPreviousState] = useState<{ log: LogEntry[]; outAt: number | null } | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ entry: LogEntry; index: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

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

  // Sync theme with HTML root and body element
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body?.classList.add('dark');
      body?.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      body?.classList.add('light');
      body?.classList.remove('dark');
    }
    localStorage.setItem('voltlog-theme', theme);
  }, [theme]);

  // Load cached records immediately on 0ms so the user never waits
  useEffect(() => {
    const cached = loadStoredData();
    if (cached.log && cached.log.length > 0) {
      setLog(cached.log);
      setOutAt(cached.outAt);
    }
  }, []);

  // Real-time Cloud database synchronization on mount
  useEffect(() => {
    setIsInitialLoading(true);
    let unsubStatus: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    // Safety timeout: ensure loading state never blocks the UI
    const safetyTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1200);

    try {
      // 1. Live listener for power_status
      unsubStatus = subscribeToPowerStatus(
        (statusDoc) => {
          setErrorMessage(null);
          if (statusDoc) {
            setOutAt(statusDoc.isOutage ? statusDoc.outAt : null);
          }
        },
        (error) => {
          console.error('[Firebase Error] Failed to fetch live power status:', error);
        }
      );

      // 2. Live listener for outage logs
      unsubLogs = subscribeToOutageLogs(
        (cloudLogs) => {
          clearTimeout(safetyTimer);
          setIsInitialLoading(false);
          setErrorMessage(null);
          if (cloudLogs) {
            setLog(cloudLogs);
            saveStoredData(cloudLogs, outAt);
          }
        },
        (error) => {
          console.error('[Firebase Error] Failed to fetch outage logs:', error);
          clearTimeout(safetyTimer);
          setIsInitialLoading(false);
        }
      );
    } catch (err: any) {
      console.error('[Firebase Error] Initialization failed:', err);
      clearTimeout(safetyTimer);
      setIsInitialLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubStatus) unsubStatus();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  // Real-time clock ticker
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

  // Power toggle handler (Restricted to authorized users)
  const handleTogglePower = useCallback(async () => {
    if (!canCreate) {
      setIsAuthModalOpen(true);
      showToast('🔒 Please sign in to record power events');
      return;
    }

    const now = Date.now();
    setPreviousState({ log: [...log], outAt });
    if (undoTimeout) clearTimeout(undoTimeout);
    const t = setTimeout(() => setPreviousState(null), 9000);
    setUndoTimeout(t);

    triggerHaptic(45, settings.hapticsEnabled);
    const isNowOut = outAt === null;

    setIsSyncing(true);
    setErrorMessage(null);

    const operatorName = userProfile?.username || currentUser?.displayName || 'Operator';
    const operatorUid = currentUser?.uid || 'user';

    try {
      await recordPowerEventFirestore(
        isNowOut ? 'out' : 'in', 
        now, 
        { uid: operatorUid, name: operatorName }
      );
      setIsSyncing(false);

      if (isNowOut) {
        playOutChime(settings.soundEnabled);
        showToast('⚡ Electricity Out recorded · Generator ON');
      } else {
        playInChime(settings.soundEnabled);
        showToast('💡 Electricity Back recorded · Generator OFF');
      }
    } catch (err: any) {
      console.error('[Firebase Error] handleTogglePower failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to save power event to database: ${err.message}`);
      showToast('⚠️ Database save failed');
    }
  }, [canCreate, log, outAt, settings, undoTimeout, showToast, userProfile, currentUser]);

  // Undo handler (Restricted to authorized users)
  const handleUndo = useCallback(async () => {
    if (!previousState || !canCreate) return;
    playClickSound(settings.soundEnabled);

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const lastEntry = log[log.length - 1];
      if (lastEntry) {
        await softDeleteLogEntryFirestore(
          lastEntry, 
          log, 
          { uid: currentUser?.uid || 'user', name: userProfile?.username || 'Operator' }
        );
      }
      setIsSyncing(false);
      setPreviousState(null);
      showToast('Reverted previous state (moved to Trash) ✓');
    } catch (err: any) {
      console.error('[Firebase Error] handleUndo failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to undo: ${err.message}`);
    }
  }, [previousState, canCreate, log, settings, showToast, currentUser, userProfile]);

  // Soft delete an entry to Trash with confirmation
  const handleDeleteEntry = useCallback(async (index: number) => {
    const target = log[index];
    if (!target) return;

    if (!canDeleteEntry(target)) {
      showToast('🔒 You are not authorized to delete this entry');
      return;
    }

    if (!window.confirm('Move this log entry to Trash? (Admin can restore it later)')) {
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);

    const userName = userProfile?.username || currentUser?.displayName || 'Operator';
    const userUid = currentUser?.uid || 'user';

    try {
      await softDeleteLogEntryFirestore(target, log, { uid: userUid, name: userName });
      setIsSyncing(false);
      playClickSound(settings.soundEnabled);
      showToast('Entry moved to Trash ✓');
    } catch (err: any) {
      console.error('[Firebase Error] handleDeleteEntry failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to delete entry: ${err.message}`);
    }
  }, [log, canDeleteEntry, userProfile, currentUser, settings, showToast]);

  // Edit or add entry to database
  const handleSaveModalEntry = useCallback(async (
    entryData: { 
      type: 'out' | 'in'; 
      ts: number; 
      note?: string; 
      id?: string;
      createdBy?: string;
      createdByName?: string;
      createdAt?: number;
    },
    editIndex?: number
  ) => {
    if (!canCreate) {
      setIsAuthModalOpen(true);
      showToast('🔒 Please sign in to save entries');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);

    const userName = userProfile?.username || currentUser?.displayName || 'Operator';
    const userUid = currentUser?.uid || 'user';

    try {
      const isLatest = typeof editIndex !== 'number' || editIndex === log.length - 1;
      await saveManualLogEntryFirestore(
        entryData, 
        isLatest, 
        { uid: userUid, name: userName }
      );
      setIsSyncing(false);
      showToast('Entry saved to database ✓');
    } catch (err: any) {
      console.error('[Firebase Error] handleSaveModalEntry failed:', err);
      setIsSyncing(false);
      setErrorMessage(`Failed to save entry: ${err.message}`);
    }
  }, [canCreate, log, showToast, userProfile, currentUser]);

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
        if (!canCreate) {
          setIsAuthModalOpen(true);
          showToast('🔒 Please log in to add entries');
        } else {
          setEditingEntry(null);
          setIsManualModalOpen(true);
        }
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
        setIsAdminPanelOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePower, log, showToast, canCreate]);

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
    <div className="min-h-screen bg-slate-100 dark:bg-[#0a0d1c] text-slate-800 dark:text-[#eef1ff] relative overflow-x-hidden transition-colors duration-300 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Ambient glowing blobs */}
      <div className="fixed -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/25 blur-3xl pointer-events-none animate-blob-slow" />
      <div className="fixed -bottom-32 -right-32 w-96 h-96 rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-600/20 blur-3xl pointer-events-none animate-blob-reverse" />

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 md:pb-12 pt-safe pl-safe pr-safe">
        {/* Pending Approval Notice Banner for Logged In Pending Users */}
        {currentUser && !isApproved && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg backdrop-blur-md animate-fade">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-none animate-pulse" />
              <span>
                <strong>Access Pending:</strong> Your account (@{userProfile?.username || currentUser.displayName}) is waiting for Super Admin approval. You can view all records in real time.
              </span>
            </div>
          </div>
        )}

        {/* Disabled Account Notice */}
        {currentUser && userProfile?.status === 'disabled' && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 shadow-lg backdrop-blur-md">
            <ShieldAlert className="w-5 h-5 text-rose-500 dark:text-rose-400 flex-none" />
            <span>
              Your account has been deactivated by the Super Admin. Please contact support if this was unexpected.
            </span>
          </div>
        )}

        {/* Error Message Banner */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg backdrop-blur-md animate-fade">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 flex-none" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-300 hover:text-white hover:bg-rose-500/20 transition flex-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header with Auth Status & Admin Panel Trigger */}
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
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        />

        {/* Initial Loading Indicator */}
        {isInitialLoading && (
          <div className="my-8 p-6 rounded-3xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center gap-3 text-center backdrop-blur-md animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Connecting to Firebase Realtime Database &amp; syncing online power grid records...
            </div>
          </div>
        )}

        {/* Responsive Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mt-4 items-start">
          {/* Left Column (Primary Control & Telemetry) */}
          <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
            {/* The Main Tactile Power Control Card */}
            <PowerControlCard
              isOutage={outAt !== null}
              outageSeconds={outageSeconds}
              stableSeconds={stableSeconds}
              onTogglePower={handleTogglePower}
              canUndo={!!previousState}
              onUndo={handleUndo}
              canAction={canCreate}
              onUnauthorizedAction={() => {
                setIsAuthModalOpen(true);
                showToast('🔒 Please sign in to record power events');
              }}
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
                if (!canEditEntry(entry)) {
                  showToast('🔒 You are not authorized to edit this entry');
                  return;
                }
                setEditingEntry({ entry, index });
                setIsManualModalOpen(true);
              }}
              onToast={showToast}
              onOpenAuth={() => setIsAuthModalOpen(true)}
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
            · VoltLog Multi-User Cloud Edition
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
          canAction={canCreate}
          onUnauthorizedAction={() => {
            setIsAuthModalOpen(true);
            showToast('🔒 Please sign in to record power events');
          }}
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
        onToast={showToast}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onToast={showToast}
      />

      {/* Super Admin Panel */}
      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        logs={log}
        outAt={outAt}
        settings={settings}
        onEditLog={(entry, index) => {
          setEditingEntry({ entry, index });
          setIsManualModalOpen(true);
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

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
