import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_CELL, STATUS_TEXT, statusLabel } from '../status.js';

const ADMIN_STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  reserved: 'Reserved',
};

function formatLastSeen(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

const Empty = () => <span className="text-muted">-</span>;

export default function IpTable({
  ips = [],
  onSelectIp,
  onEditIp,
  onTrustMac,
  selectedIp = null,
  isTrustingId = null,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const tabCounts = useMemo(() => {
    const counts = { ALL: ips.length, ONLINE: 0, ROGUE_DEVICES: 0, MISMATCHES: 0, ASSIGNED: 0 };
    ips.forEach((ip) => {
      if (ip.is_online) counts.ONLINE++;
      if (ip.reconciliation_status === 'ROGUE_DEVICE') counts.ROGUE_DEVICES++;
      if (ip.reconciliation_status === 'MAC_MISMATCH') counts.MISMATCHES++;
      if (ip.admin_status === 'assigned') counts.ASSIGNED++;
    });
    return counts;
  }, [ips]);

  const filteredIps = useMemo(() => {
    let result = ips;

    if (activeTab === 'ONLINE') {
      result = result.filter((ip) => ip.is_online);
    } else if (activeTab === 'ROGUE_DEVICES') {
      result = result.filter((ip) => ip.reconciliation_status === 'ROGUE_DEVICE');
    } else if (activeTab === 'MISMATCHES') {
      result = result.filter((ip) => ip.reconciliation_status === 'MAC_MISMATCH');
    } else if (activeTab === 'ASSIGNED') {
      result = result.filter((ip) => ip.admin_status === 'assigned');
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((ip) =>
        [ip.ip_address, ip.hostname, ip.expected_mac, ip.detected_mac, ip.vendor, ip.description].some((v) =>
          (v || '').toLowerCase().includes(query)
        )
      );
    }

    return result;
  }, [ips, activeTab, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredIps.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredIps.length);
  const paginatedIps = useMemo(() => filteredIps.slice(startIndex, endIndex), [filteredIps, startIndex, endIndex]);

  const tabs = [
    { key: 'ALL', label: 'Semua', count: tabCounts.ALL },
    { key: 'ONLINE', label: 'Online', count: tabCounts.ONLINE },
    { key: 'ROGUE_DEVICES', label: 'Rogue Devices', count: tabCounts.ROGUE_DEVICES, alert: 'text-warn' },
    { key: 'MISMATCHES', label: 'Mismatches', count: tabCounts.MISMATCHES, alert: 'text-bad' },
    { key: 'ASSIGNED', label: 'Assigned', count: tabCounts.ASSIGNED },
  ];

  return (
    <section aria-labelledby="table-title" className="space-y-3">
      <div className="ledger-rule pb-2 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 id="table-title" className="text-base font-semibold text-ink">
            Daftar Rincian IP Host
          </h2>
          <p className="text-sm text-muted">Catat host, cocokkan MAC, dan setujui perangkat baru.</p>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari IP, Hostname, MAC, Vendor..."
              aria-label="Cari IP, hostname, MAC, atau vendor"
              className="field pl-9 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-muted hover:text-ink rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <label htmlFor="ip-table-page-size" className="text-sm text-muted whitespace-nowrap hidden sm:block">
            Baris
          </label>
          <select
            id="ip-table-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Jumlah baris per halaman"
            className="field w-auto"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_rgb(var(--line))]" role="group" aria-label="Filter status">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={isActive}
              className={`px-3 min-h-11 sm:min-h-10 border-b-2 text-sm whitespace-nowrap inline-flex items-center gap-2 transition-colors ${
                isActive ? 'border-accent text-ink font-semibold' : 'border-transparent text-muted hover:text-ink hover:border-line-strong'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`font-mono tabular-nums ${tab.alert && tab.count > 0 ? `${tab.alert} font-semibold` : ''}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto border border-line rounded bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong bg-sunken text-muted whitespace-nowrap">
              <th scope="col" className="py-2.5 px-4 font-medium">IP Address</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Status Admin</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Hostname</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Expected MAC</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Detected MAC (Vendor)</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Status Rekonsiliasi</th>
              <th scope="col" className="py-2.5 px-3 font-medium">Terakhir Terlihat</th>
              <th scope="col" className="py-2.5 px-4 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paginatedIps.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 px-4 text-center">
                  <p className="font-medium text-ink">Tidak ada IP yang cocok</p>
                  <p className="mt-1 text-muted">Ubah kata kunci atau pilih filter lain.</p>
                  {(searchQuery || activeTab !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveTab('ALL');
                      }}
                      className="btn-secondary mt-3"
                    >
                      Reset filter dan pencarian
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedIps.map((ip) => {
                const isSelected = Boolean(
                  selectedIp && (selectedIp.id === ip.id || selectedIp.ip_address === ip.ip_address)
                );
                const status = ip.reconciliation_status || 'FREE';
                const isRogue = status === 'ROGUE_DEVICE';
                const isTrusting = isTrustingId === ip.id;

                return (
                  <tr key={ip.id || ip.ip_address} className={isSelected ? 'bg-accent/10' : 'hover:bg-sunken/60'}>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectIp && onSelectIp(ip)}
                        aria-pressed={isSelected}
                        aria-label={`Pilih ${ip.ip_address} (${ip.is_online ? 'online' : 'offline'})`}
                        className="flex items-center gap-2 font-mono font-semibold text-ink hover:text-accent hover:underline rounded min-h-9"
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${ip.is_online ? 'bg-ok' : 'border border-line-strong'}`}
                          aria-hidden="true"
                        />
                        {ip.ip_address}
                      </button>
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap text-ink">
                      {ADMIN_STATUS_LABELS[ip.admin_status] || ip.admin_status || 'Available'}
                    </td>

                    <td className="py-2 px-3 text-ink max-w-[160px] truncate" title={ip.hostname || '-'}>
                      {ip.hostname || <Empty />}
                    </td>

                    <td className="py-2 px-3 font-mono whitespace-nowrap text-ink">{ip.expected_mac || <Empty />}</td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      {ip.detected_mac ? (
                        <>
                          <span className="block font-mono text-ink">{ip.detected_mac}</span>
                          {ip.vendor && (
                            <span className="block text-xs text-muted truncate max-w-[160px]" title={ip.vendor}>
                              {ip.vendor}
                            </span>
                          )}
                        </>
                      ) : (
                        <Empty />
                      )}
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-2 font-medium ${STATUS_TEXT[status] || STATUS_TEXT.FREE}`}>
                        <span className={`w-3 h-3 rounded-sm border ${STATUS_CELL[status] || STATUS_CELL.FREE}`} aria-hidden="true" />
                        {statusLabel(status)}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-muted whitespace-nowrap tabular-nums">{formatLastSeen(ip.last_seen_at)}</td>

                    <td className="py-2 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isRogue && onTrustMac && (
                          <button
                            type="button"
                            onClick={() => onTrustMac(ip.id)}
                            disabled={isTrusting}
                            className="btn bg-warn text-paper hover:bg-warn/85 active:bg-warn/75"
                            title="Simpan MAC terdeteksi sebagai MAC tercatat dan tandai Assigned"
                          >
                            {isTrusting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                <span>Menyetujui...</span>
                              </>
                            ) : (
                              <span>Setujui MAC</span>
                            )}
                          </button>
                        )}

                        {onEditIp && (
                          <button
                            type="button"
                            onClick={() => onEditIp(ip)}
                            aria-label={`Edit ${ip.ip_address}`}
                            className="btn-secondary"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted">
        <p>
          {filteredIps.length > 0 ? (
            <>
              Menampilkan <strong className="text-ink tabular-nums">{startIndex + 1}</strong>-
              <strong className="text-ink tabular-nums">{endIndex}</strong> dari{' '}
              <strong className="text-ink tabular-nums">{filteredIps.length}</strong> IP
            </>
          ) : (
            '0 IP ditemukan'
          )}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage <= 1}
              className="btn-secondary"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>
            <span className="px-2 tabular-nums text-ink">
              {validCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage >= totalPages}
              className="btn-secondary"
              aria-label="Halaman berikutnya"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
