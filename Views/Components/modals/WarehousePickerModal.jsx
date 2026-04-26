/**
 * @file Modal de Selección Mixta: Inventario + Compra Nueva.
 *
 * Permite al usuario:
 * 1. Buscar materiales disponibles en almacén (estado "Disponible")
 * 2. Seleccionar un item y definir cuántas unidades tomar del stock
 * 3. Ver cálculo automático:
 *    - Costo de las unidades de almacén (precio unitario histórico × cantidad)
 *    - Cantidad restante que requiere compra nueva
 *    - Input para ingresar precio de la compra externa
 * 4. Confirmar la selección mixta
 *
 * @module compraskrsft/components/modals/WarehousePickerModal
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArchiveBoxIcon,
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatNumber } from '../../utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const sym = (c) => (c === 'USD' ? '$' : 'S/');

function getOrderQtyNum(order) {
  const materials = Array.isArray(order.materials)
    ? order.materials
    : typeof order.materials === 'string'
    ? (() => { try { return JSON.parse(order.materials); } catch { return []; } })()
    : [];
  if (materials.length > 0) {
    return materials.reduce((s, m) => s + (parseInt(m.qty, 10) || 1), 0);
  }
  return 1;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * @param {{
 *   open: boolean,
 *   onClose: Function,
 *   order: Object,                    — La orden de compra para la que se selecciona stock
 *   currency: string,                 — 'PEN' | 'USD'
 *   onConfirm: (result: Object) => void,  — Callback con el resultado de la selección
 *   searchStock: (search: string, projectId?: number) => Promise<Array>,
 *   previewMixed: (orderId, itemId, qty) => Promise<Object>,
 * }} props
 */
