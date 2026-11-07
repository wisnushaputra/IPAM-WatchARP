import React from 'react';

// Utilization gets the wide cell because it is the number an admin plans around;
// the three counts stay quiet until they are non-zero.
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
    <dl
      className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] border border-line rounded bg-surface [&>div]:p-4 [&>div]:border-line"
      aria-label="Ringkasan subnet"
    >
      <div className="col-span-2 lg:col-span-1 border-b lg:border-b-0 lg:border-r">
        <dt className="text-sm text-muted">Utilisasi IP</dt>
        <dd className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-ink">{assigned}</span>
          <span className="text-sm text-muted tabular-nums">{`/ ${total}`} teralokasi</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{utilizationPct}%</span>
        </dd>
        <div
          className="mt-3 h-1.5 bg-sunken rounded-sm overflow-hidden"
          role="progressbar"
          aria-valuenow={utilizationPct}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Persentase utilisasi IP"
        >
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, utilizationPct))}%` }} />
        </div>
      </div>

      <div className="border-r">
        <dt className="text-sm text-muted">Online</dt>
        <dd className="mt-1">
          <span className="text-2xl font-bold tabular-nums text-ink">{online}</span>
          <span className="block text-xs text-muted">merespon ARP di scan terakhir</span>
        </dd>
      </div>

      <div className="lg:border-r">
        <dt className="text-sm text-muted">Rogue device</dt>
        <dd className="mt-1">
          <span className={`text-2xl font-bold tabular-nums ${rogue > 0 ? 'text-warn' : 'text-ink'}`}>{rogue}</span>
          <span className={`block text-xs ${rogue > 0 ? 'text-warn font-medium' : 'text-muted'}`}>
            {rogue > 0 ? 'Perlu tindakan: aktif tanpa catatan' : 'Semua host online tercatat'}
          </span>
        </dd>
      </div>

      <div className="col-span-2 lg:col-span-1 border-t lg:border-t-0">
        <dt className="text-sm text-muted">MAC konflik</dt>
        <dd className="mt-1">
          <span className={`text-2xl font-bold tabular-nums ${mismatch > 0 ? 'text-bad' : 'text-ink'}`}>{mismatch}</span>
          <span className={`block text-xs ${mismatch > 0 ? 'text-bad font-medium' : 'text-muted'}`}>
            {mismatch > 0 ? 'Konflik terdeteksi: MAC beda dari catatan' : 'Tidak ada MAC yang beda'}
          </span>
        </dd>
      </div>
    </dl>
  );
}
