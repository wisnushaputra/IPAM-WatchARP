import React from 'react';
import {
  Server,
  Activity,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

/**
 * StatCards Component
 * Renders 4 high-level IPAM and ARP reconciliation metric cards:
 * 1. Total & Utilisasi IP (allocated vs total /24)
 * 2. Perangkat Online (active hosts detected)
 * 3. Rogue Devices (unassigned active hosts requiring attention)
 * 4. MAC Conflict (MAC mismatches detected)
 *
 * Props:
 * @param {Object} [props.summary] - Summary metric counts
 * @param {number} [props.totalIps=254] - Total usable IPs in the subnet
 * @param {Array} [props.ips] - Optional raw IP list to compute real-time metrics
 */
export default function StatCards({ summary = {}, totalIps = 254, ips = null }) {
  let total = totalIps || summary?.total_ips || 254;
  let assigned = summary?.assigned_count ?? 0;
  let online = summary?.online_count ?? 0;
  let rogue = summary?.rogue_count ?? 0;
  let mismatch = summary?.mismatch_count ?? 0;

  // Compute directly from ips array if provided and non-empty
  if (Array.isArray(ips) && ips.length > 0) {
    total = ips.length;
    assigned = ips.filter((ip) => ip.admin_status === 'assigned').length;
    online = ips.filter((ip) => Boolean(ip.is_online)).length;
    rogue = ips.filter((ip) => ip.reconciliation_status === 'ROGUE_DEVICE').length;
    mismatch = ips.filter((ip) => ip.reconciliation_status === 'MAC_MISMATCH').length;
  }

  const utilizationPct = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      role="region"
      aria-label="Metrik Ringkasan Subnet"
    >
      {/* 1. Total & Utilisasi IP */}
      <div className="bg-slate-850 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total & Utilisasi IP
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Server className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white">{assigned}</span>
            <span className="text-sm font-mono text-slate-500">{`/ ${total}`}</span>
          </div>

          {/* Utilization progress bar */}
          <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, utilizationPct))}%` }}
              role="progressbar"
              aria-valuenow={utilizationPct}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Persentase Utilisasi IP"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Terutilisasi</span>
            <span className="font-semibold text-indigo-300 font-mono">{`${utilizationPct}%`}</span>
          </div>
        </div>
      </div>

      {/* 2. Perangkat Online */}
      <div className="bg-slate-850 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Perangkat Online
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Activity className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{online}</span>
            <span className="text-xs text-slate-400">host aktif</span>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Responsif terhadap ARP scan</span>
          </div>
        </div>
      </div>

      {/* 3. Rogue Devices */}
      <div
        className={`bg-slate-850 border rounded-xl p-5 flex flex-col justify-between transition-colors shadow-sm ${
          rogue > 0 ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Rogue Devices
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              rogue > 0
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                rogue > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {rogue}
            </span>
            <span className="text-xs text-slate-400">perangkat</span>
          </div>

          <div className="mt-3">
            {rogue > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Perlu Tindakan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Semua IP online terdaftar
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. MAC Conflict */}
      <div
        className={`bg-slate-850 border rounded-xl p-5 flex flex-col justify-between transition-colors shadow-sm ${
          mismatch > 0 ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            MAC Conflict
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              mismatch > 0
                ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                mismatch > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {mismatch}
            </span>
            <span className="text-xs text-slate-400">konflik</span>
          </div>

          <div className="mt-3">
            {mismatch > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                Konflik Terdeteksi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Tidak ada anomali MAC
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
