import React from 'react';
import { Network, Plus, RefreshCw, Radio } from 'lucide-react';

/**
 * Top application header containing branding, subnet selector dropdown,
 * "+ Tambah Subnet" action, and "Scan Subnet Sekarang" trigger.
 * 
 * Props:
 * - subnets: Array<object>
 * - selectedSubnet: object | null
 * - onSelectSubnet: (subnet: object) => void
 * - onOpenAddSubnet: () => void
 * - onScan: () => void
 * - isScanning: boolean
 */
export default function Header({
  subnets = [],
  selectedSubnet = null,
  onSelectSubnet,
  onOpenAddSubnet,
  onScan,
  isScanning = false,
}) {
  const hasSubnets = Array.isArray(subnets) && subnets.length > 0;

  const handleSubnetChange = (e) => {
    const id = Number(e.target.value);
    const target = subnets.find((s) => s.id === id);
    if (target && onSelectSubnet) {
      onSelectSubnet(target);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm flex items-center justify-center">
            <Network className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                WatchARP
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                IPAM
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Simple IPAM &amp; Live ARP Scanner
            </p>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Subnet Selector Dropdown */}
          <div className="flex items-center">
            <label htmlFor="subnet-select" className="sr-only">
              Pilih Subnet
            </label>
            <select
              id="subnet-select"
              value={selectedSubnet ? selectedSubnet.id : ''}
              onChange={handleSubnetChange}
              disabled={!hasSubnets || isScanning}
              className="bg-slate-950 border border-slate-700/90 rounded-lg px-3 py-2 text-sm text-slate-100 min-h-[44px] min-w-[200px] sm:min-w-[240px] focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!hasSubnets ? (
                <option value="" disabled>
                  Belum ada subnet
                </option>
              ) : (
                subnets.map((subnet) => (
                  <option key={subnet.id} value={subnet.id}>
                    {`${subnet.name} (${subnet.cidr})${subnet.vlan_id ? ` - VLAN ${subnet.vlan_id}` : ''}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* + Tambah Subnet Button */}
          <button
            type="button"
            onClick={onOpenAddSubnet}
            disabled={isScanning}
            className="px-3.5 py-2 min-h-[44px] rounded-lg text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Tambah Subnet</span>
          </button>

          {/* Scan Subnet Sekarang Button */}
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning || !selectedSubnet}
            title={
              !selectedSubnet
                ? 'Pilih atau tambahkan subnet terlebih dahulu'
                : 'Jalankan live ARP scan pada subnet ini'
            }
            className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                <span>Memindai ARP...</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4 text-indigo-200" aria-hidden="true" />
                <span>Scan Subnet Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
