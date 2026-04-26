/**
 * @file Modal de Aprobación con precios (mover a "Por Pagar")
 * @module compraskrsft/components/modals/ApprovalModal
 */
import { CheckCircleIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SupplierAutocomplete from '../ui/SupplierAutocomplete';
import { getProjectColor, formatProjectDisplay, getOrderTitle, getOrderQty, formatNumber } from '../../utils';

/**
 * @param {{
 *   showApprovalModal: boolean,
 *   closeApprovalModal: Function,
 *   selectedApprovalOrdersData: Array,
 *   approvalForm: Object,
 *   setApprovalForm: Function,
 *   onApprovalCurrencyChange: Function,
 *   loadingRate: boolean,
 *   currentExchangeRate: number,
 *   approvalPrices: Object,
 *   setApprovalPrices: Function,
 *   approvalCashflowTotal: number,
 *   approvalIgv: number,
 *   approvalTotal: number,
 *   submitApprovalPending: Function,
 *   canSubmitApproval: boolean,
 *   approvingPending: boolean,
 * }} props
 */
export default function ApprovalModal({
  showApprovalModal,
  closeApprovalModal,
  selectedApprovalOrdersData,
  approvalForm,
  setApprovalForm,
  onApprovalCurrencyChange,
  loadingRate,
  currentExchangeRate,
  approvalPrices,
  setApprovalPrices,
  approvalCashflowTotal,
  approvalIgv,
  approvalTotal,
  submitApprovalPending,
  canSubmitApproval,
  approvingPending,
  suppliers,
}) {
  return (
    <Modal
      open={showApprovalModal}
      onClose={closeApprovalModal}
      title={`Enviar ${selectedApprovalOrdersData.length} Órdenes a Por Pagar`}
      titleIcon={<CheckCircleIcon className="size-5 text-primary" />}
      size="lg"
      footer={
        <>
          <Button variant="danger" onClick={closeApprovalModal}>Cancelar</Button>
          <Button variant="primary" onClick={submitApprovalPending} disabled={!canSubmitApproval || approvingPending} loading={approvingPending}>
            {approvingPending ? 'Procesando...' : `Enviar ${selectedApprovalOrdersData.length} a Por Pagar`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Datos de Facturación</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SupplierAutocomplete
            label="Proveedor *"
            value={approvalForm.seller_name}
            onChange={(e) => setApprovalForm((p) => ({ ...p, seller_name: e.target.value }))}
            onSelect={(supplier) => {
              setApprovalForm((p) => ({
                ...p,
                seller_name: supplier.name,
                seller_document: supplier.document || p.seller_document,
              }));
            }}
            suggestions={suppliers?.suggestions || []}
            showSuggestions={suppliers?.showSuggestions || false}
            onSearch={suppliers?.searchSuppliers || (() => { })}
            onBlur={suppliers?.hideSuggestions || (() => { })}
            placeholder="Nombre o Razón Social"
            className="sm:col-span-2"
          />
          <Input label="RUC/DNI" value={approvalForm.seller_document} onChange={(e) => setApprovalForm((p) => ({ ...p, seller_document: e.target.value }))} placeholder="20123456789" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Tipo de Pago *" value={approvalForm.payment_type} onChange={(e) => setApprovalForm((p) => ({ ...p, payment_type: e.target.value }))} placeholder="">
            <option value="cash">Pago Directo</option>
            <option value="loan">Pago a Crédito</option>
          </Select>
          <Select label="Moneda" value={approvalForm.currency} onChange={(e) => { const v = e.target.value; setApprovalForm((p) => ({ ...p, currency: v })); onApprovalCurrencyChange(v); }} placeholder="">
            <option value="PEN">PEN - Soles</option>
            <option value="USD">USD - Dólares</option>
          </Select>
          <Select label="Tipo de Gasto" value={approvalForm.expense_type} onChange={(e) => setApprovalForm((p) => ({ ...p, expense_type: e.target.value }))} placeholder="">
            <option value="mo">MO (Mano de Obra)</option>
            <option value="direct">Gasto Directo</option>
            <option value="indirect">Gasto Indirecto</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Fecha Emisión" type="date" value={approvalForm.issue_date} onChange={(e) => setApprovalForm((p) => ({ ...p, issue_date: e.target.value }))} />
          {approvalForm.payment_type === 'loan' && (
            <Input label="Fecha Vencimiento" type="date" value={approvalForm.due_date} onChange={(e) => setApprovalForm((p) => ({ ...p, due_date: e.target.value }))} />
          )}
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={approvalForm.igv_enabled} onChange={(e) => setApprovalForm((p) => ({ ...p, igv_enabled: e.target.checked }))} className="rounded border-gray-300 text-primary focus:ring-primary" />
            Aplicar IGV
          </label>
          {approvalForm.igv_enabled && (
            <Input label="Tasa IGV (%)" type="number" step="0.01" value={approvalForm.igv_rate} onChange={(e) => setApprovalForm((p) => ({ ...p, igv_rate: parseFloat(e.target.value) || 0 }))} className="w-32" />
          )}
        </div>

        {/* Exchange Rate */}
        {approvalForm.currency === 'USD' && (
          <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            {loadingRate ? 'Obteniendo tipo de cambio...' : currentExchangeRate > 0 ? `T.C: 1 USD = S/ ${currentExchangeRate.toFixed(4)}` : <span className="text-red-600">No se pudo obtener tipo de cambio</span>}
          </div>
        )}

        {/* Materials Pricing — grouped by project */}
        <h4 className="text-sm font-semibold text-gray-900 pt-2">Precios por Material</h4>
        <div className="space-y-4">
          {(() => {
            const groups = [];
            const seen = new Map();
            selectedApprovalOrdersData.forEach((order) => {
              if (!seen.has(order.project_id)) {
                const g = {
                  project_id: order.project_id,
                  project_name: order.project_name,
                  project_abbreviation: order.project_abbreviation,
                  ceco_codigo: order.ceco_codigo,
                  orders: []
                };
                seen.set(order.project_id, g);
                groups.push(g);
              }
              seen.get(order.project_id).orders.push(order);
            });
            return groups.map((group) => (
              <div key={group.project_id} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Project header */}
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: getProjectColor(group.project_id) }}>
                  <span className="text-sm font-semibold text-white break-words leading-snug">{formatProjectDisplay(group)}</span>
                </div>
                {/* Material rows */}
                <div className="divide-y divide-gray-100">
                  {group.orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex-1 text-sm text-gray-700 truncate">{getOrderTitle(order)}</span>
                      <span className="text-xs text-gray-500 shrink-0">{getOrderQty(order)}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm text-gray-500">{approvalForm.currency === 'USD' ? '$' : 'S/'}</span>
                        <input
                          value={approvalPrices[order.id] ?? ''}
                          onChange={(e) => setApprovalPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                          type="number" step="0.01" min="0"
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm shadow-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Totals */}
        <div className="space-y-1 rounded-lg bg-gray-50 p-4 text-sm">
          <div className="flex justify-between font-medium">
            <span className="flex items-center gap-2"><CurrencyDollarIcon className="size-4" /> Gasto Real:</span>
            <span>{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalCashflowTotal)}</span>
          </div>
          {approvalForm.igv_enabled && approvalCashflowTotal > 0 && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>IGV ({approvalForm.igv_rate}%):</span>
                <span>{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalIgv)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900">
                <span>Total con IGV:</span>
                <span>{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