export default function WarehousePickerModal({
  open,
  onClose,
  order,
  currency = 'PEN',
  onConfirm,
  searchStock,
  previewMixed,
}) {
  // ── States ──────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [stockItems, setStockItems] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [qtyFromStock, setQtyFromStock] = useState(0);
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const totalRequired = useMemo(() => (order ? getOrderQtyNum(order) : 0), [order]);
  const unit = order?.unit || 'UND';

  // Reset on open/close
  useEffect(() => {
    if (open && order) {
      setSearchText(order.description || '');
      setStockItems([]);
      setSelectedItemId(null);
      setQtyFromStock(0);
      setNewPurchasePrice('');
      setPreview(null);
    }
  }, [open, order]);

  // Auto-search when modal opens
  useEffect(() => {
    if (open && searchText.length >= 2) {
      handleSearch();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchStock || searchText.length < 2) return;
    setSearching(true);
    try {
      const items = await searchStock(searchText, order?.project_id);
      setStockItems(items || []);
    } catch {
      setStockItems([]);
    }
    setSearching(false);
  }, [searchStock, searchText, order?.project_id]);

  // ── Select item ───────────────────────────────────────────────────
  const selectedItem = useMemo(
    () => stockItems.find((i) => i.id === selectedItemId) || null,
    [stockItems, selectedItemId],
  );

  const maxFromStock = useMemo(
    () => (selectedItem ? Math.min(totalRequired, selectedItem.available) : 0),
    [selectedItem, totalRequired],
  );

  const qtyToBuy = useMemo(
    () => Math.max(0, totalRequired - qtyFromStock),
    [totalRequired, qtyFromStock],
  );

  const stockCost = useMemo(
    () => (selectedItem ? round2(qtyFromStock * (selectedItem.unitPrice || 0)) : 0),
    [selectedItem, qtyFromStock],
  );

  const purchaseUnitPrice = useMemo(() => {
    const price = parseFloat(newPurchasePrice) || 0;
    return qtyToBuy > 0 ? round2(price / qtyToBuy) : 0;
  }, [newPurchasePrice, qtyToBuy]);

  const grandTotal = useMemo(
    () => round2(stockCost + (parseFloat(newPurchasePrice) || 0)),
    [stockCost, newPurchasePrice],
  );

  // ── Item selection handler ────────────────────────────────────────
  const handleSelectItem = useCallback(
    (item) => {
      setSelectedItemId(item.id);
      // Auto-fill: use as much stock as possible
      const autoQty = Math.min(totalRequired, item.available);
      setQtyFromStock(autoQty);
      setNewPurchasePrice('');
      setPreview(null);
    },
    [totalRequired],
  );

  // ── Preview (optional server-side validation) ─────────────────────
  const handlePreview = useCallback(async () => {
    if (!previewMixed || !selectedItemId || qtyFromStock <= 0) return;
    setLoadingPreview(true);
    try {
      const result = await previewMixed(order.id, selectedItemId, qtyFromStock);
      setPreview(result);
    } catch {
      setPreview(null);
    }
    setLoadingPreview(false);
  }, [previewMixed, order?.id, selectedItemId, qtyFromStock]);

  // Trigger preview on qty change (debounced via effect)
  useEffect(() => {
    if (!selectedItemId || qtyFromStock <= 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(handlePreview, 400);
    return () => clearTimeout(timer);
  }, [selectedItemId, qtyFromStock]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirm ───────────────────────────────────────────────────────
  const canConfirm = useMemo(() => {
    if (!selectedItem || qtyFromStock <= 0) return false;
    // If there are items to buy, require a purchase price
    if (qtyToBuy > 0 && (parseFloat(newPurchasePrice) || 0) <= 0) return false;
    return true;
  }, [selectedItem, qtyFromStock, qtyToBuy, newPurchasePrice]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !selectedItem) return;
    onConfirm({
      orderId: order.id,
      inventoryItemId: selectedItem.id,
      lotName: selectedItem.name,
      location: selectedItem.location,
      // Stock portion
      qtyFromStock,
      stockUnitPrice: selectedItem.unitPrice,
      stockCost,
      stockCurrency: selectedItem.currency,
      // Purchase portion
      qtyToBuy,
      newPurchasePrice: parseFloat(newPurchasePrice) || 0,
      purchaseUnitPrice,
      // Totals
      totalRequired,
      grandTotal,
    });
  }, [
    canConfirm, selectedItem, order, qtyFromStock, stockCost,
    qtyToBuy, newPurchasePrice, purchaseUnitPrice, totalRequired, grandTotal, onConfirm,
  ]);

  // ── Render ────────────────────────────────────────────────────────
  if (!open || !order) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg border-2 border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-900">
            <ArchiveBoxIcon className="size-5 text-primary" />
            Elegir de Almacén
          </h2>
        </div>

        {/* ── Order info ── */}
        <div className="shrink-0 border-b border-gray-50 bg-gray-50/60 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{order.description}</p>
              <p className="text-xs text-gray-500">
                Cantidad requerida: <span className="font-medium">{totalRequired} {unit}</span>
              </p>
            </div>
            <Badge variant="solid" color="primary" size="sm">Ítem #{order.item_number}</Badge>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ──── Left: Search & Select Stock ──── */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <MagnifyingGlassIcon className="size-4" />
                Buscar en Almacén
              </h4>

              {/* Search bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nombre, SKU, tipo de material..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                />
                <Button variant="secondary" size="sm" onClick={handleSearch} loading={searching}>
                  Buscar
                </Button>
              </div>

              {/* Results list */}
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {searching && (
                  <div className="flex items-center justify-center py-6">
                    <ArrowPathIcon className="size-5 animate-spin text-primary" />
                  </div>
                )}

                {!searching && stockItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                    {searchText.length >= 2
                      ? 'No se encontraron materiales disponibles'
                      : 'Ingrese un término de búsqueda'}
                  </div>
                )}

                {!searching &&
                  stockItems.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-100 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex size-4 items-center justify-center rounded-full border-2 ${
                                isSelected ? 'border-primary' : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <span className="size-2 rounded-full bg-primary" />}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">
                                SKU: {item.sku} {item.location ? `• ${item.location}` : ''}
                              </p>
                            </div>
                          </div>
                          {item.available >= 500 && (
                            <Badge variant="solid" color="primary" size="xs">STOCK ALTO</Badge>
                          )}
                          {item.available <= 10 && item.available > 0 && (
                            <Badge variant="solid" color="amber" size="xs">REMANENTE</Badge>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-gray-400">Precio Unitario</p>
                            <p className="text-sm font-medium text-gray-700">
                              {sym(item.currency)} {formatNumber(item.unitPrice || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Disponible</p>
                            <p className="text-sm font-medium text-gray-700">
                              {item.available} {item.unit || 'UND'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* ──── Right: Quantity Split & Costs ──── */}
            <div className="space-y-4">
              {!selectedItem ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 p-8">
                  <p className="text-center text-sm text-gray-400">
                    Seleccione un material de almacén para continuar
                  </p>
                </div>
              ) : (
                <>
                  {/* Selected item banner */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <p className="text-sm font-semibold text-primary">{selectedItem.name}</p>
                    <p className="text-xs text-gray-600">
                      Precio Histórico: {sym(selectedItem.currency)} {formatNumber(selectedItem.unitPrice)} / {unit}
                    </p>
                  </div>

                  {/* Quantity from stock */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Cantidad a tomar del almacén <span className="text-gray-400">(máx: {maxFromStock})</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={maxFromStock}
                      value={qtyFromStock}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(maxFromStock, parseInt(e.target.value, 10) || 0));
                        setQtyFromStock(v);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium focus:border-primary focus:ring-primary"
                    />
                  </div>

                  {/* ── Split Visualization ── */}
                  <div className="space-y-3">
                    {/* Stock portion */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                        <ArchiveBoxIcon className="size-3.5" />
                        Desde Almacén
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-gray-900">{qtyFromStock} {unit}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            × {sym(selectedItem.currency)} {formatNumber(selectedItem.unitPrice)}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-primary">
                          {sym(selectedItem.currency)} {formatNumber(stockCost)}
                        </span>
                      </div>
                    </div>

                    {/* Purchase portion */}
                    {qtyToBuy > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                          <ShoppingCartIcon className="size-3.5" />
                          Compra Nueva ({qtyToBuy} {unit} restantes)
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-600">Precio Total de Compra ({sym(currency)})</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newPurchasePrice}
                              onChange={(e) => setNewPurchasePrice(e.target.value)}
                              placeholder="0.00"
                              className="mt-0.5 w-full rounded border border-amber-300 bg-white px-3 py-1.5 text-right text-sm font-medium focus:border-primary focus:ring-primary"
                            />
                          </div>
                          {purchaseUnitPrice > 0 && (
                            <p className="text-xs text-gray-500">
                              Precio unitario proveedor: {sym(currency)} {formatNumber(purchaseUnitPrice)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* No purchase needed */}
                    {qtyToBuy === 0 && qtyFromStock > 0 && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                        <CheckCircleIcon className="size-4" />
                        Totalmente cubierto con stock de almacén
                      </div>
                    )}
                  </div>

                  {/* ── Grand Total ── */}
                  {qtyFromStock > 0 && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Costo Almacén ({qtyFromStock} {unit})</span>
                          <span className="font-medium text-primary">{sym(selectedItem.currency)} {formatNumber(stockCost)}</span>
                        </div>
                        {qtyToBuy > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Costo Compra ({qtyToBuy} {unit})</span>
                            <span className="font-medium text-amber-700">{sym(currency)} {formatNumber(parseFloat(newPurchasePrice) || 0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-200 pt-2">
                          <span className="text-base font-bold text-gray-900">Costo Total</span>
                          <span className="text-lg font-bold text-gray-900">{sym(currency)} {formatNumber(grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info note */}
                  {preview?.success === false && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
                      {preview.message}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <div className="text-xs text-gray-500">
            {selectedItem && qtyFromStock > 0 && (
              <span>
                {qtyFromStock} de almacén + {qtyToBuy} por comprar = {totalRequired} total
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {qtyToBuy > 0
                ? `Confirmar Split (${qtyFromStock} + ${qtyToBuy})`
                : `Usar ${qtyFromStock} de Almacén`}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Utility ─────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100;
}
