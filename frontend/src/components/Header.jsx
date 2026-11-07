import React from 'react';
import { Network, Plus, RefreshCw, Radio, Trash2 } from 'lucide-react';

/**
 * Top application header containing branding, subnet selector dropdown,
 * "+ Tambah Subnet" action, and "Scan Subnet Sekarang" trigger.
 * 
 * Props:
 * - subnets: Array<object>
 * - selectedSubnet: object | null
 * - onSelectSubnet: (subnet: object) => void
 * - onOpenAddSubnet: () => void
 * - onDeleteSubnet: (subnetId: number) => void
 * - onScan: () => void
 * - isScanning: boolean
 */
export default function Header({
  subnets = [],
  selectedSubnet = null,
  onSelectSubnet,
  onOpenAddSubnet,
  onDeleteSubnet,
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
    <header className="border-b border-[#1f2637] bg-[#0f121a] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#181d2a] border border-[#273045] text-cyan-400 flex items-center justify-center flex-shrink-0">
            <Network className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-slate-100 font-mono">
                WatchARP
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181d2a] text-slate-400 border border-[#273045]">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-normal">
              Simple IPAM &amp; Live ARP Scanner
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center">
            <label htmlFor="subnet-select" className="sr-only">
              Pilih Subnet
            </label>
            <select
              id="subnet-select"
              value={selectedSubnet ? selectedSubnet.id : ''}
              onChange={handleSubnetChange}
              disabled={!hasSubnets || isScanning}
              className="bg-[#141824] border border-[#273045] rounded-md px-3 py-2 text-sm text-slate-100 min-h-[40px] min-w-[210px] sm:min-w-[250px] font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {selectedSubnet && onDeleteSubnet && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Hapus subnet "${selectedSubnet.name}" (${selectedSubnet.cidr}) beserta seluruh datanya?`)) {
                    onDeleteSubnet(selectedSubnet.id);
                  }
                }}
                disabled={isScanning}
                title={`Hapus subnet ${selectedSubnet.name}`}
                className="ml-1.5 p-2 min-h-[40px] min-w-[40px] rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#273045] hover:border-rose-500/30 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Hapus subnet ${selectedSubnet.name}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenAddSubnet}
            disabled={isScanning}
            className="px-3 py-2 min-h-[40px] rounded-md text-sm font-medium text-slate-200 bg-[#141824] hover:bg-[#1a2030] border border-[#273045] hover:border-slate-600 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Tambah Subnet</span>
          </button>

          <button
            type="button"
            onClick={onScan}
            disabled={isScanning || !selectedSubnet}
            title={
              !selectedSubnet
                ? 'Pilih atau tambahkan subnet terlebih dahulu'
                : 'Jalankan live ARP scan pada subnet ini'
            }
            className="px-3.5 py-2 min-h-[40px] rounded-md text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                <span>Memindai ARP...</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4 text-cyan-200" aria-hidden="true" />
                <span>Scan Subnet Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
