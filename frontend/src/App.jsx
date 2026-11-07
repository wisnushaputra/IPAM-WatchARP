import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import AddSubnetModal from './components/AddSubnetModal.jsx';
import StatCards from './components/StatCards.jsx';
import IpGridMap from './components/IpGridMap.jsx';
import IpTable from './components/IpTable.jsx';
import EditIpModal from './components/EditIpModal.jsx';
import api from './services/api.js';
import { AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';

export default function App() {
  const [subnets, setSubnets] = useState([]);
  const [selectedSubnet, setSelectedSubnet] = useState(null);
  const [ips, setIps] = useState([]);
  const [selectedIp, setSelectedIp] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIpsLoading, setIsIpsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddSubnetModalOpen, setIsAddSubnetModalOpen] = useState(false);
  const [editingIp, setEditingIp] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTrustingId, setIsTrustingId] = useState(null);
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

  const loadSubnetIps = useCallback(async (subnetId) => {
    if (!subnetId) {
      setIps([]);
      setSelectedIp(null);
      return;
    }
    try {
      setIsIpsLoading(true);
      const data = await api.getSubnetIps(subnetId);
      const list = Array.isArray(data) ? data : [];
      setIps(list);
      setSelectedIp((prev) => {
        if (!prev) return null;
        return list.find((item) => item.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Failed to load subnet IPs:', err);
    } finally {
      setIsIpsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubnets();
  }, [loadSubnets]);

  useEffect(() => {
    if (selectedSubnet?.id) {
      loadSubnetIps(selectedSubnet.id);
    } else {
      setIps([]);
      setSelectedIp(null);
    }
  }, [selectedSubnet?.id, loadSubnetIps]);

  const handleSelectSubnet = (subnet) => {
    setSelectedSubnet(subnet);
    setSelectedIp(null);
    setScanNotification(null);
  };

  const handleSubnetCreated = (newSubnet) => {
    setSubnets((prev) => [newSubnet, ...prev]);
    setSelectedSubnet(newSubnet);
    setSelectedIp(null);
    setScanNotification({
      type: 'success',
      message: `Subnet "${newSubnet.name}" (${newSubnet.cidr}) berhasil dibuat.`,
    });
  };

  const handleDeleteSubnet = async (subnetId) => {
    if (!subnetId) return;
    try {
      await api.deleteSubnet(subnetId);
      setSubnets((prev) => prev.filter((s) => s.id !== subnetId));
      if (selectedSubnet?.id === subnetId) {
        const remaining = subnets.filter((s) => s.id !== subnetId);
        setSelectedSubnet(remaining.length > 0 ? remaining[0] : null);
        setSelectedIp(null);
      }
      setScanNotification({
        type: 'success',
        message: 'Subnet berhasil dihapus.',
      });
    } catch (err) {
      console.error('Failed to delete subnet:', err);
      setError(`Gagal menghapus subnet: ${err.message}`);
    }
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
      await loadSubnetIps(selectedSubnet.id);
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

  const handleOpenEdit = (ip) => {
    setEditingIp(ip);
    setIsEditModalOpen(true);
  };

  const handleTrustMac = async (ipId) => {
    if (!ipId || isTrustingId) return;
    try {
      setIsTrustingId(ipId);
      const updatedIp = await api.trustMac(ipId);
      setIps((prev) => prev.map((item) => (item.id === updatedIp.id ? updatedIp : item)));
      setSelectedIp((prev) => (prev && prev.id === updatedIp.id ? updatedIp : prev));
      if (selectedSubnet?.id) {
        await loadSubnets(selectedSubnet.id);
      }

      setScanNotification({
        type: 'success',
        message: `MAC address untuk IP ${updatedIp.ip_address} berhasil disetujui (sekarang Assigned).`,
      });
    } catch (err) {
      console.error('Failed to trust MAC:', err);
      setScanNotification({
        type: 'error',
        message: `Gagal menyetujui MAC: ${err.message || 'Terjadi kesalahan sistem.'}`,
      });
    } finally {
      setIsTrustingId(null);
    }
  };

  const handleIpSaved = async (updatedIp) => {
    setIps((prev) => prev.map((item) => (item.id === updatedIp.id ? updatedIp : item)));
    setSelectedIp((prev) => (prev && prev.id === updatedIp.id ? updatedIp : prev));
    if (selectedSubnet?.id) {
      await loadSubnets(selectedSubnet.id);
    }

    setScanNotification({
      type: 'success',
      message: `Konfigurasi host IP ${updatedIp.ip_address} berhasil disimpan.`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        subnets={subnets}
        selectedSubnet={selectedSubnet}
        onSelectSubnet={handleSelectSubnet}
        onOpenAddSubnet={() => setIsAddSubnetModalOpen(true)}
        onDeleteSubnet={handleDeleteSubnet}
        onScan={handleScan}
        isScanning={isScanning}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {scanNotification && (
          <div
            className={`p-3 pl-4 rounded border flex items-center justify-between gap-3 text-sm text-ink ${
              scanNotification.type === 'error' ? 'bg-bad/10 border-bad' : 'bg-ok/10 border-ok'
            }`}
            role={scanNotification.type === 'error' ? 'alert' : 'status'}
          >
            <div className="flex items-center gap-2.5">
              {scanNotification.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-bad flex-shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0" aria-hidden="true" />
              )}
              <span>{scanNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanNotification(null)}
              aria-label="Tutup notifikasi"
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded text-muted hover:text-ink hover:bg-sunken"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {isLoading && subnets.length === 0 ? (
          <div className="py-16 text-center" role="status">
            <Loader2 className="w-6 h-6 text-muted animate-spin mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-muted">Memuat data subnet...</p>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto my-10 p-6 border border-bad bg-surface rounded space-y-3" role="alert">
            <h2 className="text-lg font-semibold text-bad">Gagal memuat subnet</h2>
            <p className="text-sm text-ink">{error}</p>
            <button type="button" onClick={() => loadSubnets()} className="btn-secondary">
              Coba lagi
            </button>
          </div>
        ) : subnets.length === 0 ? (
          <div className="max-w-lg mx-auto my-10 space-y-4">
            <h2 className="text-xl font-semibold text-ink ledger-rule pb-2">Belum ada subnet</h2>
            <p className="text-sm text-muted leading-relaxed">
              Tambahkan subnet IPv4 /24 untuk mulai mencatat alokasi IP. Setelah itu jalankan scan ARP untuk
              melihat host mana yang benar-benar aktif.
            </p>
            <button type="button" onClick={() => setIsAddSubnetModalOpen(true)} className="btn-primary">
              Tambah Subnet Pertama
            </button>
          </div>
        ) : selectedSubnet ? (
          <>
            <section aria-labelledby="subnet-title" className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                <div>
                  <h2 id="subnet-title" className="text-2xl font-bold tracking-tight text-ink">
                    {selectedSubnet.name}
                  </h2>
                  <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <div>
                      <dt className="inline text-muted">CIDR </dt>
                      <dd className="inline font-mono text-ink">{selectedSubnet.cidr}</dd>
                    </div>
                    {selectedSubnet.gateway && (
                      <div>
                        <dt className="inline text-muted">Gateway </dt>
                        <dd className="inline font-mono text-ink">{selectedSubnet.gateway}</dd>
                      </div>
                    )}
                    {selectedSubnet.vlan_id && (
                      <div>
                        <dt className="inline text-muted">VLAN </dt>
                        <dd className="inline font-mono text-ink">{selectedSubnet.vlan_id}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <p className="text-sm text-muted">
                  Scan terakhir:{' '}
                  <span className="text-ink">
                    {selectedSubnet.last_scanned_at
                      ? new Date(selectedSubnet.last_scanned_at).toLocaleString('id-ID')
                      : 'belum pernah'}
                  </span>
                </p>
              </div>

              <StatCards summary={selectedSubnet} totalIps={selectedSubnet.total_ips || 254} ips={ips} />
            </section>

            <IpGridMap
              ips={ips}
              selectedIp={selectedIp}
              onSelectIp={setSelectedIp}
              onEditIp={handleOpenEdit}
              isLoading={isIpsLoading}
            />

            <IpTable
              ips={ips}
              selectedIp={selectedIp}
              onSelectIp={setSelectedIp}
              onEditIp={handleOpenEdit}
              onTrustMac={handleTrustMac}
              isTrustingId={isTrustingId}
            />
          </>
        ) : null}
      </main>

      <AddSubnetModal
        isOpen={isAddSubnetModalOpen}
        onClose={() => setIsAddSubnetModalOpen(false)}
        onCreated={handleSubnetCreated}
      />

      <EditIpModal
        isOpen={isEditModalOpen}
        ip={editingIp}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingIp(null);
        }}
        onSaved={handleIpSaved}
      />
    </div>
  );
}
