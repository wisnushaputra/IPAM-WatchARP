import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import AddSubnetModal from './components/AddSubnetModal.jsx';
import api from './services/api.js';
import {
  Network,
  Plus,
  Server,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  X,
  Loader2,
} from 'lucide-react';

export default function App() {
  const [subnets, setSubnets] = useState([]);
  const [selectedSubnet, setSelectedSubnet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddSubnetModalOpen, setIsAddSubnetModalOpen] = useState(false);
  const [scanNotification, setScanNotification] = useState(null);
  const [error, setError] = useState(null);

  const loadSubnets = useCallback(async (preserveSelectedId = null) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSubnets();
      const list = Array.isArray(data) ? data : [];
      setSubnets(list);

      if (list.length > 0) {
        if (preserveSelectedId) {
          const matched = list.find((s) => s.id === preserveSelectedId);
          setSelectedSubnet(matched || list[0]);
        } else {
          setSelectedSubnet((prev) => {
            if (prev) {
              const matched = list.find((s) => s.id === prev.id);
              return matched || list[0];
            }
            return list[0];
          });
        }
      } else {
        setSelectedSubnet(null);
      }
    } catch (err) {
      console.error('Failed to load subnets:', err);
      setError(err.message || 'Gagal memuat daftar subnet dari server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubnets();
  }, [loadSubnets]);

  const handleSelectSubnet = (subnet) => {
    setSelectedSubnet(subnet);
    setScanNotification(null);
  };

  const handleSubnetCreated = (newSubnet) => {
    setSubnets((prev) => [...prev, newSubnet]);
    setSelectedSubnet(newSubnet);
    setScanNotification({
      type: 'success',
      message: `Subnet "${newSubnet.name}" (${newSubnet.cidr}) berhasil dibuat.`,
    });
  };

  const handleScan = async () => {
    if (!selectedSubnet || isScanning) return;

    try {
      setIsScanning(true);
      setScanNotification(null);

      const result = await api.scanSubnet(selectedSubnet.id);

      setScanNotification({
        type: 'success',
        message: `Scan ARP selesai: ${result.total_online} host online terdeteksi${
          result.total_anomalies > 0 ? `, ${result.total_anomalies} anomali ditemukan` : ''
        }.`,
      });

      // Refetch subnets to update summary metrics (online_count, rogue_count, last_scanned_at)
      await loadSubnets(selectedSubnet.id);
    } catch (err) {
      console.error('Scan failed:', err);
      setScanNotification({
        type: 'error',
        message: `Gagal menjalankan scan ARP: ${err.message}`,
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        subnets={subnets}
        selectedSubnet={selectedSubnet}
        onSelectSubnet={handleSelectSubnet}
        onOpenAddSubnet={() => setIsAddSubnetModalOpen(true)}
        onScan={handleScan}
        isScanning={isScanning}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Scan Notification Banner */}
        {scanNotification && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
              scanNotification.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2.5">
              {scanNotification.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{scanNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanNotification(null)}
              aria-label="Tutup notifikasi"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Loading State */}
        {isLoading && subnets.length === 0 ? (
          <div className="p-12 text-center border border-slate-800 bg-slate-850 rounded-xl">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-300">Memuat data subnet...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 text-center border border-rose-800/60 bg-rose-950/30 rounded-xl space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-semibold text-rose-200">Gagal Memuat Subnet</h2>
            <p className="text-sm text-rose-300 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => loadSubnets()}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : subnets.length === 0 ? (
          /* Empty State: No Subnets Created Yet */
          <div className="p-12 text-center border border-slate-800 bg-slate-850 rounded-2xl max-w-xl mx-auto my-8 space-y-4">
            <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto">
              <Network className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Belum Ada Subnet Terdaftar</h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                WatchARP siap mengelola IP address dan mendeteksi host jaringan melalui ARP scanning.
                Tambahkan subnet IPv4 /24 pertama Anda untuk memulai.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddSubnetModalOpen(true)}
                className="px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Subnet Pertama</span>
              </button>
            </div>
          </div>
        ) : selectedSubnet ? (
          /* Subnet Overview Panel */
          <div className="space-y-6">
            <div className="bg-slate-850 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {selectedSubnet.name}
                    </h2>
                    {selectedSubnet.vlan_id && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        VLAN {selectedSubnet.vlan_id}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                    <span>CIDR: <strong className="text-slate-200">{selectedSubnet.cidr}</strong></span>
                    {selectedSubnet.gateway && (
                      <span>Gateway: <strong className="text-slate-200">{selectedSubnet.gateway}</strong></span>
                    )}
                    <span>Total Hosts: <strong className="text-slate-200">{selectedSubnet.total_ips || 254}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>
                    Terakhir di-scan:{' '}
                    <span className="text-slate-300 font-medium">
                      {selectedSubnet.last_scanned_at
                        ? new Date(selectedSubnet.last_scanned_at).toLocaleString()
                        : 'Belum pernah di-scan'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Preliminary Metric Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Assigned IPs</span>
                    <Server className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-100 font-mono">
                    {selectedSubnet.assigned_count ?? 0}
                    <span className="text-xs font-normal text-slate-500 ml-1">/ 254</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Host Online</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-400 font-mono">
                    {selectedSubnet.online_count ?? 0}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Rogue Devices</span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="mt-1 text-xl font-bold text-rose-400 font-mono">
                    {selectedSubnet.rogue_count ?? 0}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>MAC Mismatch</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-1 text-xl font-bold text-amber-400 font-mono">
                    {selectedSubnet.mismatch_count ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholder container for Task 8, 9, 10 */}
            <div className="p-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/50 text-center text-sm text-slate-400">
              <ShieldCheck className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
              <p className="font-medium text-slate-300">
                Subnet View Siap
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Detail Subnet (Task 8), Grid 254 IP Address interaktif (Task 9), dan Modal Rekonsiliasi (Task 10) akan ditampilkan di sini.
              </p>
            </div>
          </div>
        ) : null}
      </main>

      {/* Add Subnet Modal */}
      <AddSubnetModal
        isOpen={isAddSubnetModalOpen}
        onClose={() => setIsAddSubnetModalOpen(false)}
        onCreated={handleSubnetCreated}
      />
    </div>
  );
}
