import React, { useState, useRef } from 'react';
import { AppSettings, LogEntry } from '../types';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  Flame, 
  DollarSign, 
  Upload, 
  Download, 
  Check, 
  SlidersHorizontal 
} from 'lucide-react';
import { exportToJSON } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  log: LogEntry[];
  outAt: number | null;
  onImportJSON: (data: { log: LogEntry[]; outAt: number | null }) => void;
  onToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  log,
  outAt,
  onImportJSON,
  onToast,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onToast('Settings saved');
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.log)) {
          onImportJSON({
            log: parsed.log,
            outAt: typeof parsed.outAt === 'number' ? parsed.outAt : null,
          });
          onToast('Backup imported successfully ✓');
          onClose();
        } else {
          onToast('Invalid JSON backup file');
        }
      } catch {
        onToast('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold">VoltLog Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* Audio & Haptic Toggles */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Tactile &amp; Feedback
            </h4>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {localSettings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">Sound Chimes</div>
                    <div className="text-xs text-slate-500">Audio tones when power cuts or restores</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.soundEnabled}
                  onChange={(e) => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Vibrate className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-sm font-semibold">Vibration Haptics</div>
                    <div className="text-xs text-slate-500">Haptic vibration on mobile button presses</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.hapticsEnabled}
                  onChange={(e) => setLocalSettings({ ...localSettings, hapticsEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Generator Fuel Rates */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Generator Fuel Estimator
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Fuel Rate (Liters / Hour)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={localSettings.fuelRateLitersPerHour}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, fuelRateLitersPerHour: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    L/h
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Fuel Cost per Liter
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {localSettings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={localSettings.fuelCostPerLiter}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, fuelCostPerLiter: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Backup & Restore Data */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Data Management &amp; Backup
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => exportToJSON(log, outAt)}
                disabled={log.length === 0}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500" />
                <span>Export JSON Backup</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-3.5 h-3.5 text-purple-500" />
                <span>Import JSON Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Save & Close */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
