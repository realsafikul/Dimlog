import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VoltLog Uncaught Boundary Error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0d1c] text-[#eef1ff] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white/5 border border-rose-500/30 text-center space-y-4 backdrop-blur-xl shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Something went wrong</h2>
              <p className="text-xs text-slate-400 mt-1">
                VoltLog encountered an unexpected error. Your saved records in Firebase remain safe.
              </p>
            </div>
            {this.state.error && (
              <pre className="p-3 rounded-xl bg-black/40 text-left text-[11px] text-rose-300 font-mono overflow-x-auto max-h-32 border border-rose-500/20">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-indigo-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload VoltLog</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
