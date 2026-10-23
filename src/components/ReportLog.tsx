import React, { useState, useMemo } from 'react';
import { LogEntry } from '../types';
import { 
  fmtTime, 
  fmtDateShort, 
  getSingleEntryText, 
  getFullReportText, 
  getWhatsAppReportText,
  exportToCSV,
  exportToJSON
} from '../utils/storage';
import { 
  Copy, 
  Check, 
  Trash2, 
  FileDown, 
  Share2, 
  Filter, 
  Search, 
  Edit3, 
  Zap, 
  ZapOff,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';

interface ReportLogProps {
  log: LogEntry[];
  outAt: number | null;
  onDeleteEntry: (index: number) => void;
  onEditEntry: (entry: LogEntry, index: number) => void;
  onClearAll: () => void;
  onToast: (msg: string) => void;
  onAddSampleData?: () => void;
}

export const ReportLog: React.FC<ReportLogProps> = ({
  log,
  outAt,
  onDeleteEntry,
  onEditEntry,
  onClearAll,
  onToast,
  onAddSampleData,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [filterType, setFilterType] = useState<'all' | 'out' | 'in'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filtered log calculation
  const filteredLogWithIndex = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    return log.map((entry, originalIndex) => ({ entry, originalIndex }))
      .filter(({ entry }) => {
        // Filter by type
        if (filterType !== 'all' && entry.type !== filterType) return false;

        // Filter by date
        if (filterDate === 'today' && entry.ts < todayStart) return false;
        if (filterDate === 'yesterday' && (entry.ts < yesterdayStart || entry.ts >= todayStart)) return false;
        if (filterDate === 'week' && entry.ts < weekStart) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const timeStr = fmtTime(entry.ts).toLowerCase();
          const dateStr = fmtDateShort(entry.ts).toLowerCase();
          const noteStr = (entry.note || '').toLowerCase();
          const typeStr = entry.type === 'out' ? 'electricity out generator on' : 'electricity back generator off';
          if (!timeStr.includes(q) && !dateStr.includes(q) && !noteStr.includes(q) && !typeStr.includes(q)) {
            return false;
          }
        }

        return true;
      });
  }, [log, filterDate, filterType, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, onDone: () => void) => {
    if (!text) {
      onToast('Nothing to copy yet');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        onToast('Copied to clipboard ✓');
        onDone();
      },
      () => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          onToast('Copied to clipboard ✓');
          onDone();
        } catch {
          onToast('Could not copy to clipboard');
        }
        document.body.removeChild(textarea);
      }
    );
  };

  const handleCopySingle = (entry: LogEntry, index: number) => {
    handleCopy(getSingleEntryText(entry), () => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  const handleCopyAll = () => {
    handleCopy(getFullReportText(log), () => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    });
  };

  const handleCopyWhatsApp = () => {
    handleCopy(getWhatsAppReportText(log), () => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 1500);
    });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 lg:p-7 shadow-xl shadow-indigo-950/5 dark:shadow-black/40 flex flex-col justify-between transition-all">
      {/* Top Header & Entry Counter */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Shift &amp; Outage Report
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono tabular-nums">
              {log.length} {log.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Quick Filter Buttons (Segmented Controls) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilterDate('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterDate === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterDate('today')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterDate === 'today'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilterDate('week')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterDate === 'week'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>

        {/* Search bar & Secondary Type Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by time, date, note..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterType(filterType === 'all' ? 'out' : filterType === 'out' ? 'in' : 'all')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition flex items-center gap-1.5 shrink-0"
              title="Filter by status type"
            >
              <Filter className="w-3 h-3 text-slate-400" />
              <span>
                {filterType === 'all' ? 'All Types' : filterType === 'out' ? 'Outages Only' : 'Restores Only'}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Entry Feed */}
        <div className="space-y-2.5 max-h-[460px] lg:max-h-[500px] overflow-y-auto pr-1">
          {filteredLogWithIndex.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
              <ZapOff className="w-8 h-8 text-slate-400 mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {log.length === 0 ? 'No outage logs recorded yet.' : 'No entries match your search criteria.'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                {log.length === 0 
                  ? 'Tap the red Electricity Out button when power cuts to create your first report.'
                  : 'Try clearing the search query or resetting filters.'}
              </p>
              {log.length === 0 && onAddSampleData && (
                <button
                  onClick={onAddSampleData}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample 24h Data</span>
                </button>
              )}
            </div>
          ) : (
            filteredLogWithIndex.map(({ entry, originalIndex }) => {
              const isOut = entry.type === 'out';
              const isJustCopied = copiedIndex === originalIndex;

              return (
                <div
                  key={entry.id || `entry-${originalIndex}`}
                  className={`group relative flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border transition-all hover:shadow-md ${
                    isOut
                      ? 'border-l-4 border-l-rose-500 border-slate-200/60 dark:border-slate-700/60'
                      : 'border-l-4 border-l-emerald-500 border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {/* Left Single-tap Copy Button (touch target >= 44px) */}
                  <button
                    onClick={() => handleCopySingle(entry, originalIndex)}
                    aria-label="Copy this entry to clipboard"
                    className={`w-11 h-11 flex-none rounded-xl flex items-center justify-center transition-transform active:scale-90 shadow-sm ${
                      isJustCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/20'
                    }`}
                    title="Copy formatted entry for WhatsApp/SMS"
                  >
                    {isJustCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0 font-mono">
                    <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {fmtDateShort(entry.ts)}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                      {isOut ? 'Electricity out: ' : 'Electricity back: '}
                      <span className={isOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {fmtTime(entry.ts)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Automatic Generator: <span className="font-semibold">{isOut ? 'ON' : 'OFF'}</span>
                    </div>
                    {entry.note && (
                      <div className="text-xs font-sans italic text-indigo-600 dark:text-indigo-300 mt-1 bg-indigo-50/50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                        {entry.note}
                      </div>
                    )}
                  </div>

                  {/* Right Actions: Edit & Delete (>= 44px hitboxes) */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditEntry(entry, originalIndex)}
                      aria-label="Edit entry"
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition active:scale-90"
                      title="Edit time or add note"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEntry(originalIndex)}
                      aria-label="Delete entry"
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-90"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Primary Copy All */}
          <button
            onClick={handleCopyAll}
            disabled={log.length === 0}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-98 shadow-md ${
              log.length === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-105 text-white shadow-indigo-500/25'
            }`}
          >
            {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAll ? 'Report Copied ✓' : '📋 Copy All'}</span>
          </button>

          {/* WhatsApp / Messaging Share */}
          <button
            onClick={handleCopyWhatsApp}
            disabled={log.length === 0}
            className={`py-3 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
              log.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20'
            }`}
            title="Copy formatted with emojis for WhatsApp or SMS"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{copiedWhatsApp ? 'Copied' : 'WhatsApp'}</span>
          </button>

          {/* Export Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={log.length === 0}
              className={`w-full sm:w-auto py-3 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition active:scale-95 ${
                log.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportMenu && log.length > 0 && (
              <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 overflow-hidden text-xs">
                <button
                  onClick={() => {
                    exportToCSV(log);
                    setShowExportMenu(false);
                    onToast('CSV exported');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <span>📊 Export to CSV (Excel)</span>
                </button>
                <button
                  onClick={() => {
                    exportToJSON(log, outAt);
                    setShowExportMenu(false);
                    onToast('JSON backup exported');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <span>💾 Export JSON Backup</span>
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <span>🖨️ Print / Save as PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear All */}
          <button
            onClick={onClearAll}
            disabled={log.length === 0 && outAt === null}
            className={`py-3 px-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
              log.length === 0 && outAt === null
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
            }`}
            title="Clear all recorded entries"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </section>
  );
};
