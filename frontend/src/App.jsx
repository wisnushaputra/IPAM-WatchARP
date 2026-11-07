import React from 'react';
import { Activity, Network, ShieldCheck } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              WatchARP
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                IPAM
              </span>
            </h1>
            <p className="text-xs text-slate-400">IP Address Management &amp; Live Network Scanner</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center text-slate-400 gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Reconciliation Engine</span>
          </div>
          <div className="flex items-center text-slate-400 gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Online</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <div className="rounded-lg border border-slate-800 bg-slate-850 p-8 text-center">
          <h2 className="text-base font-medium text-slate-200">WatchARP Frontend Initialized</h2>
          <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
            Vite, React, Tailwind CSS, Lucide icons, and API service client configured.
          </p>
        </div>
      </main>
    </div>
  );
}
