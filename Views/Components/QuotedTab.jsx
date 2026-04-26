/**
 * @file Contenido del tab "Por Aprobar" (cotizaciones pendientes de aprobación gerencial)
 * @module compraskrsft/components/QuotedTab
 */
import {
  ChevronDownIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Badge from './ui/Badge';
import Button from './ui/Button';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { getProjectColor, formatProjectDisplay, getOrderTitle, getOrderQty, getOrderQtyNum, formatDate, formatNumber } from '../utils';

/**
 * @param {{
 *   loading: boolean,
 *   quotedBatches: Array,
 *   expandedQuotedBatches: Object,
 *   toggleBatchExpanded: Function,
 *   approvingBatchId: string|null,
 *   rejectingBatchId: string|null,
 *   approveBatch: Function,
 *   rejectBatch: Function,
 * }} props
 */
export default function QuotedTab({
  loading,
  quotedBatches,
  expandedQuotedBatches,
  toggleBatchExpanded,
  approvingBatchId,
  rejectingBatchId,
  approveBatch,
  rejectBatch,
}) {
  if (loading) return <LoadingSpinner />;

  if (quotedBatches.length === 0) {
    return (
      <EmptyState
        title="No hay cotizaciones pendientes de aprobación"
        subtitle="Las cotizaciones aparecerán aquí una vez que el cotizador complete los precios y proveedor"
      />
    );
  }

  return (
    <div className="space-y-3">
      {quotedBatches.map((batch) => {
        const isApproving = approvingBatchId === batch.batch_id;
        const isRejecting = rejectingBatchId === batch.batch_id;
        const busy = isApproving || isRejecting;

        return (
          <div
            key={batch.batch_id}
            className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Batch Header */}
            <button
              onClick={() => toggleBatchExpanded(batch.batch_id)}
              className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${
                  expandedQuotedBatches[batch.batch_id] ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <ChevronDownIcon
                className={`size-4 shrink-0 text-gray-400 transition-transform ${
                  expandedQuotedBatches[batch.batch_id] ? 'rotate-180' : ''
                }`}
              />
              <span className="font-mono text-xs text-gray-400">{batch.batch_id}</span>
              <span className="font-medium text-gray-700 truncate">Proveedor: {batch.seller_name}</span>
              <Badge variant="gray">{batch.orders.length} items</Badge>
              {batch.payment_type === 'loan'
                ? <Badge variant="purple">CRÉDITO</Badge>
                : <Badge variant="emerald">CONTADO</Badge>
              }
              <Badge variant={batch.currency === 'PEN' ? 'blue' : 'red'}>{batch.currency}</Badge>
              {batch.igv_enabled && <Badge variant="cyan">+IGV</Badge>}
              <span className="ml-auto font-semibold text-gray-900">
                {batch.currency} {formatNumber(batch.total_with_igv || 0)}
              </span>
            </button>

            {/* Expanded Content */}
            {expandedQuotedBatches[batch.batch_id] && (
              <div className="border-t border-gray-100">
                {/* Meta */}
                <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-gray-500">
                  {batch.approved_by_name && <span>Cotizado por: {batch.approved_by_name}</span>}
                  {batch.approved_at && <span>Enviado {formatDate(batch.approved_at)}</span>}
                  {batch.issue_date && <span>Emisión {formatDate(batch.issue_date)}</span>}
                  {batch.due_date && (
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="size-3" />
                      Vence {formatDate(batch.due_date)}
                    </span>
                  )}
                </div>

                {/* Order rows */}
                <div className="divide-y divide-gray-50 px-4">
                  {batch.orders.map((order) => {
                    const amount = order.amount_with_igv || order.amount || 0;
                    const qty = getOrderQty(order);
                    const qtyNum = getOrderQtyNum(order);
                    const unitPrice = qtyNum > 0 ? amount / qtyNum : 0;
                    return (
                      <div key={order.id} className="flex items-center gap-3 py-2 text-sm">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white shrink-0"
                          style={{ background: getProjectColor(order.project_id) }}
                        >
                          {formatProjectDisplay(order)}
                        </span>
                        <span className="flex-1 truncate text-gray-700">{getOrderTitle(order)}</span>
                        {qty !== '-' && qty > 0 && (
                          <span className="text-gray-500 shrink-0">Cant: {qty}</span>
                        )}
                        {amount > 0 && qtyNum > 0 && (
                          <span className="text-gray-600 shrink-0">P.Unit: {batch.currency} {formatNumber(unitPrice)}</span>
                        )}
                        {amount > 0 && (
                          <span className="font-medium text-gray-900 shrink-0">
                            {batch.currency} {formatNumber(amount)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer: Total + Action buttons */}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">
                    Total: {batch.currency} {formatNumber(batch.total_with_igv || 0)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      loading={isRejecting}
                      onClick={(e) => { e.stopPropagation(); rejectBatch(batch); }}
                      className="gap-1.5"
                    >
                      <XMarkIcon className="size-4" />
                      RECHAZAR
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      loading={isApproving}
                      onClick={(e) => { e.stopPropagation(); approveBatch(batch); }}
                      className="gap-1.5"
                    >
                      <CheckIcon className="size-4" />
                      APROBAR
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

