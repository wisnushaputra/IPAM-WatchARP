import React, { useState, useEffect } from 'react';
import { X, Network, AlertCircle, Loader2 } from 'lucide-react';
import { createSubnet } from '../services/api.js';

/**
 * Modal dialog for creating a new /24 subnet.
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onCreated: (newSubnet: object) => void
 */
export default function AddSubnetModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [cidr, setCidr] = useState('');
  const [gateway, setGateway] = useState('');
  const [vlanId, setVlanId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setCidr('');
      setGateway('');
      setVlanId('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const validateForm = () => {
    const trimmedName = name.trim();
    const trimmedCidr = cidr.trim();
    const trimmedGateway = gateway.trim();
    const trimmedVlan = vlanId.trim();

    if (!trimmedName) {
      return 'Nama subnet wajib diisi.';
    }

    if (!trimmedCidr) {
      return 'CIDR subnet wajib diisi (contoh: 192.168.1.0/24).';
    }

    // Client-side validation: must end with /24
    if (!trimmedCidr.endsWith('/24')) {
      return 'CIDR harus menggunakan subnet mask /24 (contoh: 192.168.1.0/24).';
    }

    // Validate IPv4 structure
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/24$/;
    if (!cidrRegex.test(trimmedCidr)) {
      return 'Format CIDR tidak valid. Masukkan IPv4 /24 yang benar (contoh: 192.168.1.0/24).';
    }

    const ipPart = trimmedCidr.split('/')[0];
    const octets = ipPart.split('.').map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      return 'Setiap oktet IPv4 pada CIDR harus bernilai 0 sampai 255.';
    }

    if (trimmedGateway) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(trimmedGateway)) {
        return 'Format IP Gateway tidak valid (contoh: 192.168.1.1).';
      }
      const gwOctets = trimmedGateway.split('.').map(Number);
      if (gwOctets.some((o) => o < 0 || o > 255)) {
        return 'Setiap oktet IP Gateway harus bernilai 0 sampai 255.';
      }
    }

    if (trimmedVlan) {
      const parsedVlan = Number(trimmedVlan);
      if (!Number.isInteger(parsedVlan) || parsedVlan < 1 || parsedVlan > 4094) {
        return 'VLAN ID harus bernilai antara 1 dan 4094.';
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const payload = {
        name: name.trim(),
        cidr: cidr.trim(),
        gateway: gateway.trim() || undefined,
        vlan_id: vlanId.trim() ? Number(vlanId.trim()) : undefined,
      };

      const newSubnet = await createSubnet(payload);
      onCreated(newSubnet);
      onClose();
    } catch (err) {
      console.error('Failed to create subnet:', err);
      setError(err.message || 'Gagal menambahkan subnet baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-white">
                Tambah Subnet Baru
              </h2>
              <p className="text-xs text-slate-400">
                Alokasikan network IPv4 /24 untuk IPAM dan pemindaian ARP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200 text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Subnet Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="subnet-name"
              className="block text-xs font-medium uppercase tracking-wider text-slate-300"
            >
              Nama Subnet <span className="text-rose-400">*</span>
            </label>
            <input
              id="subnet-name"
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: LAN Kantor, VLAN 10 Servers"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-60"
            />
          </div>

          {/* CIDR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="subnet-cidr"
                className="block text-xs font-medium uppercase tracking-wider text-slate-300"
              >
                CIDR (/24) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">254 host usable</span>
            </div>
            <input
              id="subnet-cidr"
              type="text"
              required
              disabled={isSubmitting}
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="192.168.1.0/24"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-60"
            />
            <p className="text-[11px] text-slate-400">
              WatchARP mendukung subnet dengan prefix /24.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gateway */}
            <div className="space-y-1.5">
              <label
                htmlFor="subnet-gateway"
                className="block text-xs font-medium uppercase tracking-wider text-slate-300"
              >
                IP Gateway (Opsional)
              </label>
              <input
                id="subnet-gateway"
                type="text"
                disabled={isSubmitting}
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-60"
              />
            </div>

            {/* VLAN ID */}
            <div className="space-y-1.5">
              <label
                htmlFor="subnet-vlan"
                className="block text-xs font-medium uppercase tracking-wider text-slate-300"
              >
                VLAN ID (Opsional)
              </label>
              <input
                id="subnet-vlan"
                type="number"
                min="1"
                max="4094"
                disabled={isSubmitting}
                value={vlanId}
                onChange={(e) => setVlanId(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Subnet</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
