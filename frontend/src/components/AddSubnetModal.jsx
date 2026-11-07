import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg max-h-full overflow-y-auto bg-surface border border-line-strong rounded shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 ledger-rule">
          <div>
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-ink">
                Tambah Subnet Baru
              </h2>
              <p className="text-sm text-muted">
                Alokasikan network IPv4 /24 untuk IPAM dan pemindaian ARP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="btn-secondary px-0 w-11 sm:w-10 flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div
              className="p-3 bg-bad/10 border border-bad rounded text-ink text-sm flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="subnet-name"
              className="field-label"
            >
              Nama Subnet <span className="text-bad" aria-hidden="true">*</span>
            </label>
            <input
              id="subnet-name"
              type="text"
              autoFocus
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: LAN Kantor, VLAN 10 Servers"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="subnet-cidr"
                className="field-label"
              >
                CIDR (/24) <span className="text-bad" aria-hidden="true">*</span>
              </label>
              <span className="text-xs text-muted">254 host usable</span>
            </div>
            <input
              id="subnet-cidr"
              type="text"
              required
              disabled={isSubmitting}
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="192.168.1.0/24"
              className="field font-mono"
            />
            <p className="text-xs text-muted">
              WatchARP mendukung subnet dengan prefix /24.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="subnet-gateway"
                className="field-label"
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
                className="field font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="subnet-vlan"
                className="field-label"
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
                className="field font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
