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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      role="region"
      aria-label="Metrik Ringkasan Subnet"
    >
      <div className="bg-[#121622] border border-[#202739] rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
            Total & Utilisasi IP
          </span>
          <span className="text-xs font-mono font-medium text-cyan-400">{utilizationPct}%</span>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-100">{assigned}</span>
            <span className="text-xs font-mono text-slate-400">{`/ ${total}`}</span>
          </div>

          <div className="mt-2 w-full bg-[#1b2234] rounded h-1 overflow-hidden">
            <div
              className="bg-cyan-500 h-1 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, utilizationPct))}%` }}
              role="progressbar"
              aria-valuenow={utilizationPct}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Persentase Utilisasi IP"
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400 font-mono">
            Teralokasi secara administratif
          </p>
        </div>
      </div>

      <div className="bg-[#121622] border border-[#202739] rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
            Perangkat Online
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{online}</span>
            <span className="text-xs font-mono text-slate-400">merespon ARP</span>
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            Terdeteksi pada sapuan broadcast terakhir
          </p>
        </div>
      </div>

      <div
        className={`border rounded-lg p-4 flex flex-col justify-between transition-colors ${
          rogue > 0
            ? 'bg-[#1a1710] border-amber-500/50'
            : 'bg-[#121622] border-[#202739]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
            Rogue Devices
          </span>
          {rogue > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Perlu Tindakan
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                rogue > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {rogue}
            </span>
            <span className="text-xs font-mono text-slate-400">tidak terdaftar</span>
          </div>

          <p className={`mt-2 text-[11px] ${rogue > 0 ? 'text-amber-200/80' : 'text-slate-400'}`}>
            {rogue > 0 ? 'IP aktif tanpa pencatatan resmi' : 'Semua perangkat online terdata'}
          </p>
        </div>
      </div>

      <div
        className={`border rounded-lg p-4 flex flex-col justify-between transition-colors ${
          mismatch > 0
            ? 'bg-[#1f1216] border-rose-500/60'
            : 'bg-[#121622] border-[#202739]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 tracking-wider uppercase">
            MAC Conflict
          </span>
          {mismatch > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Konflik Terdeteksi
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                mismatch > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {mismatch}
            </span>
            <span className="text-xs font-mono text-slate-400">ketidakcocokan</span>
          </div>

          <p className={`mt-2 text-[11px] ${mismatch > 0 ? 'text-rose-200/80 font-medium' : 'text-slate-400'}`}>
            {mismatch > 0 ? 'Perangkat fisik berbeda dari catatan' : 'Tidak ada anomali MAC terdeteksi'}
          </p>
        </div>
      </div>
    </div>
  );
}
