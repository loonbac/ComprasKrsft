/**
 * @file Modal de Pago Bulk
 * @module compraskrsft/components/modals/BulkPayModal
 */
import { BanknotesIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SupplierAutocomplete from '../ui/SupplierAutocomplete';
import { getProjectColor, formatProjectDisplay, getOrderTitle, getOrderQty, formatNumber } from '../../utils';

/**
 * @param {{
 *   showBulkModal: boolean,
 *   closeBulkModal: Function,
 *   selectedOrdersData: Array,
 *   bulkForm: Object,
 *   setBulkForm: Function,
 *   onCurrencyChange: Function,
 *   loadingRate: boolean,
 *   currentExchangeRate: number,
 *   prices: Object,
 *   setPrices: Function,
 *   bulkIgv: number,
 *   bulkTotal: number,
 *   bulkTotalPen: number,
 *   submitBulkApprove: Function,
 *   canSubmitBulk: boolean,
 *   approving: boolean,
 * }} props
 */
export default function BulkPayModal({
  showBulkModal,
  closeBulkModal,
  selectedOrdersData,
  bulkForm,
  setBulkForm,
  onCurrencyChange,
  loadingRate,
  currentExchangeRate,
  prices,
  setPrices,
  bulkIgv,
  bulkTotal,
  bulkTotalPen,
  submitBulkApprove,
  canSubmitBulk,
  approving,
  suppliers,
}) {
  return (
    <Modal
      open={showBulkModal}
      onClose={closeBulkModal}
      title={`Pagar ${selectedOrdersData.length} Órdenes`}
      titleIcon={<BanknotesIcon className="size-5 text-primary" />}
      size="lg"
      footer={
        <>
          <Button variant="danger" onClick={closeBulkModal}>Cancelar</Button>
          <Button variant="primary" onClick={submitBulkApprove} disabled={!canSubmitBulk || approving} loading={approving}>
            {approving ? 'Pagando...' : `Pagar ${selectedOrdersData.length} Órdenes`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Datos de Facturación</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SupplierAutocomplete
            label="Proveedor *"
            value={bulkForm.seller_name}
            onChange={(e) => setBulkForm((p) => ({ ...p, seller_name: e.target.value }))}
            onSelect={(supplier) => {
              setBulkForm((p) => ({
                ...p,
                seller_name: supplier.name,
                seller_document: supplier.document || p.seller_document,
              }));
            }}
            suggestions={suppliers?.suggestions || []}
            showSuggestions={suppliers?.showSuggestions || false}
            onSearch={suppliers?.searchSuppliers || (() => {})}
            onBlur={suppliers?.hideSuggestions || (() => {})}
            placeholder="Nombre o Razón Social"
            className="sm:col-span-2"
          />
          <Input label="RUC/DNI" value={bulkForm.seller_document} onChange={(e) => setBulkForm((p) => ({ ...p, seller_document: e.target.value }))} placeholder="20123456789" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select label="Moneda" value={bulkForm.currency} onChange={(e) => { const v = e.target.value; setBulkForm((p) => ({ ...p, currency: v })); onCurrencyChange(v); }} placeholder="">
            <option value="PEN">PEN - Soles</option>
            <option value="USD">USD - Dólares</option>
          </Select>
          <Input label="Fecha Emisión" type="date" value={bulkForm.issue_date} onChange={(e) => setBulkForm((p) => ({ ...p, issue_date: e.target.value }))} />
          <Select label="Tipo Pago" value={bulkForm.payment_type} onChange={(e) => setBulkForm((p) => ({ ...p, payment_type: e.target.value }))} placeholder="">
            <option value="cash">Contado</option>
            <option value="loan">Crédito</option>
          </Select>
          <Input label={bulkForm.payment_type === 'cash' ? 'F. Pago' : 'F. Vencimiento'} type="date" value={bulkForm.date_value} onChange={(e) => setBulkForm((p) => ({ ...p, date_value: e.target.value }))} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={bulkForm.igv_enabled} onChange={(e) => setBulkForm((p) => ({ ...p, igv_enabled: e.target.checked }))} className="rounded border-gray-300 text-primary focus:ring-primary" />
            Aplicar IGV
          </label>
          {bulkForm.igv_enabled && (
            <Input label="Tasa IGV (%)" type="number" step="0.01" value={bulkForm.igv_rate} onChange={(e) => setBulkForm((p) => ({ ...p, igv_rate: parseFloat(e.target.value) || 0 }))} className="w-32" />
          )}
        </div>

        {bulkForm.currency === 'USD' && (
          <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            {loadingRate ? 'Obteniendo tipo de cambio...' : currentExchangeRate > 0 ? `T.C: 1 USD = S/ ${currentExchangeRate.toFixed(4)}` : <span className="text-red-600">No se pudo obtener tipo de cambio</span>}
          </div>
        )}

        <h4 className="text-sm font-semibold text-gray-900 pt-2">Precios por Material</h4>
        <div className="space-y-4">
          {(() => {
            const groups = [];
            const seen = new Map();
            selectedOrdersData.forEach((order) => {
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
                        <span className="text-sm text-gray-500">{bulkForm.currency === 'USD' ? '$' : 'S/'}</span>
                        <input
                          value={prices[order.id] ?? ''}
                          onChange={(e) => setPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                          type="number" step="0.01" min="0.01"
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

        <div className="space-y-1 rounded-lg bg-gray-50 p-4 text-sm">
          {bulkForm.igv_enabled && (
            <div className="flex justify-between text-gray-500">
              <span>IGV ({bulkForm.igv_rate}%):</span>
              <span>{bulkForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(bulkIgv)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900">
            <span>TOTAL:</span>
            <span>{bulkForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(bulkTotal)}</span>
          </div>
          {bulkForm.currency === 'USD' && currentExchangeRate > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Equivalente en Soles:</span>
              <span>S/ {formatNumber(bulkTotalPen)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
