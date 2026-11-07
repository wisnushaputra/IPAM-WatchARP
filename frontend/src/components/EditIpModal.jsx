import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Server,
  ShieldAlert,
  Info,
} from 'lucide-react';
import api from '../services/api.js';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-ip-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg bg-[#121622] border border-[#202739] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#202739] bg-[#0d1019]">
          <div className="flex items-center gap-3">
            <Edit2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 id="edit-ip-modal-title" className="text-base font-semibold text-white">
                Edit IP: <span className="font-mono text-cyan-300">{ip.ip_address}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Konfigurasi status alokasi, hostname, dan Expected MAC untuk rekonsiliasi ARP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog edit IP"
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 bg-[#090c14] border-b border-[#202739] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-sm ${
                ip.is_online ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            <span className={ip.is_online ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
              {ip.is_online ? 'Online saat ini' : 'Offline'}
            </span>
          </span>

          {ip.detected_mac && (
            <span>
              Detected MAC:{' '}
              <strong className="text-slate-200 font-mono">{ip.detected_mac}</strong>
              {ip.vendor && (
                <span className="text-slate-400 ml-1">({ip.vendor})</span>
              )}
            </span>
          )}

          {ip.reconciliation_status && (
            <span>
              Status ARP:{' '}
              <strong className="text-slate-300">{ip.reconciliation_status}</strong>
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-md text-rose-200 text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="edit-admin-status"
              className="block text-xs font-mono font-medium uppercase tracking-wider text-slate-300"
            >
              Status Admin <span className="text-rose-400">*</span>
            </label>
            <select
              id="edit-admin-status"
              value={adminStatus}
              onChange={(e) => setAdminStatus(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-[#0b0e17] border border-[#263248] rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors font-mono disabled:opacity-60"
            >
              <option value="available">Available (Tersedia / Kosong)</option>
              <option value="assigned">Assigned (Dialokasikan ke Perangkat)</option>
              <option value="reserved">Reserved (Gateway / Infrastruktur Khusus)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Host berstatus <em>Available</em> yang terdeteksi aktif saat ARP scan akan ditandai sebagai <strong>ROGUE_DEVICE</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-hostname"
              className="block text-xs font-mono font-medium uppercase tracking-wider text-slate-300"
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
              className="w-full bg-[#0b0e17] border border-[#263248] rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors font-mono disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="edit-expected-mac"
                className="block text-xs font-mono font-medium uppercase tracking-wider text-slate-300"
              >
                Expected MAC Address
              </label>

              {ip.detected_mac && (
                <button
                  type="button"
                  onClick={handleUseDetectedMac}
                  disabled={isSubmitting}
                  className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-mono transition-colors focus-visible:ring-1 focus-visible:ring-cyan-400 rounded px-1"
                >
                  {copiedHelper ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
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
              className="w-full bg-[#0b0e17] border border-[#263248] rounded-md px-3.5 py-2 text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors uppercase disabled:opacity-60"
            />
            <p className="text-[11px] text-slate-400">
              Jika diisi, rekonsiliasi ARP akan mendeteksi apakah MAC terdeteksi cocok atau terjadi <strong>MAC_MISMATCH</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-description"
              className="block text-xs font-mono font-medium uppercase tracking-wider text-slate-300"
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
              className="w-full bg-[#0b0e17] border border-[#263248] rounded-md px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors resize-none disabled:opacity-60 font-mono"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#202739]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 min-h-[38px] rounded-md text-xs font-mono text-slate-300 bg-[#182133] hover:bg-[#202b40] hover:text-white border border-[#2a3750] transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 min-h-[38px] rounded-md text-xs font-mono font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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