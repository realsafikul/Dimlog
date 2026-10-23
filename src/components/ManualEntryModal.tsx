import React, { useState, useEffect } from 'react';
import { LogEntry } from '../types';
import { X, Clock, Calendar, Check, Zap, ZapOff, FileText, User } from 'lucide-react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    entry: { 
      type: 'out' | 'in'; 
      ts: number; 
      note?: string; 
      id?: string;
      createdBy?: string;
      createdByName?: string;
      createdAt?: number;
    }, 
    isEditIndex?: number
  ) => void;
  editingEntry?: { entry: LogEntry; index: number } | null;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEntry,
}) => {
  const [type, setType] = useState<'out' | 'in'>('out');
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (editingEntry) {
      setType(editingEntry.entry.type);
      const d = new Date(editingEntry.entry.ts);
      setDateStr(d.toISOString().slice(0, 10));
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
      setNote(editingEntry.entry.note || '');
    } else {
      setType('out');
      const now = new Date();
      setDateStr(now.toISOString().slice(0, 10));
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
      setNote('');
    }
  }, [editingEntry, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateStr || !timeStr) return;

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, mins] = timeStr.split(':').map(Number);
    const dateObj = new Date(year, month - 1, day, hours, mins, 0, 0);
    const ts = dateObj.getTime();

    onSave(
      {
        type,
        ts,
        note: note.trim() || undefined,
        id: editingEntry?.entry.id,
        createdBy: editingEntry?.entry.createdBy,
        createdByName: editingEntry?.entry.createdByName,
        createdAt: editingEntry?.entry.createdAt,
      },
      editingEntry ? editingEntry.index : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {type === 'out' ? (
              <ZapOff className="w-5 h-5 text-rose-500" />
            ) : (
              <Zap className="w-5 h-5 text-emerald-500" />
            )}
            <h3 className="text-lg font-bold">
              {editingEntry ? 'Edit Outage Entry' : 'Add Past Outage Entry'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {editingEntry && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              Recorded originally by: <strong className="text-slate-700 dark:text-slate-300">{editingEntry.entry.createdByName || 'Legacy / Unknown'}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Status Selection Buttons */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Event Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('out')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                  type === 'out'
                    ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <ZapOff className="w-4 h-4" />
                <span>Electricity Out</span>
              </button>
              <button
                type="button"
                onClick={() => setType('in')}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                  type === 'in'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Electricity Back</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {type === 'out' ? 'Generator will be marked ON' : 'Generator will be marked OFF'}
            </p>
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Transformer trip, scheduled work, heavy rain"
              className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingEntry ? 'Update Entry' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
