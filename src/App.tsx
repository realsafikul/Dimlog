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
import { Header } from './components/Header';
import { PowerControlCard } from './components/PowerControlCard';
import { TimelineChart } from './components/TimelineChart';
import { ReportLog } from './components/ReportLog';
import { ManualEntryModal } from './components/ManualEntryModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WorkflowGuide } from './components/WorkflowGuide';
import { FloatingMobileBar } from './components/FloatingMobileBar';
import { Flame, DollarSign, Activity, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function App() {
  // Main state synced with localStorage key "power-report-v1"
  const [log, setLog] = useState<LogEntry[]>([]);
  const [outAt, setOutAt] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Show floating bar when scrolled down on mobile
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  // Load initial data from localStorage on mount
  useEffect(() => {
    const data = loadStoredData();
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

  // Persist state to localStorage
  const updateData = useCallback((newLog: LogEntry[], newOutAt: number | null) => {
    setLog(newLog);
    setOutAt(newOutAt);
    saveStoredData(newLog, newOutAt);
  }, []);

  // Toast trigger helper
  const showToast = useCallback((msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMessage(msg);
    const t = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
    setToastTimer(t);
  }, [toastTimer]);

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
    // Find the latest restoration entry
    const lastInEntry = [...log].reverse().find((e) => e.type === 'in');
    if (!lastInEntry) return 0;
    return Math.max(0, Math.floor((nowMs - lastInEntry.ts) / 1000));
  }, [log, outAt, nowMs]);

  // Core 1-tap power toggle handler
  const handleTogglePower = useCallback(() => {
    const now = Date.now();
    // Save previous state for undo capability
    setPreviousState({ log: [...log], outAt });
    if (undoTimeout) clearTimeout(undoTimeout);
    const t = setTimeout(() => setPreviousState(null), 9000);
    setUndoTimeout(t);

    triggerHaptic(45, settings.hapticsEnabled);

    if (outAt === null) {
      // Power cut event
      playOutChime(settings.soundEnabled);
      const newEntry: LogEntry = {
        id: `entry-${now}-${log.length}`,
        type: 'out',
        ts: now,
      };
      const newLog = [...log, newEntry];
      updateData(newLog, now);
      showToast('⚡ Electricity Out recorded · Generator ON');
    } else {
      // Power restored event
      playInChime(settings.soundEnabled);
      const newEntry: LogEntry = {
        id: `entry-${now}-${log.length}`,
        type: 'in',
        ts: now,
      };
      const newLog = [...log, newEntry];
      updateData(newLog, null);
      showToast('💡 Electricity Back recorded · Generator OFF');
    }
  }, [log, outAt, settings, undoTimeout, updateData, showToast]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (!previousState) return;
    playClickSound(settings.soundEnabled);
    updateData(previousState.log, previousState.outAt);
    setPreviousState(null);
    showToast('Reverted to previous state');
  }, [previousState, settings, updateData, showToast]);

  // Delete an entry
  const handleDeleteEntry = useCallback((index: number) => {
    const newLog = [...log];
    const removed = newLog.splice(index, 1)[0];
    
    // If we removed the active outage entry, recalculate outAt
    let newOutAt = outAt;
    const lastEntry = newLog[newLog.length - 1];
    if (lastEntry && lastEntry.type === 'out') {
      newOutAt = lastEntry.ts;
    } else {
      newOutAt = null;
    }

    updateData(newLog, newOutAt);
    playClickSound(settings.soundEnabled);
    showToast('Entry removed');
  }, [log, outAt, settings, updateData, showToast]);

  // Edit or add entry from modal
  const handleSaveModalEntry = useCallback((entryData: { type: 'out' | 'in'; ts: number; note?: string; id?: string }, editIndex?: number) => {
    const newLog = [...log];
    if (typeof editIndex === 'number' && editIndex >= 0 && editIndex < newLog.length) {
      // Edit existing
      newLog[editIndex] = {
        ...newLog[editIndex],
        type: entryData.type,
        ts: entryData.ts,
        note: entryData.note,
      };
    } else {
      // Add new
      newLog.push({
        id: entryData.id || `manual-${entryData.ts}-${Date.now()}`,
        type: entryData.type,
        ts: entryData.ts,
        note: entryData.note,
      });
    }

    // Sort log chronologically
    newLog.sort((a, b) => a.ts - b.ts);

    // Determine current active status from chronologically latest entry
    const lastEntry = newLog[newLog.length - 1];
    const newOutAt = lastEntry && lastEntry.type === 'out' ? lastEntry.ts : null;

    updateData(newLog, newOutAt);
    showToast(typeof editIndex === 'number' ? 'Entry updated' : 'Past entry added');
  }, [log, updateData, showToast]);

  // Clear all with confirmation
  const handleClearAll = useCallback(() => {
    if (log.length === 0 && outAt === null) return;
    if (window.confirm('Clear all recorded entries and reset VoltLog?')) {
      updateData([], null);
      showToast('All data cleared');
    }
  }, [log, outAt, updateData, showToast]);

  // Sample data generator for testing / previewing full features
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
    updateData(samples, null);
    showToast('Loaded sample 24-hour power events');
  }, [updateData, showToast]);

  // Keyboard shortcuts listener for PC users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
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
            · VoltLog Power Cut &amp; Generator Monitor
          </p>
        </footer>
      </main>

      {/* Floating Mobile Bar (Only active on mobile screens when scrolled) */}
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
          updateData(data.log, data.outAt);
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
