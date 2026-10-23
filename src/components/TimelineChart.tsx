import React, { useRef, useState, useEffect, useMemo } from 'react';
import { LogEntry, AppSettings } from '../types';
import { fmtTime, formatDurationMinutes } from '../utils/storage';
import { Activity, Clock, Flame, Percent, Zap } from 'lucide-react';

interface TimelineChartProps {
  log: LogEntry[];
  outAt: number | null;
  settings: AppSettings;
  onToast: (msg: string) => void;
}

interface HoverInfo {
  x: number;
  y: number;
  timeStr: string;
  isOutage: boolean;
  durationStr?: string;
  generatorOn: boolean;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  log,
  outAt,
  settings,
  onToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // ResizeObserver for rock-solid responsiveness across foldables, mobile, tablet, and PC
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const now = Date.now();
  const t0 = now - 24 * 60 * 60 * 1000; // 24 hours ago

  // Responsive dimensions
  const isMobile = containerWidth < 500;
  const isTablet = containerWidth >= 500 && containerWidth < 850;
  
  const pl = isMobile ? 44 : isTablet ? 54 : 64;
  const pr = isMobile ? 16 : 24;
  const pt = 16;
  const hE = isMobile ? 120 : 150;
  const gap = 16;
  const hG = isMobile ? 54 : 64;
  const pb = 32;
  const H = pt + hE + gap + hG + pb;
  const iw = Math.max(containerWidth - pl - pr, 180);
  const R = pl + iw;

  const timeToX = (t: number) => pl + ((t - t0) / (24 * 60 * 60 * 1000)) * iw;

  // Compute outage segments in the past 24h
  const { segments, totalOutageMinutes, longestMinutes, uptimePercent } = useMemo(() => {
    const rawSegs: Array<{ o: number; e: number; live: boolean }> = [];
    let curOut: number | null = null;

    log.forEach((entry) => {
      if (entry.type === 'out') {
        curOut = entry.ts;
      } else if (curOut !== null) {
        rawSegs.push({ o: curOut, e: entry.ts, live: false });
        curOut = null;
      }
    });

    if (curOut !== null || outAt !== null) {
      const liveStart = outAt ?? curOut ?? now;
      rawSegs.push({ o: liveStart, e: now, live: true });
    }

    // Filter to last 24h
    const valid = rawSegs
      .filter((s) => s.e > t0)
      .map((s) => ({
        ...s,
        clampedStart: Math.max(s.o, t0),
      }));

    let tot = 0;
    let longest = 0;
    valid.forEach((s) => {
      const dur = (s.e - s.clampedStart) / 60000;
      tot += dur;
      if (dur > longest) longest = dur;
    });

    const upPct = Math.max(0, Math.min(100, Math.round(((1440 - tot) / 1440) * 100)));

    return {
      segments: valid,
      totalOutageMinutes: tot,
      longestMinutes: longest,
      uptimePercent: upPct,
    };
  }, [log, outAt, now, t0]);

  // Y coordinates
  const eOn = pt + 32;
  const eOff = pt + hE - 16;
  const eB = pt + hE;
  const gy = eB + gap;
  const gOn = gy + 24;
  const gOff = gy + hG - 10;
  const gB = gy + hG;

  const isCurrentLiveOutage = segments.length > 0 && segments[segments.length - 1].live;

  // Path generator for continuous grid line
  const makePath = (base: number, alt: number) => {
    let d = `M${pl},${base}`;
    segments.forEach((seg) => {
      const xa = timeToX(seg.clampedStart);
      const xb = timeToX(seg.e);
      d += ` L${xa},${base} L${xa},${alt} L${xb},${alt}`;
      if (!seg.live) {
        d += ` L${xb},${base}`;
      }
    });
    return d + (isCurrentLiveOutage ? '' : ` L${R},${base}`);
  };

