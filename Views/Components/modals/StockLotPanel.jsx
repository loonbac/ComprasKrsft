/**
 * @file Panel lateral para seleccionar un lote de stock (inventario).
 *
 * Se muestra a la derecha del ApprovalOrderModal cuando el usuario
 * activa el toggle "¿Usar de Almacén?" en un material.
 *
 * Cada lote muestra:
 *  - Nombre, ubicación, badge de estado (STOCK ALTO, REMANENTE, POR VENCER)
 *  - Precio unitario y disponibilidad
 *  - Input de cantidad a usar y costo calculado
 *
 * @module compraskrsft/components/modals/StockLotPanel
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ArchiveBoxIcon,
  FaceFrownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatNumber, roundMoney } from '../../utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const sym = (c) => (c === 'USD' ? '$' : 'S/');

/**
 * Returns a badge variant & label based on stock level or expiration.
 */
function getLotBadge(lot) {
  if (lot.expiringSoon) return { label: 'POR VENCER', color: 'warning' };
  if (lot.available <= 10) return { label: 'REMANENTE', color: 'amber' };
  if (lot.available >= 500) return { label: 'STOCK ALTO', color: 'primary' };
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StockLotPanel({
  order,
  lots,
  loading,
  maxQty,
  currentAssignment,
  onConfirm,
  onClose,
  currency = 'PEN',
}) {
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [qty, setQty] = useState(0);

  // Pre-select current assignment if exists
  useEffect(() => {
    if (currentAssignment) {
      setSelectedLotId(currentAssignment.lotId);
      setQty(currentAssignment.qty);
    } else {
      setSelectedLotId(null);
      setQty(0);
    }
  }, [currentAssignment]);

  const selectedLot = useMemo(
    () => lots.find((l) => l.id === selectedLotId) || null,
    [lots, selectedLotId],
  );

  const effectiveMax = useMemo(
    () => (selectedLot ? Math.min(maxQty, selectedLot.available) : maxQty),
    [maxQty, selectedLot],
  );

  const computedCost = useMemo(
    () => (selectedLot ? roundMoney(qty * (selectedLot.unitPrice || 0)) : 0),
    [selectedLot, qty],
  );

  const handleSelectLot = (lot) => {
    setSelectedLotId(lot.id);
    // Auto-fill qty to min(maxQty, available) for convenience
    setQty(Math.min(maxQty, lot.available));
  };

  const handleConfirm = () => {
    if (!selectedLot || qty <= 0) return;
    onConfirm({
      id: selectedLot.id,
      name: selectedLot.name,
      location: selectedLot.location,
      unitPrice: selectedLot.unitPrice,
      available: selectedLot.available,
      selectedQty: qty,
    });
  };

  return (
    <div className="mt-8 flex max-h-[90vh] w-80 flex-col rounded-lg border-2 border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-gray-100 px-4 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ArchiveBoxIcon className="size-4 text-primary" />
          Seleccionar Lote de Stock
        </h3>
      </div>

      {/* Subtitle */}
      <div className="border-b border-gray-50 px-4 py-2">
        <p className="text-xs text-gray-500">Seleccione un lote para asignar material</p>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="size-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && lots.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 py-10">
            {/* Sad face icon */}
            <FaceFrownIcon className="mb-3 size-12 text-gray-300" />
            <p className="text-center text-sm font-medium text-gray-500">
              No hay materiales en almacén
            </p>
            <p className="mt-1.5 text-center text-[11px] leading-snug text-gray-400">
              Solo aparecerán materiales de proyectos terminados con stock liberado o registrados manualmente sin proyecto asociado.
            </p>
          </div>
        )}

        {!loading &&
          lots.map((lot) => {
            const badge = getLotBadge(lot);
            const isSelected = selectedLotId === lot.id;

            return (
              <div
                key={lot.id}
                onClick={() => handleSelectLot(lot)}
                className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'}`}
              >
                {/* Lot header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Radio indicator */}
                    <span className={`flex size-4 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary' : 'border-gray-300'}`}>
                      {isSelected && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{lot.name || '—'}</p>
                      {lot.especificacion && (
                        <p className="text-xs text-primary/80 font-medium">{lot.especificacion}</p>
                      )}
                      <p className="text-xs text-gray-500">Ubicación: {lot.location || 'N/A'}</p>
                    </div>
                  </div>
                  {badge && <Badge variant="solid" color={badge.color} size="xs">{badge.label}</Badge>}
                </div>

                {/* Lot info */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400">Precio Unit.</p>
                    <p className="text-sm font-medium text-gray-700">{sym(currency)} {formatNumber(lot.unitPrice || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Disp.</p>
                    <p className="text-sm font-medium text-gray-700">{lot.available}</p>
                  </div>
                </div>

                {/* Qty input — only when selected */}
                {isSelected && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-1 text-xs font-semibold text-gray-700">Cantidad a usar:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={effectiveMax}
                        value={qty}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(effectiveMax, parseInt(e.target.value, 10) || 0));
                          setQty(v);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 rounded border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-primary focus:ring-primary"
                      />
                      <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        = {sym(currency)} {formatNumber(computedCost)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 p-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={!selectedLot || qty <= 0}
        >
          Confirmar Selección
        </Button>
      </div>
    </div>
  );
}
