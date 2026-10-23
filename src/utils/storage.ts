import { LogEntry, AppSettings, OutageSegment } from '../types';

export const STORAGE_KEY = 'power-report-v1';
export const SETTINGS_KEY = 'voltlog-settings-v1';

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  fuelRateLitersPerHour: 2.2,
  fuelCostPerLiter: 1.15,
  currencySymbol: '$',
};

export function loadStoredData(): { log: LogEntry[]; outAt: number | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { log: [], outAt: null };
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.log)) {
      const normalizedLog: LogEntry[] = parsed.log.map((entry: any, index: number) => ({
        id: entry.id || `entry-${entry.ts}-${index}`,
        type: entry.type === 'out' ? 'out' : 'in',
        ts: Number(entry.ts) || Date.now(),
        note: entry.note || undefined,
      }));
      // Sort chronologically
      normalizedLog.sort((a, b) => a.ts - b.ts);
      
      const outAt = typeof parsed.outAt === 'number' ? parsed.outAt : null;
      return { log: normalizedLog, outAt };
    }
  } catch (err) {
    console.error('Failed to load power-report-v1 data:', err);
  }
  return { log: [], outAt: null };
}

export function saveStoredData(log: LogEntry[], outAt: number | null) {
  try {
    const payload = {
      log: log.map(e => ({
        id: e.id,
        type: e.type,
        ts: e.ts,
        ...(e.note ? { note: e.note } : {})
      })),
      outAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// Formatting helpers
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtTimeWithSeconds(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function fmtDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateFull(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDurationMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatDurationSeconds(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  const remMin = m % 60;
  return `${h}h ${remMin}m ${sec}s`;
}

// Single entry text matching original VoltLog specification
export function getSingleEntryText(entry: LogEntry): string {
  const isOut = entry.type === 'out';
  let text = isOut
    ? `Electricity out: ${fmtTime(entry.ts)}\nAutomatic Generator: ON`
    : `Electricity back: ${fmtTime(entry.ts)}\nAutomatic Generator: OFF`;
  if (entry.note) {
    text += `\nNote: ${entry.note}`;
  }
  return text;
}

// Full report text matching original VoltLog specification
export function getFullReportText(log: LogEntry[]): string {
  if (!log.length) return '';
  return log.map(getSingleEntryText).join('\n\n');
}

// WhatsApp-friendly formatted text
export function getWhatsAppReportText(log: LogEntry[]): string {
  if (!log.length) return '⚡ *VoltLog Power Report*\nNo outage entries recorded.';
  
  let header = `⚡ *VoltLog Power & Generator Report*\nGenerated: ${fmtDateFull(Date.now())} at ${fmtTime(Date.now())}\n`;
  header += `Total Entries: ${log.length}\n`;
  header += `------------------------------------\n\n`;

  const body = log.map((entry, idx) => {
    const isOut = entry.type === 'out';
    const icon = isOut ? '🔴' : '🟢';
    const status = isOut ? 'Electricity OUT' : 'Electricity BACK';
    const genStatus = isOut ? 'Generator: ON' : 'Generator: OFF';
    let line = `${idx + 1}. ${icon} *${status}*: ${fmtTime(entry.ts)} (${fmtDateShort(entry.ts)})\n   ⚙️ ${genStatus}`;
    if (entry.note) {
      line += `\n   📝 Note: ${entry.note}`;
    }
    return line;
  }).join('\n\n');

  return header + body;
}

// CSV Export
export function exportToCSV(log: LogEntry[], filename = 'voltlog-report.csv') {
  if (!log.length) return;
  const headers = ['ID', 'Type', 'Date', 'Time', 'Timestamp_MS', 'Generator_Status', 'Note'];
  const rows = log.map((entry, idx) => {
    const isOut = entry.type === 'out';
    return [
      idx + 1,
      isOut ? 'Electricity Out' : 'Electricity Back',
      `"${fmtDateShort(entry.ts)}"`,
      `"${fmtTime(entry.ts)}"`,
      entry.ts,
      isOut ? 'ON' : 'OFF',
      `"${(entry.note || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// JSON Backup Export
export function exportToJSON(log: LogEntry[], outAt: number | null) {
  const data = {
    app: 'VoltLog',
    version: '2.0',
    exportDate: new Date().toISOString(),
    outAt,
    log,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voltlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Compute paired outage segments from sequential log
export function computeOutageSegments(log: LogEntry[], outAt: number | null, now = Date.now()): OutageSegment[] {
  const segments: OutageSegment[] = [];
  let openOutTs: number | null = null;

  // Chronologically scan entries
  for (const entry of log) {
    if (entry.type === 'out') {
      openOutTs = entry.ts;
    } else if (entry.type === 'in' && openOutTs !== null) {
      const durMin = Math.max(0, (entry.ts - openOutTs) / 60000);
      segments.push({
        outTs: openOutTs,
        inTs: entry.ts,
        live: false,
        durationMinutes: durMin,
        fuelEstimateLiters: (durMin / 60) * 2.2,
        costEstimate: (durMin / 60) * 2.2 * 1.15,
      });
      openOutTs = null;
    }
  }

  // Ongoing live outage
  if (outAt !== null || openOutTs !== null) {
    const start = outAt ?? openOutTs ?? now;
    const durMin = Math.max(0, (now - start) / 60000);
    segments.push({
      outTs: start,
      inTs: now,
      live: true,
      durationMinutes: durMin,
      fuelEstimateLiters: (durMin / 60) * 2.2,
      costEstimate: (durMin / 60) * 2.2 * 1.15,
    });
  }

  return segments;
}
