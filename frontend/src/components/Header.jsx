import React, { useState } from 'react';
import { RefreshCw, Trash2, Sun, Moon } from 'lucide-react';

function currentTheme() {
  if (typeof document === 'undefined') return 'light';
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const next = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ponytail: private mode, theme just won't persist
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === 'dark' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}
      title={next === 'dark' ? 'Tema gelap' : 'Tema terang'}
      className="btn-secondary px-0 w-11 sm:w-10"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}

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
    <header className="bg-surface ledger-rule lg:sticky lg:top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight text-ink">WatchARP</h1>
          <p className="text-sm text-muted whitespace-nowrap hidden sm:block">Simple IPAM &amp; Live ARP Scanner</p>
          <div className="ml-auto xl:ml-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="subnet-select" className="sr-only">
            Pilih subnet
          </label>
          <select
            id="subnet-select"
            value={selectedSubnet ? selectedSubnet.id : ''}
            onChange={handleSubnetChange}
            disabled={!hasSubnets || isScanning}
            className="field w-auto flex-1 sm:flex-none sm:min-w-[260px]"
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
              aria-label={`Hapus subnet ${selectedSubnet.name}`}
              className="btn-secondary px-0 w-11 sm:w-10 hover:text-bad hover:border-bad"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <button type="button" onClick={onOpenAddSubnet} disabled={isScanning} className="btn-secondary">
            Tambah Subnet
          </button>

          <button
            type="button"
            onClick={onScan}
            disabled={isScanning || !selectedSubnet}
            title={!selectedSubnet ? 'Pilih atau tambahkan subnet terlebih dahulu' : 'Kirim ARP ke 254 host di subnet ini'}
            className="btn-primary"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Memindai ARP...</span>
              </>
            ) : (
              <span>Scan Subnet Sekarang</span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
