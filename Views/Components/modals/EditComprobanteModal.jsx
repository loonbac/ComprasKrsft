/**
 * @file Modal de Edición de Comprobante
 * @module compraskrsft/components/modals/EditComprobanteModal
 */
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { formatNumber } from '../../utils';

/**
 * @param {{
 *   showEditComprobanteModal: boolean,
 *   closeEditComprobante: Function,
 *   editComprobanteBatch: Object|null,
 *   editComprobanteForm: Object,
 *   setEditComprobanteForm: Function,
 *   onEditComprobanteFileChange: Function,
 *   saveComprobante: Function,
 *   savingComprobante: boolean,
 * }} props
 */
export default function EditComprobanteModal({
  showEditComprobanteModal,
  closeEditComprobante,
  editComprobanteBatch,
  editComprobanteForm,
  setEditComprobanteForm,
  onEditComprobanteFileChange,
  saveComprobante,
  savingComprobante,
}) {
  return (
    <Modal
      open={showEditComprobanteModal}
      onClose={closeEditComprobante}
      title="EDITAR COMPROBANTE"
      titleIcon={<PencilSquareIcon className="size-5 text-primary" />}
      footer={
        <>
          <Button variant="danger" onClick={closeEditComprobante}>Cancelar</Button>
          <Button variant="primary" onClick={saveComprobante} disabled={savingComprobante} loading={savingComprobante}>
            {savingComprobante ? 'Guardando...' : 'Guardar Comprobante'}
          </Button>
        </>
      }
    >
      {editComprobanteBatch && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Lote:</span><span className="font-medium text-gray-900">{editComprobanteBatch.batch_id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Proveedor:</span><span className="font-medium text-gray-900">{editComprobanteBatch.seller_name}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-500">Total:</span><span className="text-lg font-bold text-primary">{editComprobanteBatch.currency} {formatNumber(editComprobanteBatch.total)}</span></div>
          </div>

          <h4 className="text-sm font-semibold text-gray-900">Datos del Comprobante *</h4>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Tipo CP *" value={editComprobanteForm.cdp_type} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_type: e.target.value }))} placeholder="01, 03" required />
            <Input label="Serie *" value={editComprobanteForm.cdp_serie} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_serie: e.target.value }))} placeholder="F001" required />
            <Input label="Número *" value={editComprobanteForm.cdp_number} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_number: e.target.value }))} placeholder="00001234" required />
          </div>
          <p className="text-xs text-amber-600 font-medium">* Debe proporcionar al menos un archivo o un link de comprobante</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0.5">Comprobante (archivo) *</label>
            <input type="file" onChange={onEditComprobanteFileChange} accept="image/*,.pdf" className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200" />
          </div>
          <Input label="Link de comprobante *" type="url" value={editComprobanteForm.payment_proof_link} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, payment_proof_link: e.target.value }))} placeholder="https://..." />
        </div>
      )}
    </Modal>
  );
}