  // Hour grid ticks
  const ticks = useMemo(() => {
    const list: Array<{ x: number; hour: number; label: string }> = [];
    const d = new Date(t0);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);

    while (d.getTime() <= now) {
      const h = d.getHours();
      const x = timeToX(d.getTime());
      const label = `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
      list.push({ x, hour: h, label });
      d.setHours(d.getHours() + 1);
    }
    return list;
  }, [t0, now, containerWidth, pl, iw]);

  const step = isMobile ? 6 : isTablet ? 3 : 2;

  // Fuel calculation
  const fuelUsedLiters = ((totalOutageMinutes / 60) * settings.fuelRateLitersPerHour).toFixed(1);

  // Touch and mouse scrub interaction
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    if (clientX < pl || clientX > R) {
      setHoverInfo(null);
      return;
    }

    const t = t0 + ((clientX - pl) / iw) * (24 * 60 * 60 * 1000);
    // Check if within any outage segment
    const matchedSeg = segments.find((s) => t >= s.clampedStart && t <= s.e);

    setHoverInfo({
      x: clientX,
      y: isMobile ? 40 : 25,
      timeStr: fmtTime(t),
      isOutage: !!matchedSeg,
      durationStr: matchedSeg ? formatDurationMinutes((matchedSeg.e - matchedSeg.o) / 60000) : undefined,
      generatorOn: !!matchedSeg,
    });
  };

  const handlePointerLeave = () => {
    setHoverInfo(null);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 lg:p-7 shadow-xl shadow-indigo-950/5 dark:shadow-black/40 transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            24-Hour Power Graph
          </h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
          Rolling 24 Hours
        </span>
      </div>

      {/* Interactive SVG Chart Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none touch-none">
        <svg
          width={containerWidth}
          height={H}
          viewBox={`0 0 ${containerWidth} ${H}`}
          className="block w-full"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Grid electricity gradient fill */}
            <linearGradient id="chart-grid-green" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Generator amber gradient fill */}
            <linearGradient id="chart-gen-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>

            {/* Outage rose highlight */}
            <linearGradient id="chart-outage-rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.06" />
            </linearGradient>

            {/* Panel clip paths */}
            <clipPath id="clip-elec">
              <rect x={pl} y={pt} width={iw} height={hE} rx="16" />
            </clipPath>
            <clipPath id="clip-gen">
              <rect x={pl} y={gy} width={iw} height={hG} rx="16" />
            </clipPath>
          </defs>

          {/* Background Panels */}
          <rect
            x={pl}
            y={pt}
            width={iw}
            height={hE}
            rx="16"
            className="fill-slate-100/60 dark:fill-slate-800/50 stroke-slate-200/60 dark:stroke-slate-700/50"
          />
          <rect
            x={pl}
            y={gy}
            width={iw}
            height={hG}
            rx="16"
            className="fill-slate-100/60 dark:fill-slate-800/50 stroke-slate-200/60 dark:stroke-slate-700/50"
          />

          {/* Electricity Track Background & Outage Zones */}
          <g clipPath="url(#clip-elec)">
            {/* Vertical hour guidelines */}
            {ticks.map((t) => (
              <line
                key={`egl-${t.x}`}
                x1={t.x}
                x2={t.x}
                y1={pt}
                y2={eB}
                className={`stroke-slate-200 dark:stroke-slate-800 ${t.hour % step === 0 ? 'opacity-80' : 'opacity-30 stroke-dasharray-2-4'}`}
                strokeWidth="1"
              />
            ))}

            {/* Shaded Red Outage Zones */}
            {segments.map((seg, idx) => {
              const xa = timeToX(seg.clampedStart);
              const xb = timeToX(seg.e);
              const w = Math.max(xb - xa, 3);
              return (
                <rect
                  key={`out-zone-${idx}`}
                  x={xa}
                  y={pt}
                  width={w}
                  height={hE}
                  fill="url(#chart-outage-rose)"
                />
              );
            })}

            {/* Filled Green Electricity Normal Surface */}
            <path
              d={`${makePath(eOn, eOff)} L${R},${eB} L${pl},${eB} Z`}
              fill="url(#chart-grid-green)"
            />
          </g>

          {/* Generator Track Background & Running Zones */}
          <g clipPath="url(#clip-gen)">
            {/* Guidelines */}
            {ticks.map((t) => (
              <line
                key={`ggl-${t.x}`}
                x1={t.x}
                x2={t.x}
                y1={gy}
                y2={gB}
                className={`stroke-slate-200 dark:stroke-slate-800 ${t.hour % step === 0 ? 'opacity-80' : 'opacity-30 stroke-dasharray-2-4'}`}
                strokeWidth="1"
              />
            ))}

            {/* Shaded Amber Generator Zones */}
            {segments.map((seg, idx) => {
              const xa = timeToX(seg.clampedStart);
              const xb = timeToX(seg.e);
              const w = Math.max(xb - xa, 3);
              return (
                <rect
                  key={`gen-zone-${idx}`}
                  x={xa}
                  y={gOn}
                  width={w}
                  height={gB - gOn}
                  fill="url(#chart-gen-amber)"
                />
              );
            })}
          </g>

          {/* Electricity High-Contrast Line */}
          <path
            d={makePath(eOn, eOff)}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Generator High-Contrast Line */}
          <path
            d={makePath(gOff, gOn)}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            opacity="0.5"
            strokeLinejoin="round"
          />

          {/* Outage Bars, Node Dots & Interactive Tap Hits */}
          {segments.map((seg, idx) => {
            const xa = timeToX(seg.clampedStart);
            const xb = timeToX(seg.e);
            const dur = (seg.e - seg.o) / 60000;
            const msg = `Outage: ${fmtTime(seg.o)}${seg.live ? ' → Ongoing' : ` to ${fmtTime(seg.e)}`} (${formatDurationMinutes(dur)})`;

            return (
              <g key={`hit-${idx}`}>
                {/* Outage line on electricity track */}
                <line
                  x1={xa}
                  x2={xb}
                  y1={eOff}
                  y2={eOff}
                  stroke="#f43f5e"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                {/* Running line on generator track */}
                <line
                  x1={xa}
                  x2={xb}
                  y1={gOn}
                  y2={gOn}
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Circular state node anchors */}
                <circle cx={xa} cy={eOff} r="4.5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                {!seg.live && (
                  <circle cx={xb} cy={eOn} r="4.5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
                )}

                {/* Duration label if wide enough */}
                {xb - xa > 48 && (
                  <text
                    x={(xa + xb) / 2}
                    y={(eOn + eOff) / 2 + 4}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold fill-rose-600 dark:fill-rose-400 select-none"
                  >
                    {formatDurationMinutes(dur)}
                  </text>
                )}

                {/* Click / Tap Target hitbox for mobile & desktop */}
                <rect
                  x={xa}
                  y={pt}
                  width={Math.max(xb - xa, 18)}
                  height={gB - pt}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onToast(msg)}
                />
              </g>
            );
          })}

          {/* Track Labels (Top-Left of panels) */}
          <text
            x={pl + 12}
            y={pt + 18}
            className="text-[10px] font-extrabold tracking-wider fill-slate-500 uppercase select-none"
          >
            GRID ELECTRICITY
          </text>
          <text
            x={pl + 12}
            y={gy + 16}
            className="text-[10px] font-extrabold tracking-wider fill-slate-500 uppercase select-none"
          >
            BACKUP GENERATOR
          </text>

          {/* Left Y-Axis state labels */}
          <text x={pl - 8} y={eOn + 4} textAnchor="end" className="text-[10px] font-bold fill-emerald-500">
            ON
          </text>
          <text x={pl - 8} y={eOff + 4} textAnchor="end" className="text-[10px] font-bold fill-rose-500">
            OUT
          </text>
          <text x={pl - 8} y={gOn + 4} textAnchor="end" className="text-[10px] font-bold fill-amber-500">
            ON
          </text>
          <text x={pl - 8} y={gOff + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">
            OFF
          </text>

          {/* Time axis ticks */}
          {ticks.map((t) => {
            if (t.hour % step === 0 && t.x > pl + 14 && t.x < R - 36) {
              return (
                <text
                  key={`th-${t.x}`}
                  x={t.x}
                  y={H - 10}
                  textAnchor="middle"
                  className="text-[10px] font-mono font-semibold fill-slate-500 select-none"
                >
                  {t.label}
                </text>
              );
            }
            return null;
          })}

          {/* "NOW" Live Needle and Pulsing Beacon */}
          <text
            x={R}
            y={H - 10}
            textAnchor="end"
            className="text-[11px] font-bold fill-indigo-600 dark:fill-indigo-400 select-none"
          >
            Now
          </text>
          <line
            x1={R}
            x2={R}
            y1={pt}
            y2={gB}
            className="stroke-indigo-500/80"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Current state beacon */}
          {(() => {
            const currentY = isCurrentLiveOutage ? eOff : eOn;
            return (
              <g>
                <circle cx={R} cy={currentY} r="7" className="fill-none stroke-indigo-400 animate-ping opacity-60" strokeWidth="2" />
                <circle cx={R} cy={currentY} r="4.5" className="fill-indigo-500 stroke-white dark:stroke-slate-900" strokeWidth="1.5" />
              </g>
            );
          })()}

          {/* Interactive Scrub Hover Line */}
          {hoverInfo && (
            <line
              x1={hoverInfo.x}
              x2={hoverInfo.x}
              y1={pt}
              y2={gB}
              stroke="#6366f1"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}
        </svg>

        {/* Floating Tooltip during hover/scrub */}
        {hoverInfo && (
          <div
            className="absolute pointer-events-none z-20 px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs shadow-xl border border-slate-700 backdrop-blur-md transition-transform"
            style={{
              left: `${Math.min(Math.max(hoverInfo.x - 60, 10), containerWidth - 140)}px`,
              top: `${hoverInfo.y}px`,
            }}
          >
            <div className="font-mono font-bold text-indigo-300">{hoverInfo.timeStr}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${hoverInfo.isOutage ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span className="font-medium">
                {hoverInfo.isOutage ? 'Electricity Out' : 'Grid Active'}
              </span>
            </div>
            {hoverInfo.durationStr && (
              <div className="text-[10px] text-slate-300 mt-0.5">
                Duration: {hoverInfo.durationStr}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Electricity ON
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Electricity OUT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Generator Active
          </span>
        </div>
        <span className="text-[11px] italic hidden sm:inline">
          Tap or hover red zone for outage details
        </span>
      </div>

      {/* 24-Hour Telemetry Metric Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
        {/* Outage Count */}
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>24h Outages</span>
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="font-mono tabular-nums text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {segments.length}
          </div>
        </div>

        {/* Total Downtime */}
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Total Down</span>
            <Clock className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="font-mono tabular-nums text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {segments.length ? formatDurationMinutes(totalOutageMinutes) : '0 min'}
          </div>
        </div>

        {/* Longest Outage */}
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Longest</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="font-mono tabular-nums text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {segments.length ? formatDurationMinutes(longestMinutes) : '—'}
          </div>
        </div>

        {/* Grid Uptime % */}
        <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Power ON</span>
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="font-mono tabular-nums text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {uptimePercent}%
          </div>
        </div>
      </div>
    </section>
  );
};
