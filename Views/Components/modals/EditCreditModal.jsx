/**
 * @file Modal para extender el plazo de crédito de un lote
 * @module compraskrsft/components/modals/EditCreditModal
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, PencilSquareIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import { formatDate, getLocalDateString } from '../../utils';

/**
 * Modal que permite cambiar la fecha de vencimiento de un lote de crédito.
 * Solo se muestra para lotes con payment_type === 'loan'.
 *
 * @param {{
 *   batch: Object,
 *   onClose: Function,
 *   onConfirm: Function,
 *   saving: boolean,
 * }} props
 */
export default function EditCreditModal({ batch, onClose, onConfirm, saving }) {
  const [newDueDate, setNewDueDate] = useState(batch?.due_date ?? '');

  if (!batch) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDueDate) return;
    onConfirm(batch.batch_id, newDueDate);
  };

  const today = getLocalDateString();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PencilSquareIcon className="size-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Editar Plazo de Crédito</h2>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Info del lote */}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1">
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">Lote:</span>{' '}
              <span className="font-mono text-xs">{batch.batch_id}</span>
            </p>
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">Proveedor:</span> {batch.seller_name}
            </p>
            {batch.issue_date && (
              <p className="text-gray-500">
                <span className="font-medium text-gray-700">Emisión:</span>{' '}
                {formatDate(batch.issue_date)}
              </p>
            )}
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">Vencimiento actual:</span>{' '}
              <span className="font-semibold text-amber-600">{formatDate(batch.due_date)}</span>
            </p>
          </div>

          {/* Nuevo vencimiento */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <CalendarDaysIcon className="size-4 text-blue-500" />
              Nueva fecha de vencimiento
            </label>
            <input
              type="date"
              value={newDueDate}
              min={today}
              onChange={(e) => setNewDueDate(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Solo se puede extender el plazo, no reducirlo.
            </p>
          </div>

          {/* Aviso */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            <strong>Nota:</strong> Se registrará tu nombre y la fecha del cambio en el historial del lote.
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="danger" type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving || !newDueDate || newDueDate === batch.due_date}
              loading={saving}
              className="gap-2"
            >
              <PencilSquareIcon className="size-4" />
              {saving ? 'Guardando...' : 'Guardar cambio'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
