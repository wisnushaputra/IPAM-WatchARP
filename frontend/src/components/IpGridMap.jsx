import React, { useMemo } from 'react';
import {
  Grid,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  X,
  Radio,
  Server,
  Layers,
  Edit2,
} from 'lucide-react';

const STATUS_LABELS = {
  FREE: 'Free',
  VALID_ONLINE: 'Valid Online',
  OFFLINE: 'Offline',
  ROGUE_DEVICE: 'Rogue Device',
  MAC_MISMATCH: 'MAC Mismatch',
  RESERVED: 'Reserved',
};

const STATUS_BADGE_CLASSES = {
  FREE: 'bg-[#181d2a] text-slate-300 border border-[#283248]',
  VALID_ONLINE: 'bg-[#0f2d1e] text-emerald-300 border border-[#1b4d34]',
  OFFLINE: 'bg-[#181d2a] text-slate-400 border border-[#283248]',
  ROGUE_DEVICE: 'bg-[#33220a] text-amber-300 border border-[#593c12]',
  MAC_MISMATCH: 'bg-[#331119] text-rose-300 border border-[#591e2b]',
  RESERVED: 'bg-[#1d1b38] text-indigo-300 border border-[#37336b]',
};

/**
 * Get Tailwind color styling for an individual grid cell based on its reconciliation status.
 */
function getCellClasses(status, isSelected) {
  let baseColor = '';
  switch (status) {
    case 'VALID_ONLINE':
      baseColor = 'bg-emerald-600 border-emerald-500 text-white font-medium hover:bg-emerald-500';
      break;
    case 'OFFLINE':
      baseColor = 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500';
      break;
    case 'ROGUE_DEVICE':
      baseColor = 'bg-amber-500 border-amber-400 text-slate-950 font-bold hover:bg-amber-400';
      break;
    case 'MAC_MISMATCH':
      baseColor = 'bg-rose-600 border-rose-500 text-white animate-pulse font-bold hover:bg-rose-500';
      break;
    case 'RESERVED':
      baseColor = 'bg-indigo-600 border-indigo-500 text-white font-medium hover:bg-indigo-500';
      break;
    case 'FREE':
    default:
      baseColor =
        'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200';
      break;
  }

  const selectionRing = isSelected
    ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950 shadow-lg scale-105 z-20 font-bold'
    : 'hover:scale-105';

  return `w-10 h-10 rounded-md border text-xs font-mono flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${baseColor} ${selectionRing}`;
}

/**
 * IpGridMap Component
 * Displays 254 responsive cells (.1 to .254) representing an IPv4 /24 subnet.
 *
 * Props:
 * @param {Array} props.ips - List of IP records from backend API
 * @param {Function} props.onSelectIp - Callback when a cell is clicked
 * @param {Object} [props.selectedIp] - Currently selected IP object
 * @param {boolean} [props.isLoading=false] - Loading indicator state
 */
