import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  HardDrive,
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

const ADMIN_STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  reserved: 'Reserved',
};

const ADMIN_STATUS_CLASSES = {
  available: 'bg-[#181d2a] text-slate-400 border border-[#283248]',
  assigned: 'bg-[#112437] text-cyan-300 border border-[#1c3e5e]',
  reserved: 'bg-[#201c38] text-indigo-300 border border-[#3b3464]',
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

/**
 * IpTable Component
 * Detailed list of subnet IP addresses with search, status tabs, pagination, and quick actions.
 *
 * Props:
 * @param {Array} props.ips - Full list of IP address objects in the subnet
 * @param {Function} props.onSelectIp - Callback when an IP row is selected
 * @param {Function} props.onEditIp - Callback to trigger editing of an IP
 * @param {Function} props.onTrustMac - Callback to approve/trust detected MAC for rogue devices
 * @param {Object} [props.selectedIp] - Currently selected IP object
 * @param {number|string|null} [props.isTrustingId] - ID of IP record currently being trusted
 */
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

  // Compute status counts for filter tabs
  const tabCounts = useMemo(() => {
    const counts = {
      ALL: ips.length,
      ONLINE: 0,
      ROGUE_DEVICES: 0,
      MISMATCHES: 0,
      ASSIGNED: 0,
    };

    ips.forEach((ip) => {
      if (ip.is_online) counts.ONLINE++;
      if (ip.reconciliation_status === 'ROGUE_DEVICE') counts.ROGUE_DEVICES++;
      if (ip.reconciliation_status === 'MAC_MISMATCH') counts.MISMATCHES++;
      if (ip.admin_status === 'assigned') counts.ASSIGNED++;
    });

    return counts;
  }, [ips]);

  // Filter IPs by active tab and search query
  const filteredIps = useMemo(() => {
    let result = ips;

    // Apply Tab filter
    if (activeTab === 'ONLINE') {
      result = result.filter((ip) => ip.is_online);
    } else if (activeTab === 'ROGUE_DEVICES') {
      result = result.filter((ip) => ip.reconciliation_status === 'ROGUE_DEVICE');
    } else if (activeTab === 'MISMATCHES') {
      result = result.filter((ip) => ip.reconciliation_status === 'MAC_MISMATCH');
    } else if (activeTab === 'ASSIGNED') {
      result = result.filter((ip) => ip.admin_status === 'assigned');
    }

    // Apply Search query
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((ip) => {
        const ipAddr = (ip.ip_address || '').toLowerCase();
        const hostname = (ip.hostname || '').toLowerCase();
        const expectedMac = (ip.expected_mac || '').toLowerCase();
        const detectedMac = (ip.detected_mac || '').toLowerCase();
        const vendor = (ip.vendor || '').toLowerCase();
        const desc = (ip.description || '').toLowerCase();

        return (
          ipAddr.includes(query) ||
          hostname.includes(query) ||
          expectedMac.includes(query) ||
          detectedMac.includes(query) ||
          vendor.includes(query) ||
          desc.includes(query)
        );
      });
    }

    return result;
  }, [ips, activeTab, searchQuery]);

  // Reset to page 1 whenever activeTab or searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, pageSize]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredIps.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredIps.length);
  const paginatedIps = useMemo(() => {
    return filteredIps.slice(startIndex, endIndex);
  }, [filteredIps, startIndex, endIndex]);

  const tabs = [
    { key: 'ALL', label: 'All', count: tabCounts.ALL },
    { key: 'ONLINE', label: 'Online', count: tabCounts.ONLINE },
    {
      key: 'ROGUE_DEVICES',
      label: 'Rogue Devices',
      count: tabCounts.ROGUE_DEVICES,
      badgeColor:
        tabCounts.ROGUE_DEVICES > 0 ? 'bg-[#33220a] text-amber-300 border border-[#593c12]' : '',
    },
    {
      key: 'MISMATCHES',
      label: 'Mismatches',
      count: tabCounts.MISMATCHES,
      badgeColor:
        tabCounts.MISMATCHES > 0 ? 'bg-[#331119] text-rose-300 border border-[#591e2b]' : '',
    },
    { key: 'ASSIGNED', label: 'Assigned', count: tabCounts.ASSIGNED },
  ];

  return (
    <div
      className="bg-[#121622] border border-[#202739] rounded-lg p-5 sm:p-6 shadow-sm space-y-5"
      role="region"
      aria-label="Tabel Rincian IP Host"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <span>Daftar Rincian IP Host</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Kelola inventaris host IP, verifikasi MAC address, dan setujui perangkat baru.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari IP, Hostname, MAC, Vendor..."
              aria-label="Cari IP, Hostname, MAC, atau Vendor"
              className="w-full bg-[#0b0e17] border border-[#263248] rounded-md pl-9 pr-9 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
            <label htmlFor="ip-table-page-size" className="hidden sm:inline">
              Baris:
            </label>
            <select
              id="ip-table-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[#0b0e17] border border-[#263248] rounded-md px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#202739] scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono inline-flex items-center gap-2 transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-cyan-500 border ${
                isActive
                  ? 'bg-[#182133] text-cyan-300 border-[#2b3a56] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141a27] border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                  isActive
                    ? 'bg-[#112338] text-cyan-200 border border-[#1e3e60]'
                    : tab.badgeColor || 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-md border border-[#202739] bg-[#0c0f18]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#202739] bg-[#090c14] text-slate-400 uppercase tracking-wider font-semibold font-mono text-[11px]">
              <th scope="col" className="py-3 px-4">
                IP Address
              </th>
              <th scope="col" className="py-3 px-3">
                Status Admin
              </th>
              <th scope="col" className="py-3 px-3">
                Hostname
              </th>
              <th scope="col" className="py-3 px-3">
                Expected MAC
              </th>
              <th scope="col" className="py-3 px-3">
                Detected MAC (Vendor)
              </th>
              <th scope="col" className="py-3 px-3">
                Status Rekonsiliasi
              </th>
              <th scope="col" className="py-3 px-3">
                Terakhir Terlihat
              </th>
              <th scope="col" className="py-3 px-4 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2536]">
            {paginatedIps.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Filter className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-300">
                      Tidak ada data IP yang cocok
                    </p>
                    <p className="text-xs text-slate-500">
                      Coba ubah kata kunci pencarian atau pilih tab filter status lainnya.
                    </p>
                    {(searchQuery || activeTab !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setActiveTab('ALL');
                        }}
                        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
                      >
                        Reset Filter & Pencarian
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedIps.map((ip) => {
                const isSelected =
                  selectedIp &&
                  (selectedIp.id === ip.id || selectedIp.ip_address === ip.ip_address);
                const isRogue = ip.reconciliation_status === 'ROGUE_DEVICE';
                const isTrusting = isTrustingId === ip.id;

                return (
                  <tr
                    key={ip.id || ip.ip_address}
                    onClick={() => onSelectIp && onSelectIp(ip)}
                    className={`transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#0e2130] ring-1 ring-inset ring-cyan-500/40'
                        : 'hover:bg-[#141a27]'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-sm flex-shrink-0 ${
                            ip.is_online ? 'bg-emerald-400 shadow-sm' : 'bg-slate-600'
                          }`}
                          title={ip.is_online ? 'Online' : 'Offline'}
                        />
                        <span>{ip.ip_address}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${
                          ADMIN_STATUS_CLASSES[ip.admin_status] || ADMIN_STATUS_CLASSES.available
                        }`}
                      >
                        {ADMIN_STATUS_LABELS[ip.admin_status] || ip.admin_status || 'Available'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-200 max-w-[150px] truncate" title={ip.hostname || '-'}>
                      {ip.hostname || <span className="text-slate-500">-</span>}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {ip.expected_mac || <span className="text-slate-500">-</span>}
                    </td>

                    <td className="py-3 px-3 font-mono whitespace-nowrap">
                      {ip.detected_mac ? (
                        <div className="flex flex-col">
                          <span className="text-slate-200">{ip.detected_mac}</span>
                          {ip.vendor && (
                            <span className="text-[11px] font-sans text-slate-400 truncate max-w-[140px]" title={ip.vendor}>
                              {ip.vendor}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block text-[11px] px-2.5 py-0.5 rounded font-semibold tracking-wide uppercase ${
                          STATUS_BADGE_CLASSES[ip.reconciliation_status] || STATUS_BADGE_CLASSES.FREE
                        }`}
                      >
                        {STATUS_LABELS[ip.reconciliation_status] || ip.reconciliation_status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap font-mono">
                      {formatLastSeen(ip.last_seen_at)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {isRogue && onTrustMac && (
                          <button
                            type="button"
                            onClick={() => onTrustMac(ip.id)}
                            disabled={isTrusting}
                            className="px-2.5 py-1.5 min-h-[32px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md inline-flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-mono"
                            title="Setujui perangkat: simpan Detected MAC sebagai Expected MAC dan tandai sebagai Assigned"
                          >
                            {isTrusting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyetujui...</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Approve / Trust MAC</span>
                              </>
                            )}
                          </button>
                        )}

                        {onEditIp && (
                          <button
                            type="button"
                            onClick={() => onEditIp(ip)}
                            aria-label={`Edit ${ip.ip_address}`}
                            className="px-2.5 py-1.5 min-h-[32px] bg-[#1a2233] hover:bg-[#232d42] text-slate-200 hover:text-white text-xs font-medium rounded-md border border-[#2d3a54] inline-flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 font-mono"
                            title="Edit konfigurasi host IP"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-400 font-mono">
        <div>
          {filteredIps.length > 0 ? (
            <span>
              Menampilkan <strong className="text-slate-200">{startIndex + 1}</strong> -{' '}
              <strong className="text-slate-200">{endIndex}</strong> dari{' '}
              <strong className="text-slate-200">{filteredIps.length}</strong> IP
            </span>
          ) : (
            <span>0 IP ditemukan</span>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 self-center sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage <= 1}
              className="px-2.5 py-1.5 rounded-md border border-[#283348] bg-[#10141f] text-slate-300 hover:bg-[#192030] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="px-3 py-1 font-mono text-slate-300">
              Hal. {validCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-md border border-[#283348] bg-[#10141f] text-slate-300 hover:bg-[#192030] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Halaman berikutnya"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}