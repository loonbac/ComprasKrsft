/**
 * @file Modal para solicitar anulación de factura con datos de Nota de Crédito
 * @module compraskrsft/components/modals/CancelInvoiceModal
 */
import { useState } from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { formatNumber } from '../../utils';

/**
 * @param {{
 *   open: boolean,
 *   onClose: Function,
 *   batch: Object|null,
 *   onSubmit: Function,
 *   submitting: boolean,
 *   apiBase: string,
 * }} props
 */
export default function CancelInvoiceModal({ open, onClose, batch, onSubmit, submitting, apiBase }) {
  const [ncSerie, setNcSerie] = useState('');
  const [ncNumber, setNcNumber] = useState('');
  const [ncFile, setNcFile] = useState(null);
  const [ncLink, setNcLink] = useState('');

  const resetForm = () => {
    setNcSerie('');
    setNcNumber('');
    setNcFile(null);
    setNcLink('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!ncSerie.trim() || !ncNumber.trim()) return;
    if (!ncFile && !ncLink.trim()) return;
    onSubmit({
      batch_id: batch.batch_id,
      nc_serie: ncSerie.trim(),
      nc_number: ncNumber.trim(),
      nc_document: ncFile,
      nc_document_link: ncLink.trim() || null,
    }, resetForm);
  };

  if (!batch) return null;

  const canSubmit = ncSerie.trim() && ncNumber.trim() && (ncFile || ncLink.trim());

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="ANULAR FACTURA"
      titleIcon={<XCircleIcon className="size-5 text-red-500" />}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancelar</Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            loading={submitting}
          >
            {submitting ? 'Procesando...' : 'Confirmar Anulación'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Datos del Comprobante (solo lectura) ─────────────────── */}
        <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Lote:</span>
            <span className="font-medium text-gray-900">{batch.batch_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Proveedor:</span>
            <span className="font-medium text-gray-900">{batch.seller_name}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <span className="text-gray-500">Total:</span>
            <span className="text-lg font-bold text-primary">{batch.currency} {formatNumber(batch.total)}</span>
          </div>
        </div>

        {/* Datos del comprobante actual (solo lectura) */}
        {(batch.cdp_type || batch.cdp_serie) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Datos del Comprobante Actual</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo CP</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_type || '—'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Serie</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_serie || '—'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_number || '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Factura actual (archivo o link) */}
        {(batch.payment_proof || batch.payment_proof_link) && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-1">Factura Actual</h4>
            <div className="flex items-center gap-3 text-sm">
              {batch.payment_proof_link && (
                <a href={batch.payment_proof_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline text-sm">
                  Ver link de factura
                </a>
              )}
              {batch.payment_proof && (
                <a href={`${apiBase}/payment-proof-file?path=${encodeURIComponent(batch.payment_proof)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline text-sm">
                  Ver archivo de factura
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Separador visual ──────────────────────────────────────── */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-red-200" /></div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs font-semibold text-red-500 uppercase tracking-wider">Datos de Nota de Crédito</span>
          </div>
        </div>

        {/* ── Datos de Nota de Crédito (editables) ────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo CP *</label>
            <div className="rounded-lg border border-gray-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">07</div>
          </div>
          <Input
            label="Serie *"
            value={ncSerie}
            onChange={(e) => setNcSerie(e.target.value)}
            placeholder="F001"
            required
          />
          <Input
            label="Número *"
            value={ncNumber}
            onChange={(e) => setNcNumber(e.target.value)}
            placeholder="00000056"
            required
          />
        </div>

        <p className="text-xs text-red-600 font-medium">* Debe proporcionar al menos un archivo o un link de la Nota de Crédito</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0.5">Documento NC (PDF) *</label>
          <input
            type="file"
            onChange={(e) => setNcFile(e.target.files[0] || null)}
            accept=".pdf,image/*"
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-red-700 hover:file:bg-red-100"
          />
        </div>

        <Input
          label="Link de Nota de Crédito *"
          type="url"
          value={ncLink}
          onChange={(e) => setNcLink(e.target.value)}
          placeholder="https://..."
        />
      </div>
    </Modal>
  );
}