export default function IpGridMap({
  ips = [],
  onSelectIp,
  selectedIp = null,
  isLoading = false,
  onEditIp,
}) {
  // Normalize exactly 254 cells (host IPs .1 through .254)
  const cells = useMemo(() => {
    const byOctet = new Map();

    if (Array.isArray(ips)) {
      ips.forEach((ip) => {
        if (!ip || !ip.ip_address) return;
        const parts = ip.ip_address.split('.');
        if (parts.length === 4) {
          const octet = parseInt(parts[3], 10);
          if (octet >= 1 && octet <= 254) {
            byOctet.set(octet, ip);
          }
        }
      });
    }

    const result = [];
    for (let i = 1; i <= 254; i++) {
      const existing = byOctet.get(i);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          id: `virtual-${i}`,
          ip_address: `.${i}`,
          reconciliation_status: 'FREE',
          admin_status: 'available',
          is_online: false,
          hostname: null,
          detected_mac: null,
          expected_mac: null,
          vendor: null,
        });
      }
    }
    return result;
  }, [ips]);

  // Compute status tallies for quick header reference
  const tallies = useMemo(() => {
    const counts = {
      FREE: 0,
      VALID_ONLINE: 0,
      OFFLINE: 0,
      ROGUE_DEVICE: 0,
      MAC_MISMATCH: 0,
      RESERVED: 0,
    };
    cells.forEach((cell) => {
      const s = cell.reconciliation_status || 'FREE';
      if (counts[s] !== undefined) {
        counts[s]++;
      } else {
        counts.FREE++;
      }
    });
    return counts;
  }, [cells]);

  return (
    <div
      className="bg-[#121622] border border-[#202739] rounded-lg p-5 sm:p-6 shadow-sm space-y-6"
      role="region"
      aria-label="Peta Visual IP Grid"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#202739]">
        <div>
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            <h3 className="text-base font-semibold text-white">
              Visual IP Grid Map (254 Host)
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Klik sel untuk melihat detail host, status rekonsiliasi ARP, dan konfigurasi MAC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
            Free: <strong className="text-slate-200">{tallies.FREE}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300">
            Online: <strong className="text-emerald-200">{tallies.VALID_ONLINE}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
            Offline: <strong className="text-slate-300">{tallies.OFFLINE}</strong>
          </span>
          {tallies.ROGUE_DEVICE > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300">
              Rogue: <strong className="text-amber-200">{tallies.ROGUE_DEVICE}</strong>
            </span>
          )}
          {tallies.MAC_MISMATCH > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
              Mismatch: <strong className="text-rose-200">{tallies.MAC_MISMATCH}</strong>
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800 text-indigo-300">
            Reserved: <strong className="text-indigo-200">{tallies.RESERVED}</strong>
          </span>
        </div>
      </div>

      {selectedIp && (
        <div
          className="p-4 bg-[#0d121c] border border-cyan-500/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md transition-all"
          role="status"
          aria-live="polite"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-sm bg-cyan-400" />
              <span className="font-mono text-base font-bold text-white">
                {selectedIp.ip_address}
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-semibold uppercase ${
                  STATUS_BADGE_CLASSES[selectedIp.reconciliation_status] || STATUS_BADGE_CLASSES.FREE
                }`}
              >
                {STATUS_LABELS[selectedIp.reconciliation_status] || selectedIp.reconciliation_status}
              </span>
              {selectedIp.is_online ? (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Online
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                  Offline
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>
                Hostname: <strong className="text-white">{selectedIp.hostname || '-'}</strong>
              </span>
              <span>
                Status Admin:{' '}
                <strong className="text-white capitalize">{selectedIp.admin_status || 'available'}</strong>
              </span>
              <span>
                MAC Terdeteksi:{' '}
                <strong className="text-white font-mono">{selectedIp.detected_mac || '-'}</strong>
              </span>
              {selectedIp.expected_mac && (
                <span>
                  MAC Diharapkan:{' '}
                  <strong className="text-white font-mono">{selectedIp.expected_mac}</strong>
                </span>
              )}
              {selectedIp.vendor && (
                <span>
                  Vendor: <strong className="text-white">{selectedIp.vendor}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onEditIp && (
              <button
                type="button"
                onClick={() => onEditIp(selectedIp)}
                className="px-3 py-1.5 min-h-[32px] bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 shadow-sm"
                title="Edit konfigurasi host IP ini"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Host</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectIp && onSelectIp(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              aria-label="Tutup detail IP terpilih"
              title="Tutup detail terpilih"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/70 rounded-lg flex items-center justify-center z-10">
            <div className="text-xs text-cyan-300 font-medium bg-slate-950 px-3 py-2 rounded border border-[#202739] shadow">
              Memuat data IP...
            </div>
          </div>
        )}

        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2 justify-items-center"
          role="grid"
          aria-label="Grid 254 Alamat IP"
        >
          {cells.map((ip, index) => {
            const hostOctet = ip.ip_address.includes('.')
              ? ip.ip_address.split('.').pop()
              : String(index + 1);

            const status = ip.reconciliation_status || 'FREE';
            const isSelected =
              selectedIp &&
              (selectedIp.id === ip.id || selectedIp.ip_address === ip.ip_address);

            return (
              <div key={ip.id || `ip-${index}`} className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => onSelectIp && onSelectIp(ip)}
                  className={getCellClasses(status, isSelected)}
                  aria-label={`IP ${ip.ip_address}, Status: ${STATUS_LABELS[status] || status}`}
                  aria-pressed={isSelected}
                  title={`${ip.ip_address} (${STATUS_LABELS[status] || status})`}
                >
                  .{hostOctet}
                </button>

                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex group-focus-within:flex flex-col z-30 w-56 p-3 bg-[#0e131d] border border-[#273248] rounded-md shadow-2xl text-left"
                >
                  <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800">
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      {ip.ip_address}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide uppercase ${
                        STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.FREE
                      }`}
                    >
                      {STATUS_LABELS[status] || status}
                    </span>
                  </div>

                  <div className="pt-2 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Hostname:</span>
                      <span
                        className="font-medium text-slate-200 truncate max-w-[125px]"
                        title={ip.hostname || '-'}
                      >
                        {ip.hostname || '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Admin:</span>
                      <span className="font-medium capitalize text-slate-300">
                        {ip.admin_status || 'available'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">MAC Terdeteksi:</span>
                      <span
                        className="font-mono text-slate-200 truncate max-w-[125px]"
                        title={ip.detected_mac || '-'}
                      >
                        {ip.detected_mac || '-'}
                      </span>
                    </div>

                    {ip.expected_mac && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">MAC Terdaftar:</span>
                        <span
                          className="font-mono text-slate-300 truncate max-w-[125px]"
                          title={ip.expected_mac}
                        >
                          {ip.expected_mac}
                        </span>
                      </div>
                    )}

                    {ip.vendor && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Vendor:</span>
                        <span
                          className="text-slate-300 truncate max-w-[125px]"
                          title={ip.vendor}
                        >
                          {ip.vendor}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-slate-500">Kondisi Live:</span>
                      <span
                        className={
                          ip.is_online ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                        }
                      >
                        {ip.is_online ? '● Online' : '○ Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-[#0e131d] border-r border-b border-[#273248] rotate-45" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-[#202739] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <span className="font-medium text-slate-300 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Keterangan Status IP:
        </span>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-slate-700 bg-slate-900" />
            <span>FREE (Kosong)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-emerald-500 bg-emerald-600" />
            <span>VALID ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-slate-700 bg-slate-800" />
            <span>OFFLINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-amber-400 bg-amber-500" />
            <span>ROGUE DEVICE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-rose-500 bg-rose-600 animate-pulse" />
            <span>MAC MISMATCH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm border border-indigo-500 bg-indigo-600" />
            <span>RESERVED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
