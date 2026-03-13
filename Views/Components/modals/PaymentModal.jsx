/**
 * @file Modal de confirmación de pago
 * @module compraskrsft/components/modals/PaymentModal
 */
import { BanknotesIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { formatNumber } from '../../utils';

/**
 * @param {{
 *   showPaymentModal: boolean,
 *   closePaymentModal: Function,
 *   paymentBatch: Object|null,
 *   paymentForm: Object,
 *   setPaymentForm: Function,
 *   onPaymentProofChange: Function,
 *   confirmPayment: Function,
 *   confirmingPayment: boolean,
 * }} props
 */
export default function PaymentModal({
  showPaymentModal,
  closePaymentModal,
  paymentBatch,
  paymentForm,
  setPaymentForm,
  onPaymentProofChange,
  confirmPayment,
  confirmingPayment,
}) {
  return (
    <Modal
      open={showPaymentModal}
      onClose={closePaymentModal}
      title="CONFIRMAR PAGO"
      titleIcon={<BanknotesIcon className="size-5 text-primary" />}
      footer={
        <>
          <Button variant="danger" onClick={closePaymentModal}>Cancelar</Button>
          <Button variant="primary" onClick={confirmPayment} disabled={confirmingPayment || !paymentForm.payment_bank} loading={confirmingPayment}>
            {confirmingPayment ? 'Confirmando...' : 'Confirmar Pago'}
          </Button>
        </>
      }
    >
      {paymentBatch && (
        <div className="space-y-4">
          {paymentBatch.igv_enabled && <Badge variant="cyan" className="mb-2">+IGV</Badge>}
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Lote:</span><span className="font-medium text-gray-900">{paymentBatch.batch_id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Proveedor:</span><span className="font-medium text-gray-900">{paymentBatch.seller_name}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-500">Total:</span><span className="text-lg font-bold text-primary">{paymentBatch.currency} {formatNumber(paymentBatch.total)}</span></div>
          </div>

          <h4 className="text-sm font-semibold text-gray-900">Datos del Comprobante (opcional)</h4>
          <Select
            required
            label="Banco de pago"
            placeholder="— Seleccionar banco —"
            value={paymentForm.payment_bank}
            onChange={(e) => setPaymentForm((p) => ({ ...p, payment_bank: e.target.value }))}
          >
            <option value="1011 - CAJA MN">Cuenta 1011 - CAJA MN</option>
            <option value="10112 - CAJA CHICA MN - ADMINISTRACION">Cuenta 10112 - CAJA CHICA MN - ADMINISTRACION</option>
            <option value="104103 - BANCO DE CREDITO M.N. 191-2617376-0-40">Cuenta 104103 - BANCO DE CREDITO M.N. 191-2617376-0-40</option>
            <option value="104104 - BANCO DE CREDITO M.E. 191-2480078-1-01">Cuenta 104104 - BANCO DE CREDITO M.E. 191-2480078-1-01</option>
            <option value="104105 - BANCO CONTINENTAL M.N. 0201128681">Cuenta 104105 - BANCO CONTINENTAL M.N. 0201128681</option>
            <option value="104106 - BANCO CONTINENTAL M.N. 0100035070">Cuenta 104106 - BANCO CONTINENTAL M.N. 0100035070</option>
            <option value="104107 - BANCO CONTINENTAL M.N. 0201046030">Cuenta 104107 - BANCO CONTINENTAL M.N. 0201046030</option>
            <option value="104108 - BANCO CONTINENTAL M.E. 0100035321">Cuenta 104108 - BANCO CONTINENTAL M.E. 0100035321</option>
            <option value="104109 - BANCO SCOTIABANK M.N. 000-6320600">Cuenta 104109 - BANCO SCOTIABANK M.N. 000-6320600</option>
            <option value="104110 - BANCO INTERBANK M.N. 200-3004605533">Cuenta 104110 - BANCO INTERBANK M.N. 200-3004605533</option>
            <option value="104111 - BANCO INTERBANK M.E. 200-3004605540">Cuenta 104111 - BANCO INTERBANK M.E. 200-3004605540</option>
            <option value="104112 - BANCO DE LA NACION 072-050428">Cuenta 104112 - BANCO DE LA NACION 072-050428</option>
            <option value="104113 - BANCO INTERAMERICANO DE FINANZAS MN 0070">Cuenta 104113 - BANCO INTERAMERICANO DE FINANZAS MN 0070</option>
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Tipo CP" value={paymentForm.cdp_type} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_type: e.target.value }))} placeholder="01, 03" />
            <Input label="Serie" value={paymentForm.cdp_serie} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_serie: e.target.value }))} placeholder="F001" />
            <Input label="Número" value={paymentForm.cdp_number} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_number: e.target.value }))} placeholder="00001234" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0.5">Comprobante (opcional)</label>
            <input type="file" onChange={onPaymentProofChange} accept="image/*,.pdf" className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200" />
          </div>
          <Input label="Link de comprobante (opcional)" type="url" value={paymentForm.payment_proof_link} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_proof_link: e.target.value }))} placeholder="https://..." />
        </div>
      )}
    </Modal>
  );
}
