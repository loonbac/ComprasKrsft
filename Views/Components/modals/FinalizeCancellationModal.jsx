/**
 * @file Modal para revisar y finalizar/rechazar la anulación de una factura
 * @module compraskrsft/components/modals/FinalizeCancellationModal
 */
import { XCircleIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatNumber } from '../../utils';

/**
 * @param {{
 *   open: boolean,
 *   onClose: Function,
 *   batch: Object|null,
 *   onFinalize: Function,
 *   onReject: Function,
 *   processing: boolean,
 *   apiBase: string,
 * }} props
 */
export default function FinalizeCancellationModal({ open, onClose, batch, onFinalize, onReject, processing, apiBase }) {
  if (!batch) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="FINALIZAR ANULACIÓN"
      titleIcon={<ExclamationTriangleIcon className="size-5 text-amber-500" />}
      footer={
        <>
          <Button variant="danger" onClick={() => onReject(batch.batch_id)} disabled={processing}>
            Rechazar
          </Button>
          <Button
            variant="primary"
            onClick={() => onFinalize(batch.batch_id)}
            disabled={processing}
            loading={processing}
            className="!bg-red-600 hover:!bg-red-700"
          >
            {processing ? 'Procesando...' : 'Finalizar Anulación'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Info del lote */}
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
            <span className="text-lg font-bold text-red-600">{batch.currency} {formatNumber(batch.total)}</span>
          </div>
        </div>

        {/* Datos del comprobante original */}
        {(batch.cdp_type || batch.cdp_serie) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Comprobante Original</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo CP</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_type || '—'}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Serie</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_serie || '—'}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número</label>
                <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700">{batch.cdp_number || '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Factura original (archivo o link) */}
        {(batch.payment_proof || batch.payment_proof_link) && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Factura:</span>
            {batch.payment_proof_link && (
              <a href={batch.payment_proof_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline">Ver link</a>
            )}
            {batch.payment_proof && (
              <a href={`${apiBase}/payment-proof-file?path=${encodeURIComponent(batch.payment_proof)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline">Ver archivo</a>
            )}
          </div>
        )}

        {/* Separador */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-red-200" /></div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs font-semibold text-red-500 uppercase tracking-wider">Nota de Crédito</span>
          </div>
        </div>

        {/* Datos de la Nota de Crédito */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo CP</label>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{batch.nc_type || '07'}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Serie</label>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{batch.nc_serie || '—'}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Número</label>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{batch.nc_number || '—'}</div>
          </div>
        </div>

        {/* Documento NC */}
        {(batch.nc_document || batch.nc_document_link) && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Doc. NC:</span>
            {batch.nc_document_link && (
              <a href={batch.nc_document_link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline">Ver link NC</a>
            )}
            {batch.nc_document && (
              <a href={`${apiBase}/payment-proof-file?path=${encodeURIComponent(batch.nc_document)}`} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline">Ver archivo NC</a>
            )}
          </div>
        )}

        {/* Advertencia */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <ExclamationTriangleIcon className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Al finalizar la anulación, los ítems serán devueltos a <strong>Por Aprobar</strong>, se revertirá el gasto del proyecto y se generará una línea de negación en <strong>Contasis</strong>.
          </p>
        </div>
      </div>
    </Modal>
  );
}
