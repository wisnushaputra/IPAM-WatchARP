import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { STATUS_CELL, STATUS_TEXT, statusLabel } from '../status.js';

const LEGEND_ORDER = ['FREE', 'VALID_ONLINE', 'OFFLINE', 'ROGUE_DEVICE', 'MAC_MISMATCH', 'RESERVED'];

function getCellClasses(status, isSelected) {
  const selection = isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface z-20' : 'hover:border-ink';
  return `w-11 h-11 sm:w-10 sm:h-10 rounded-sm border text-xs font-mono tabular-nums flex items-center justify-center transition-colors select-none ${
    STATUS_CELL[status] || STATUS_CELL.FREE
  } ${selection}`;
}

function Detail({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted whitespace-nowrap">{label}</dt>
      <dd className={`text-ink truncate max-w-[170px] ${mono ? 'font-mono' : ''}`} title={value || '-'}>
        {value || '-'}
      </dd>
    </div>
  );
}

export default function IpGridMap({ ips = [], onSelectIp, selectedIp = null, isLoading = false, onEditIp }) {
  // Always 254 cells (.1 to .254); hosts the API has no record for render as FREE.
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
      result.push(
        byOctet.get(i) || {
          id: `virtual-${i}`,
          ip_address: `.${i}`,
          reconciliation_status: 'FREE',
          admin_status: 'available',
          is_online: false,
          hostname: null,
          detected_mac: null,
          expected_mac: null,
          vendor: null,
        }
      );
    }
    return result;
  }, [ips]);

  const tallies = useMemo(() => {
    const counts = Object.fromEntries(LEGEND_ORDER.map((k) => [k, 0]));
    cells.forEach((cell) => {
      const s = cell.reconciliation_status || 'FREE';
      counts[s in counts ? s : 'FREE']++;
    });
    return counts;
  }, [cells]);

  return (
    <section aria-labelledby="grid-title" className="space-y-3">
      <div className="ledger-rule pb-2 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
        <h2 id="grid-title" className="text-base font-semibold text-ink">
          Peta IP <span className="font-normal text-muted">(254 host)</span>
        </h2>
        <p className="text-sm text-muted">Klik sel untuk melihat detail host.</p>
      </div>

      <div className="bg-surface border border-line rounded p-4 sm:p-5 space-y-5">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Keterangan status IP">
          {LEGEND_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-sm border ${STATUS_CELL[s]}`} aria-hidden="true" />
              <span className="text-ink">{statusLabel(s)}</span>
              <span className="font-mono tabular-nums text-muted">{tallies[s]}</span>
            </li>
          ))}
        </ul>

        {selectedIp && (
          <div
            className="p-4 bg-paper border border-accent rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            role="status"
            aria-live="polite"
          >
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-lg font-bold text-ink">{selectedIp.ip_address}</span>
                <span className={`text-sm font-semibold ${STATUS_TEXT[selectedIp.reconciliation_status] || STATUS_TEXT.FREE}`}>
                  {statusLabel(selectedIp.reconciliation_status)}
                </span>
                <span className="text-sm text-muted">{selectedIp.is_online ? 'Online' : 'Offline'}</span>
              </div>
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <div>
                  <dt className="inline text-muted">Hostname: </dt>
                  <dd className="inline text-ink">{selectedIp.hostname || '-'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Status admin: </dt>
                  <dd className="inline text-ink capitalize">{selectedIp.admin_status || 'available'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">MAC terdeteksi: </dt>
                  <dd className="inline text-ink font-mono">{selectedIp.detected_mac || '-'}</dd>
                </div>
                {selectedIp.expected_mac && (
                  <div>
                    <dt className="inline text-muted">MAC tercatat: </dt>
                    <dd className="inline text-ink font-mono">{selectedIp.expected_mac}</dd>
                  </div>
                )}
                {selectedIp.vendor && (
                  <div>
                    <dt className="inline text-muted">Vendor: </dt>
                    <dd className="inline text-ink">{selectedIp.vendor}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {onEditIp && (
                <button type="button" onClick={() => onEditIp(selectedIp)} className="btn-primary">
                  Edit host
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectIp && onSelectIp(null)}
                className="btn-secondary px-0 w-11 sm:w-10"
                aria-label="Tutup detail IP terpilih"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
              <span className="text-sm text-ink bg-surface px-3 py-2 rounded border border-line">Memuat data IP...</span>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 justify-items-center" aria-label="Grid 254 alamat IP">
            {cells.map((ip, index) => {
              const hostOctet = ip.ip_address.includes('.') ? ip.ip_address.split('.').pop() : String(index + 1);
              const status = ip.reconciliation_status || 'FREE';
              const isSelected = Boolean(
                selectedIp && (selectedIp.id === ip.id || selectedIp.ip_address === ip.ip_address)
              );

              return (
                <div key={ip.id || `ip-${index}`} className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => onSelectIp && onSelectIp(ip)}
                    className={getCellClasses(status, isSelected)}
                    aria-label={`IP ${ip.ip_address}, status ${statusLabel(status)}`}
                    aria-pressed={isSelected}
                  >
                    .{hostOctet}
                  </button>

                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-72 p-3 bg-surface border border-line-strong rounded shadow-lg text-left"
                  >
                    <div className="flex items-baseline justify-between gap-2 pb-1.5 border-b border-line">
                      <span className="font-mono text-sm font-bold text-ink">{ip.ip_address}</span>
                      <span className={`text-xs font-semibold ${STATUS_TEXT[status] || STATUS_TEXT.FREE}`}>
                        {statusLabel(status)}
                      </span>
                    </div>
                    <dl className="pt-2 space-y-1 text-xs">
                      <Detail label="Hostname" value={ip.hostname} />
                      <Detail label="Admin" value={ip.admin_status || 'available'} />
                      <Detail label="MAC terdeteksi" value={ip.detected_mac} mono />
                      {ip.expected_mac && <Detail label="MAC tercatat" value={ip.expected_mac} mono />}
                      {ip.vendor && <Detail label="Vendor" value={ip.vendor} />}
                      <Detail label="Live" value={ip.is_online ? 'Online' : 'Offline'} />
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
