import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
import api from '../services/api.js';
import { statusLabel } from '../status.js';

/**
 * Validate standard 6-byte MAC Address format (e.g. 00:11:22:33:44:55 or 00-11-22-33-44-55).
 * Empty strings are considered valid (optional field).
 */
export function isValidMac(mac) {
  if (!mac || !mac.trim()) return true;
  const trimmed = mac.trim();
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(trimmed);
}

/**
 * Modal dialog for editing IP Host details (Admin status, Hostname, Expected MAC, Description).
 *
 * Props:
 * @param {Object} props.ip - The IP object to edit
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSaved - Callback with updated IP object on success
 */
export default function EditIpModal({ ip, isOpen, onClose, onSaved }) {
  const [adminStatus, setAdminStatus] = useState('available');
  const [hostname, setHostname] = useState('');
  const [expectedMac, setExpectedMac] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedHelper, setCopiedHelper] = useState(false);

  // Sync form state when IP or modal visibility changes
  useEffect(() => {
    if (isOpen && ip) {
      setAdminStatus(ip.admin_status || 'available');
      setHostname(ip.hostname || '');
      setExpectedMac(ip.expected_mac || '');
      setDescription(ip.description || '');
      setError('');
      setIsSubmitting(false);
      setCopiedHelper(false);
    }
  }, [isOpen, ip]);

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

  if (!isOpen || !ip) return null;

  const handleUseDetectedMac = () => {
    if (ip.detected_mac) {
      setExpectedMac(ip.detected_mac);
      setCopiedHelper(true);
      setTimeout(() => setCopiedHelper(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedExpectedMac = expectedMac.trim();
    if (trimmedExpectedMac && !isValidMac(trimmedExpectedMac)) {
      setError('Format MAC address tidak valid. Gunakan format AA:BB:CC:DD:EE:FF atau AA-BB-CC-DD-EE-FF.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const payload = {
        admin_status: adminStatus,
        hostname: hostname.trim() || null,
        expected_mac: trimmedExpectedMac ? trimmedExpectedMac.toUpperCase() : null,
        description: description.trim() || null,
      };

      const updatedIp = await api.updateIp(ip.id, payload);
      if (onSaved) {
        onSaved(updatedIp);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update IP address:', err);
      setError(err.message || 'Gagal memperbarui konfigurasi host IP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-ip-modal-title"
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
              <h2 id="edit-ip-modal-title" className="text-lg font-semibold text-ink">
                Edit IP: <span className="font-mono">{ip.ip_address}</span>
              </h2>
              <p className="text-sm text-muted">
                Konfigurasi status alokasi, hostname, dan Expected MAC untuk rekonsiliasi ARP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog edit IP"
            className="btn-secondary px-0 w-11 sm:w-10 flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-2.5 bg-sunken border-b border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${ip.is_online ? 'bg-ok' : 'border border-line-strong'}`}
              aria-hidden="true"
            />
            <span className={ip.is_online ? 'text-ok font-medium' : 'text-muted'}>
              {ip.is_online ? 'Online saat ini' : 'Offline'}
            </span>
          </span>

          {ip.detected_mac && (
            <span>
              Detected MAC:{' '}
              <strong className="text-ink font-mono font-medium">{ip.detected_mac}</strong>
              {ip.vendor && (
                <span className="ml-1">({ip.vendor})</span>
              )}
            </span>
          )}

          {ip.reconciliation_status && (
            <span>
              Status ARP:{' '}
              <strong className="text-ink font-medium">{statusLabel(ip.reconciliation_status)}</strong>
            </span>
          )}
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
              htmlFor="edit-admin-status"
              className="field-label"
            >
              Status Admin <span className="text-bad" aria-hidden="true">*</span>
            </label>
            <select
              id="edit-admin-status"
              value={adminStatus}
              onChange={(e) => setAdminStatus(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="field"
            >
              <option value="available">Available (Tersedia / Kosong)</option>
              <option value="assigned">Assigned (Dialokasikan ke Perangkat)</option>
              <option value="reserved">Reserved (Gateway / Infrastruktur Khusus)</option>
            </select>
            <p className="text-xs text-muted">
              Host berstatus <em>Available</em> yang terdeteksi aktif saat ARP scan akan ditandai sebagai <strong>ROGUE_DEVICE</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-hostname"
              className="field-label"
            >
              Hostname (Nama Perangkat)
            </label>
            <input
              id="edit-hostname"
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              disabled={isSubmitting}
              placeholder="contoh: server-db-01, ap-floor2, printer-marketing"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-expected-mac"
                className="field-label"
              >
                Expected MAC Address
              </label>

              {ip.detected_mac && (
                <button
                  type="button"
                  onClick={handleUseDetectedMac}
                  disabled={isSubmitting}
                  className="text-sm text-accent hover:underline inline-flex items-center gap-1.5 min-h-9 rounded px-1"
                >
                  {copiedHelper ? (
                    <>
                      <Check className="w-4 h-4 text-ok" aria-hidden="true" />
                      <span className="text-ok">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      <span>Gunakan Detected MAC</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              id="edit-expected-mac"
              type="text"
              value={expectedMac}
              onChange={(e) => setExpectedMac(e.target.value)}
              disabled={isSubmitting}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="field font-mono uppercase"
            />
            <p className="text-xs text-muted">
              Jika diisi, rekonsiliasi ARP akan mendeteksi apakah MAC terdeteksi cocok atau terjadi <strong>MAC_MISMATCH</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-description"
              className="field-label"
            >
              Deskripsi / Catatan Tambahan
            </label>
            <textarea
              id="edit-description"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Catatan penugasan IP, lokasi port switch, pemegang perangkat..."
              className="field resize-none"
            />
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
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}