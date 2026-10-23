import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Zap, CheckCircle2, Copy, Smartphone, ShieldCheck } from 'lucide-react';

export const WorkflowGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      num: 1,
      title: 'Power goes out',
      desc: 'Tap the red Electricity Out button (or press Space on PC). The exact timestamp is logged and the automatic generator is marked ON.',
      icon: <Zap className="w-4 h-4 text-rose-500" />
    },
    {
      num: 2,
      title: 'Power returns',
      desc: 'Tap the same button again (now green Electricity Back). The restoration timestamp is logged and the generator is marked OFF.',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    },
    {
      num: 3,
      title: 'Live 24h timeline',
      desc: 'The interactive power graph automatically graphs outage segments, calculates uptime percentage, and tracks total downtime in real time.',
      icon: <ShieldCheck className="w-4 h-4 text-indigo-500" />
    },
    {
      num: 4,
      title: 'Copy & Send report',
      desc: 'Tap 📋 on any single entry or click Copy All to paste into WhatsApp, Slack, SMS, or building management logs.',
      icon: <Copy className="w-4 h-4 text-purple-500" />
    },
    {
      num: 5,
      title: 'Made a mistake?',
      desc: 'Use the ✏️ edit icon to adjust the time or add a note. You can also add past missed outages using the "+ Past Entry" button.',
      icon: <Smartphone className="w-4 h-4 text-amber-500" />
    },
    {
      num: 6,
      title: '100% Offline & Private',
      desc: 'Works offline as an installable PWA. Your outage history is safely stored in this browser with zero external tracking.',
      icon: <ShieldCheck className="w-4 h-4 text-teal-500" />
    }
  ];

  return (
    <section className="rounded-3xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xl shadow-indigo-950/5 dark:shadow-black/40 transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200 focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <span>📖 Guide &amp; Operational Workflow</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex-none flex items-center justify-center font-bold text-[11px] shadow-sm">
                {step.num}
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                  {step.title}
                </div>
                <div className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
