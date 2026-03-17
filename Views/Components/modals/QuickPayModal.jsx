/**
 * @file Modal de Pago Rápido (wizard de 3 pasos)
 * @module compraskrsft/components/modals/QuickPayModal
 */
import {
  CurrencyDollarIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import SupplierAutocomplete from '../ui/SupplierAutocomplete';
import { getProjectColor, formatProjectDisplay, formatNumber } from '../../utils';

const AlertIcon = <ExclamationTriangleIcon className="size-3.5" />;

/**
 * @param {{
 *   showQuickPayModal: boolean,
 *   closeQuickPayModal: Function,
 *   quickPayStep: number,
 *   setQuickPayStep: Function,
 *   quickPayAvailableProjects: Array,
 *   selectProjectForQuickPay: Function,
 *   quickPaySelectedProject: Object|null,
 *   quickPayMaterialForm: Object,
 *   setQuickPayMaterialForm: Function,
 *   addQuickPayItem: Function,
 *   quickPayItems: Array,
 *   removeQuickPayItem: Function,
 *   proceedToQuickPayReview: Function,
 *   updateQuickPayItemPrice: Function,
 *   quickPaySubtotal: number,
 *   quickPayApprovalForm: Object,
 *   setQuickPayApprovalForm: Function,
 *   onQuickPayApprovalCurrencyChange: Function,
 *   quickPayPaymentForm: Object,
 *   setQuickPayPaymentForm: Function,
 *   onQuickPayProofChange: Function,
 *   completeQuickPay: Function,
 *   quickPayLoading: boolean,
 *   banks: Array,
 * }} props
 */
export default function QuickPayModal({
  showQuickPayModal,
  closeQuickPayModal,
  quickPayStep,
  setQuickPayStep,
  quickPayAvailableProjects,
  selectProjectForQuickPay,
  quickPaySelectedProject,
  quickPayMaterialForm,
  setQuickPayMaterialForm,
  addQuickPayItem,
  quickPayItems,
  removeQuickPayItem,
  proceedToQuickPayReview,
  updateQuickPayItemPrice,
  quickPaySubtotal,
  quickPayApprovalForm,
  setQuickPayApprovalForm,
  onQuickPayApprovalCurrencyChange,
  quickPayPaymentForm,
  setQuickPayPaymentForm,
  onQuickPayProofChange,
  completeQuickPay,
  quickPayLoading,
  currentExchangeRate,
  loadingRate,
  suppliers,
  banks = [],
}) {
  return (
    <Modal
      open={showQuickPayModal}
      onClose={closeQuickPayModal}
      title="PAGO RÁPIDO"
      titleIcon={<CurrencyDollarIcon className="size-5 text-primary" />}
      size="xl"
      footer={
        <>
          <Button variant="danger" onClick={closeQuickPayModal}>Cancelar</Button>
          {quickPayStep > 1 && <Button variant="secondary" onClick={() => setQuickPayStep((s) => s - 1)}>Atrás</Button>}
          {quickPayStep < 3 && <Button variant="primary" onClick={proceedToQuickPayReview}>Siguiente</Button>}
          {quickPayStep === 3 && (
            <Button variant="primary" onClick={completeQuickPay} disabled={quickPayLoading || !quickPayPaymentForm.payment_bank} loading={quickPayLoading}>
              {quickPayLoading ? 'Procesando...' : 'Confirmar Pago Rápido'}
            </Button>
          )}
        </>
      }
    >
      <div>
        <p className="mb-4 text-sm text-gray-500">Registra una compra al instante sin pasar por aprobaciones del jefe de proyectos ni esperar autorización de pago</p>

        {/* Step 1: Select Project */}
        {quickPayStep === 1 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Selecciona un Proyecto</h4>
            {quickPayAvailableProjects.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay proyectos disponibles</p>
            ) : (
              <div className="space-y-2">
                {quickPayAvailableProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => selectProjectForQuickPay(project)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 p-4 text-left transition-colors hover:bg-gray-50 hover:border-emerald-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-3 rounded-full" style={{ background: getProjectColor(project.id) }} />
                      <span className="font-medium text-gray-900">{formatProjectDisplay(project)}</span>
                    </div>
                    <Badge variant="amber" border>{project.currency}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Add Items */}
        {quickPayStep === 2 && quickPaySelectedProject && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Proyecto:</span>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: getProjectColor(quickPaySelectedProject.id) }}>{formatProjectDisplay(quickPaySelectedProject)}</span>
            </div>

            <div className="rounded-lg border border-gray-100 p-4 space-y-3">
              <h5 className="text-sm font-semibold text-gray-900">Agregar Material</h5>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input label="Cant. *" type="number" min="1" value={quickPayMaterialForm.qty} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, qty: parseInt(e.target.value) || 1 }))} />
                <Input label="Tipo de Material *" value={quickPayMaterialForm.material_type} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, material_type: e.target.value }))} placeholder="Ej: ángulo, brida..." />
                <Input label="Especificación Técnica" value={quickPayMaterialForm.description} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, description: e.target.value }))} placeholder="Ej: ángulos de 2&quot; x 3/16&quot;" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input label="Medida" value={quickPayMaterialForm.diameter} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, diameter: e.target.value }))} placeholder="Ej: und, kg, m..." />
                <Input label="Tipo de Conexión" value={quickPayMaterialForm.series} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, series: e.target.value }))} placeholder="Ej: soldable, roscado..." />
                <Input label="Observaciones" value={quickPayMaterialForm.notes} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionales..." />
              </div>
              <Button variant="primary" size="sm" onClick={addQuickPayItem} className="gap-1.5">
                <PlusIcon className="size-4" />
                Agregar Item
              </Button>
            </div>

            {quickPayItems.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-gray-900">Items Agregados</h5>
                {quickPayItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.material_type}</p>
                      <p className="text-xs text-gray-500">
                        Cant: {item.qty}
                        {item.description && item.description !== item.material_type && ` · ${item.description}`}
                        {item.diameter && ` · Medida: ${item.diameter}`}
                        {item.series && ` · Conex: ${item.series}`}
                        {item.notes && ` · ${item.notes}`}
                      </p>
                    </div>
                    <button onClick={() => removeQuickPayItem(idx)} className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                      <XMarkIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Pay */}
        {quickPayStep === 3 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Items & Pricing */}
            <div className="rounded-lg border border-gray-100 p-4 space-y-3">
              <h5 className="text-sm font-semibold text-gray-900">Items a Pagar</h5>
              <div className="space-y-2">
                {quickPayItems.map((item, idx) => (
                  <div key={idx} className="rounded border border-gray-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    <p className="text-xs text-gray-500">Cant: {item.qty} · Und: {item.unit}</p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Precio x Und:</label>
                      <input value={item.price || ''} onChange={(e) => updateQuickPayItemPrice(idx, e.target.value)} type="number" min="0" step="0.01" className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm shadow-sm" placeholder="0.00" />
                      <span className="text-sm font-medium text-gray-700">S/ {formatNumber(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold text-gray-900">
                <span>Total:</span>
                <span>S/ {formatNumber(quickPaySubtotal)}</span>
              </div>
            </div>

            {/* Right: Supplier & Payment Info */}
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-900">Datos del Proveedor</h5>
                  <Badge variant="warning">{AlertIcon} OBLIGATORIO</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SupplierAutocomplete
                    label="Proveedor *"
                    value={quickPayApprovalForm.seller_name}
                    onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, seller_name: e.target.value }))}
                    onSelect={(supplier) => {
                      setQuickPayApprovalForm((p) => ({
                        ...p,
                        seller_name: supplier.name,
                        seller_document: supplier.document || p.seller_document,
                      }));
                    }}
                    suggestions={suppliers?.suggestions || []}
                    showSuggestions={suppliers?.showSuggestions || false}
                    onSearch={suppliers?.searchSuppliers || (() => { })}
                    onBlur={suppliers?.hideSuggestions || (() => { })}
                    placeholder="Razón social"
                  />
                  <Input label="RUC *" value={quickPayApprovalForm.seller_document} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, seller_document: e.target.value }))} placeholder="201..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Moneda" value={quickPayApprovalForm.currency} onChange={(e) => { const v = e.target.value; setQuickPayApprovalForm((p) => ({ ...p, currency: v })); onQuickPayApprovalCurrencyChange(v); }} placeholder="">
                    <option value="PEN">Soles</option>
                    <option value="USD">Dólares</option>
                  </Select>
                  <Select label="Tipo de Gasto" value={quickPayApprovalForm.expense_type} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, expense_type: e.target.value }))} placeholder="">
                    <option value="MO">MO</option>
                    <option value="directo">Directo</option>
                    <option value="indirecto">Indirecto</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Tipo Pago" value={quickPayApprovalForm.payment_type} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, payment_type: e.target.value }))} placeholder="">
                    <option value="cash">Al Contado</option>
                    <option value="loan">Crédito</option>
                  </Select>
                  <Input label="Emisión" type="date" value={quickPayApprovalForm.issue_date} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, issue_date: e.target.value }))} />
                </div>
                {quickPayApprovalForm.payment_type === 'loan' && (
                  <Input label="Vencimiento" type="date" value={quickPayApprovalForm.due_date} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, due_date: e.target.value }))} className="w-1/3" />
                )}
                {quickPayApprovalForm.currency === 'USD' && (
                  <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
                    {loadingRate ? 'Obteniendo tipo de cambio...' : currentExchangeRate > 0 ? `T.C: 1 USD = S/ ${currentExchangeRate.toFixed(4)}` : <span className="text-red-600">No se pudo obtener tipo de cambio</span>}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-100 p-4 space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Comprobante (Opcional)</h5>
                <Select
                  required
                  label="Banco de pago"
                  placeholder="— Seleccionar banco —"
                  value={quickPayPaymentForm.payment_bank}
                  onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, payment_bank: e.target.value }))}
                >
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.name}>{`Cuenta ${bank.name}`}</option>
                  ))}
                </Select>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Tipo" value={quickPayPaymentForm.cdp_type} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_type: e.target.value }))} placeholder="01" />
                  <Input label="Serie" value={quickPayPaymentForm.cdp_serie} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_serie: e.target.value }))} placeholder="F001" />
                  <Input label="Número" value={quickPayPaymentForm.cdp_number} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_number: e.target.value }))} placeholder="1234" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0.5">Archivo</label>
                  <input type="file" onChange={onQuickPayProofChange} accept="image/*,.pdf" className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200" />
                </div>
                <Input label="Link" type="url" value={quickPayPaymentForm.payment_proof_link} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, payment_proof_link: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
