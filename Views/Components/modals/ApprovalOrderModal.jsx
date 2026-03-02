/**
 * @file Modal de Aprobación de Orden de Compra con integración de inventario.
 *
 * Flujo:
 *  1. Muestra datos de facturación (proveedor, RUC).
 *  2. Lista los materiales con toggle "¿Usar de Almacén?" por cada uno.
 *  3. Cuando se activa el toggle se abre el StockLotPanel lateral
 *     para seleccionar un lote y cantidad.
 *  4. La fila del material se divide en "Compra Directa" + "Stock Asignado".
 *  5. El resumen muestra Costo Compra Directa, Costo Almacén (Interno) y Gasto Real Total.
 *
 * @module compraskrsft/components/modals/ApprovalOrderModal
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import SupplierAutocomplete from '../ui/SupplierAutocomplete';
import StockLotPanel from './StockLotPanel';
import { getProjectColor, getOrderTitle, getOrderQty, getOrderQtyNum, formatNumber, roundMoney } from '../../utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Currency symbol */
const sym = (c) => (c === 'USD' ? '$' : 'S/');

/**
 * Build a material-level summary from the order + its stock assignment.
 */
function buildMaterialSummary(order, stock, price, currency) {
  const totalQty = getOrderQtyNum(order);
  const unit = order.unit || 'UND';

  if (!stock) {
    // No stock assignment – 100 % purchase
    return {
      purchaseQty: totalQty,
      stockQty: 0,
      stockLot: null,
      unitPrice: totalQty > 0 && price > 0 ? roundMoney(price / totalQty) : 0,
      purchaseTotal: roundMoney(price),
      stockTotal: 0,
    };
  }

  const stockQty = stock.qty || 0;
  const purchaseQty = Math.max(0, totalQty - stockQty);
  const stockUnitPrice = roundMoney(stock.unitPrice || 0);
  const stockTotal = roundMoney(stockQty * stockUnitPrice);
  const purchaseTotal = roundMoney(price);

  return {
    purchaseQty,
    stockQty,
    stockLot: stock,
    unitPrice: purchaseQty > 0 && purchaseTotal > 0 ? roundMoney(purchaseTotal / purchaseQty) : 0,
    purchaseTotal,
    stockTotal,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ApprovalOrderModal({
  open,
  onClose,
  orders,
  approvalForm,
  setApprovalForm,
  onCurrencyChange,
  loadingRate,
  currentExchangeRate,
  prices,
  setPrices,
  stockAssignments,
  setStockAssignments,
  onSubmit,
  canSubmit,
  submitting,
  suppliers,
  // Inventory search callback – receives (orderId, searchText) → Promise<lots[]>
  onSearchInventory,
}) {
  // ── Local state ───────────────────────────────────────────────────────
  const [activeMaterialId, setActiveMaterialId] = useState(null); // which mat has stock panel open
  const [inventoryResults, setInventoryResults] = useState([]);
  const [searchingInventory, setSearchingInventory] = useState(false);

  // Close panel when modal closes
  useEffect(() => {
    if (!open) setActiveMaterialId(null);
  }, [open]);

  // ── Inventory toggle ──────────────────────────────────────────────────
  const toggleInventory = useCallback(
    async (order) => {
      const id = order.id;
      if (activeMaterialId === id) {
        // closing
        setActiveMaterialId(null);
        setInventoryResults([]);
        return;
      }
      setActiveMaterialId(id);
      setInventoryResults([]);
      if (onSearchInventory) {
        setSearchingInventory(true);
        try {
          const lots = await onSearchInventory(id, getOrderTitle(order));
          setInventoryResults(lots || []);
        } catch {
          setInventoryResults([]);
        }
        setSearchingInventory(false);
      }
    },
    [activeMaterialId, onSearchInventory],
  );

  const handleLotConfirm = useCallback(
    (lot) => {
      if (!activeMaterialId) return;
      setStockAssignments((prev) => ({
        ...prev,
        [activeMaterialId]: {
          lotId: lot.id,
          lotName: lot.name,
          location: lot.location,
          unitPrice: lot.unitPrice,
          qty: lot.selectedQty,
          available: lot.available,
        },
      }));
      setActiveMaterialId(null);
      setInventoryResults([]);
    },
    [activeMaterialId, setStockAssignments],
  );

  const removeStockAssignment = useCallback(
    (orderId) => {
      setStockAssignments((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    },
    [setStockAssignments],
  );

  // ── Derived totals ────────────────────────────────────────────────────
  const summaries = useMemo(
    () =>
      orders.map((order) => ({
        order,
        ...buildMaterialSummary(
          order,
          stockAssignments[order.id] || null,
          parseFloat(prices[order.id]) || 0,
          approvalForm.currency,
        ),
      })),
    [orders, stockAssignments, prices, approvalForm.currency],
  );

  const totalPurchase = useMemo(() => summaries.reduce((s, r) => s + r.purchaseTotal, 0), [summaries]);
  const totalStock = useMemo(() => summaries.reduce((s, r) => s + r.stockTotal, 0), [summaries]);
  const grandTotal = totalPurchase + totalStock;

  // ── IGV ───────────────────────────────────────────────────────────────
  const igv = approvalForm.igv_enabled ? totalPurchase * (approvalForm.igv_rate / 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────
  if (!open) return null;

  const showStockPanel = activeMaterialId !== null;
  const activeOrder = showStockPanel ? orders.find((o) => o.id === activeMaterialId) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* ─── Main Modal ─── */}
      <div
        className={`mt-8 flex max-h-[90vh] w-full flex-col rounded-lg border-2 border-gray-200 bg-white shadow-2xl transition-all duration-200 ${showStockPanel ? 'max-w-3xl mr-2' : 'max-w-3xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-900">
            <CheckCircleIcon className="size-5 text-primary" />
            Aprobar Orden de Compra
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* ── Facturación ── */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Datos de Facturación</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SupplierAutocomplete
                label="Proveedor"
                value={approvalForm.seller_name}
                onChange={(e) => setApprovalForm((p) => ({ ...p, seller_name: e.target.value }))}
                onSelect={(s) => setApprovalForm((p) => ({ ...p, seller_name: s.name, seller_document: s.document || p.seller_document }))}
                suggestions={suppliers?.suggestions || []}
                showSuggestions={suppliers?.showSuggestions || false}
                onSearch={suppliers?.searchSuppliers || (() => { })}
                onBlur={suppliers?.hideSuggestions || (() => { })}
                placeholder="Nombre o Razón Social"
              />
              <Input label="RUC / DNI" value={approvalForm.seller_document} onChange={(e) => setApprovalForm((p) => ({ ...p, seller_document: e.target.value }))} placeholder="20100055234" />
            </div>
          </div>

          {/* ── Materiales ── */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Precios por Material</h4>
            <div className="space-y-3">
              {summaries.map(({ order, purchaseQty, stockQty, stockLot, unitPrice, purchaseTotal, stockTotal }, idx) => {
                const totalQty = getOrderQtyNum(order);
                const unit = order.unit || 'UND';
                const hasStock = !!stockLot;
                const isActive = activeMaterialId === order.id;

                return (
                  <div key={order.id} className={`rounded-xl border bg-white transition-all ${hasStock || isActive ? 'border-primary/30' : 'border-gray-200'}`}>
                    {hasStock || isActive ? (
                      <>
                        {/* ── Expanded header (inventory mode) ── */}
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{getOrderTitle(order)}</p>
                              <p className="text-xs text-gray-500">Total Requerido: {totalQty} {unit}</p>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                            ¿Usar de Almacén?
                            <button
                              type="button"
                              role="switch"
                              aria-checked={hasStock || isActive}
                              onClick={() => toggleInventory(order)}
                              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${hasStock || isActive ? 'bg-primary' : 'bg-gray-200'}`}
                            >
                              <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${hasStock || isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                          </label>
                        </div>
                        {/* Expanded body */}
                        <div className="border-t border-gray-100 px-4 py-3">
                          <div className={`grid gap-4 ${hasStock ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                            {/* Purchase */}
                            <div>
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <CurrencyDollarIcon className="size-3.5" />
                                Compra Directa
                              </div>
                              <div className="flex flex-wrap items-start gap-3">
                                {hasStock && (
                                  <div>
                                    <span className="text-xs text-gray-500">Cantidad a Comprar</span>
                                    <div className="mt-0.5 flex items-center gap-1">
                                      <input type="number" value={purchaseQty} readOnly tabIndex={-1} className="w-20 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm text-gray-500 cursor-default" />
                                      <span className="text-xs text-gray-400">{unit}</span>
                                    </div>
                                    {/* reserved space to match price column height */}
                                    <p className="mt-0.5 text-xs invisible">–</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-xs text-gray-500">
                                    Precio Total{hasStock ? ` (${purchaseQty} ${unit})` : ` (${totalQty} ${unit})`} — {sym(approvalForm.currency)}
                                  </span>
                                  <div className="mt-0.5">
                                    <input
                                      value={prices[order.id] || ''}
                                      onChange={(e) => setPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                                      type="number" step="0.01" min="0"
                                      className="w-36 rounded border border-primary/40 px-2 py-1.5 text-right text-sm shadow-sm focus:border-primary focus:ring-primary"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <p className="mt-0.5 text-xs text-gray-400 min-h-[1rem]">
                                    {purchaseQty > 0 && purchaseTotal > 0 ? `Unitario: ${sym(approvalForm.currency)} ${formatNumber(unitPrice)}` : ''}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {/* Stock assigned */}
                            {hasStock && (
                              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                                    <ArchiveBoxIcon className="size-3.5" /> Stock Asignado
                                  </span>
                                  <button type="button" onClick={() => removeStockAssignment(order.id)} className="text-xs text-gray-400 hover:text-red-500">Quitar</button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{stockLot.lotName}</p>
                                    <p className="text-xs text-gray-500">Precio Stock: {sym(approvalForm.currency)} {formatNumber(stockLot.unitPrice)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-primary">{stockQty} {unit}</p>
                                    <p className="text-xs text-gray-500">Asignado</p>
                                  </div>
                                </div>
                                <button type="button" onClick={() => toggleInventory(order)} className="mt-2 w-full rounded border border-primary/30 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                                  <PencilSquareIcon className="mr-1 inline size-3.5" /> Modificar Asignación
                                </button>
                              </div>
                            )}
                            {/* Panel open but no lot confirmed yet */}
                            {!hasStock && isActive && (
                              <div className="flex items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-gray-400">
                                Seleccione un lote en el panel lateral →
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* ── Compact row (no inventory) ── */
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{getOrderTitle(order)}</p>
                          <p className="text-xs text-gray-400">{totalQty} {unit}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-gray-400 whitespace-nowrap">{sym(approvalForm.currency)}</span>
                          <input
                            value={prices[order.id] || ''}
                            onChange={(e) => setPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                            type="number" step="0.01" min="0"
                            className="w-32 rounded border border-primary/40 px-2 py-1.5 text-right text-sm shadow-sm focus:border-primary focus:ring-primary"
                            placeholder="0.00"
                          />
                        </div>
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                          <span className="hidden sm:inline">Almacén</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={false}
                            onClick={() => toggleInventory(order)}
                            className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200"
                          >
                            <span className="pointer-events-none inline-block size-4 rounded-full bg-white shadow ring-0 translate-x-0 transition-transform duration-200" />
                          </button>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Payment details ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label="Tipo de Pago" value={approvalForm.payment_type} onChange={(e) => setApprovalForm((p) => ({ ...p, payment_type: e.target.value }))} placeholder="">
              <option value="cash">Pago Directo</option>
              <option value="loan">Pago a Crédito</option>
            </Select>
            <Select label="Moneda" value={approvalForm.currency} onChange={(e) => { const v = e.target.value; setApprovalForm((p) => ({ ...p, currency: v })); onCurrencyChange?.(v); }} placeholder="">
              <option value="PEN">PEN - Soles</option>
              <option value="USD">USD - Dólares</option>
            </Select>
            <Input label="Fecha Emisión" type="date" value={approvalForm.issue_date} onChange={(e) => setApprovalForm((p) => ({ ...p, issue_date: e.target.value }))} />
          </div>

          {approvalForm.payment_type === 'loan' && (
            <Input label="Fecha Vencimiento" type="date" value={approvalForm.due_date} onChange={(e) => setApprovalForm((p) => ({ ...p, due_date: e.target.value }))} className="max-w-xs" />
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={approvalForm.igv_enabled} onChange={(e) => setApprovalForm((p) => ({ ...p, igv_enabled: e.target.checked }))} className="rounded border-gray-300 text-primary focus:ring-primary" />
              Aplicar IGV
            </label>
            {approvalForm.igv_enabled && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number" step="0.01" min="0"
                  value={approvalForm.igv_rate || ''}
                  onChange={(e) => setApprovalForm((p) => ({ ...p, igv_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="18"
                  className="w-20 rounded border border-gray-300 px-2 py-1.5 text-right text-sm shadow-sm focus:border-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {approvalForm.currency === 'USD' && (
            <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
              {loadingRate ? 'Obteniendo tipo de cambio...' : currentExchangeRate > 0 ? `T.C: 1 USD = S/ ${currentExchangeRate.toFixed(4)}` : <span className="text-red-600">No se pudo obtener tipo de cambio</span>}
            </div>
          )}

          {/* ── Totals ── */}
          <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Costo Compra Directa</span>
              <span className="font-medium text-gray-900">{sym(approvalForm.currency)} {formatNumber(totalPurchase)}</span>
            </div>
            {totalStock > 0 && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-primary">
                  <ArchiveBoxIcon className="size-3.5" /> Costo Almacén (Interno)
                </span>
                <span className="font-medium text-primary">{sym(approvalForm.currency)} {formatNumber(totalStock)}</span>
              </div>
            )}
            {approvalForm.igv_enabled && totalPurchase > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>IGV ({approvalForm.igv_rate}%)</span>
                <span>{sym(approvalForm.currency)} {formatNumber(igv)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="text-base font-bold text-gray-900">Gasto Real Total</span>
              <span className="text-lg font-bold text-gray-900">{sym(approvalForm.currency)} {formatNumber(grandTotal + igv)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="danger" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={onSubmit} disabled={!canSubmit || submitting} loading={submitting}>
            {submitting ? 'Procesando...' : `Enviar ${orders.length} a Por Pagar`}
          </Button>
        </div>
      </div>

      {/* ─── Stock Lot Panel (lateral) ─── */}
      {showStockPanel && (
        <div onClick={(e) => e.stopPropagation()}>
          <StockLotPanel
            order={activeOrder}
            lots={inventoryResults}
            loading={searchingInventory}
            maxQty={getOrderQtyNum(activeOrder)}
            currentAssignment={stockAssignments[activeMaterialId] || null}
            onConfirm={handleLotConfirm}
            onClose={() => { setActiveMaterialId(null); setInventoryResults([]); }}
            currency={approvalForm.currency}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
