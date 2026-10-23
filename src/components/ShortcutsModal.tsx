import React from 'react';
import { X, Keyboard, Zap, Copy, PlusCircle, Sun, Volume2 } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space / O', desc: 'Toggle Outage (Electricity Out / Back)', icon: <Zap className="w-4 h-4 text-amber-500" /> },
    { key: 'C', desc: 'Copy full report to clipboard', icon: <Copy className="w-4 h-4 text-indigo-500" /> },
    { key: 'N', desc: 'Add new past/manual outage entry', icon: <PlusCircle className="w-4 h-4 text-emerald-500" /> },
    { key: 'D', desc: 'Toggle Dark / Light theme', icon: <Sun className="w-4 h-4 text-yellow-500" /> },
    { key: 'M', desc: 'Mute / Unmute audio sound effects', icon: <Volume2 className="w-4 h-4 text-purple-500" /> },
    { key: '?', desc: 'Show this keyboard shortcuts guide', icon: <Keyboard className="w-4 h-4 text-slate-400" /> },
    { key: 'Esc', desc: 'Close open dialogs & menus', icon: <X className="w-4 h-4 text-rose-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold">PC Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {shortcuts.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  {item.desc}
                </span>
              </div>
              <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
