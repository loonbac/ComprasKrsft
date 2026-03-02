/**
 * @file Contenido del tab "Pagadas"
 * @module compraskrsft/components/PaidTab
 */
import {
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './EmptyState';
import {
  getProjectColor,
  getOrderTitle,
  getOrderQty,
  batchAllDelivered,
  batchMissingComprobante,
  formatNumber,
  formatDate,
} from '../utils';

/**
 * @param {{
 *   paidBatches: Array,
 *   filteredPaidBatches: Array,
 *   expandedPaidBatches: Object,
 *   paidFilterStartDate: string, setPaidFilterStartDate: Function,
 *   paidFilterEndDate: string, setPaidFilterEndDate: Function,
 *   resetPaidFilter: Function,
 *   openExportModal: Function,
 *   togglePaidBatchExpanded: Function,
 *   openEditComprobante: Function,
 * }} props
 */
export default function PaidTab({
  paidBatches,
  filteredPaidBatches,
  expandedPaidBatches,
  paidFilterStartDate, setPaidFilterStartDate,
  paidFilterEndDate, setPaidFilterEndDate,
  resetPaidFilter,
  openExportModal,
  togglePaidBatchExpanded,
  openEditComprobante,
}) {
  return (
    <>
      {/* Date filter bar */}
      {paidBatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-gray-500">Desde:</span>
          <input value={paidFilterStartDate} onChange={(e) => setPaidFilterStartDate(e.target.value)} type="date" className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm" />
          <span className="text-sm text-gray-500">Hasta:</span>
          <input value={paidFilterEndDate} onChange={(e) => setPaidFilterEndDate(e.target.value)} type="date" className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm" />
          {(paidFilterStartDate || paidFilterEndDate) && (
            <Button variant="ghost" size="sm" onClick={resetPaidFilter}>Limpiar</Button>
          )}
          <Button variant="success" size="sm" onClick={openExportModal} className="ml-auto gap-2">
            <ArrowDownTrayIcon className="size-4" />
            Exportar Registro
          </Button>
        </div>
      )}

      {/* Content */}
      {paidBatches.length === 0 ? (
        <EmptyState
          title="No hay compras pagadas"
          subtitle="Las compras con pago confirmado aparecerán aquí"
        />
      ) : (
        <div className="space-y-3">
          {filteredPaidBatches.map((batch) => (
            <div key={batch.batch_id} className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              {/* Header */}
              <button
                onClick={() => togglePaidBatchExpanded(batch.batch_id)}
                className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${expandedPaidBatches[batch.batch_id] ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
              >
                <ChevronDownIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${expandedPaidBatches[batch.batch_id] ? 'rotate-180' : ''}`} />
                <span className="font-mono text-xs text-gray-400">{batch.batch_id}</span>
                <span className="font-medium text-gray-700 truncate">{batch.seller_name}</span>
                {batchAllDelivered(batch)
                  ? <Badge variant="emerald" dot>Entregado</Badge>
                  : <Badge variant="blue" dot>Pagado</Badge>
                }
                {batchMissingComprobante(batch) && (
                  <Badge variant="warning">
                    <ExclamationTriangleIcon className="mr-1 size-4" />
                    Sin comprobante
                  </Badge>
                )}
                <Badge variant="gray">{batch.orders.length} items</Badge>
                <span className="ml-auto font-semibold text-gray-900">{batch.currency} {formatNumber(batch.total)}</span>
                {!batchMissingComprobante(batch) && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); openEditComprobante(batch); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); openEditComprobante(batch); } }}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
                    title="Editar Comprobante"
                  >
                    <PencilSquareIcon className="size-4" />
                  </span>
                )}
              </button>

              {/* Expanded */}
              {expandedPaidBatches[batch.batch_id] && (() => {
                const inventoryOrders = batch.orders.filter(o => o.source_type === 'inventory');
                const totalStockCost = inventoryOrders.reduce((s, o) => {
                  const qty = typeof o.materials === 'object' && o.materials?.length > 0
                    ? (o.materials[0]?.qty || 1)
                    : 1;
                  return s + ((o.reference_price || 0) * qty);
                }, 0);

                return (
                  <div className="border-t border-gray-100">
                    <div className="flex flex-wrap gap-2 px-4 py-2 text-xs">
                      <span className="text-gray-500">Pagado {formatDate(batch.payment_confirmed_at)}</span>
                      {batch.issue_date && <span className="text-gray-500">Emisión {formatDate(batch.issue_date)}</span>}
                      <Badge variant={batch.currency === 'PEN' ? 'blue' : 'amber'}>{batch.currency}</Badge>
                      <Badge variant={batch.payment_type === 'cash' ? 'emerald' : 'purple'}>
                        {batch.payment_type === 'cash' ? 'Contado' : 'Crédito'}
                      </Badge>
                      {batch.igv_enabled ? <Badge variant="cyan">Con IGV</Badge> : <Badge variant="gray">Sin IGV</Badge>}
                      {batch.approved_by_name && <span className="text-gray-400">Aprobado por: {batch.approved_by_name}</span>}
                      {batch.payment_confirmed_by_name && <span className="text-gray-400">Pagado por: {batch.payment_confirmed_by_name}</span>}
                    </div>

                    <div className="divide-y divide-gray-50 px-4">
                      {batch.orders.map((order) => {
                        const isFromInventory = order.source_type === 'inventory';
                        const refPrice = order.reference_price || 0;
                        const orderQty = getOrderQty(order);
                        const stockCost = isFromInventory && orderQty > 0 ? (refPrice * orderQty) : 0;

                        return (
                          <div key={order.id} className={`flex items-center gap-3 py-2 text-sm ${isFromInventory ? 'bg-primary-50/30' : ''}`}>
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: getProjectColor(order.project_id) }}>{order.project_name}</span>
                            <span className="flex-1 truncate text-gray-700">{getOrderTitle(order)}</span>
                            {isFromInventory && (
                              <Badge variant="cyan">De Almacén</Badge>
                            )}
                            <span className="text-gray-500">Cant: {orderQty}</span>
                            {isFromInventory ? (
                              stockCost > 0 ? (
                                <span className="font-medium text-primary-700">
                                  Costo Ref: {order.currency || batch.currency} {formatNumber(stockCost)}
                                </span>
                              ) : null
                            ) : (
                              order.amount > 0 ? (
                                <span className="font-medium text-gray-900">{order.currency || batch.currency} {formatNumber(order.amount)}</span>
                              ) : null
                            )}
                            {!!order.delivery_confirmed && <Badge variant="emerald">Entregado</Badge>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumen de costos de almacén */}
                    {totalStockCost > 0 && (
                      <div className="flex items-center justify-between border-t border-primary-100 bg-primary-50/30 px-4 py-2">
                        <span className="text-sm text-primary-700 font-medium">
                          Material de Almacén (costo interno)
                        </span>
                        <span className="text-sm font-semibold text-primary-700">
                          {batch.currency} {formatNumber(totalStockCost)}
                        </span>
                      </div>
                    )}

                    {/* Comprobante details */}
                    <div className="border-t border-gray-100 px-4 py-3">
                      {batchMissingComprobante(batch) && (
                        <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <ExclamationTriangleIcon className="size-5 text-amber-500 shrink-0" />
                          <span className="flex-1 text-sm text-amber-700">Faltan datos del comprobante de pago</span>
                          <Button variant="warning" size="sm" onClick={(e) => { e.stopPropagation(); openEditComprobante(batch); }} className="gap-1.5">
                            <PencilSquareIcon className="size-3.5" />
                            Completar
                          </Button>
                        </div>
                      )}
                      {(batch.cdp_type || batch.cdp_serie) && (
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-500">Comprobante:</span>
                          <span className="text-gray-700">{batch.cdp_type} {batch.cdp_serie}-{batch.cdp_number}</span>
                        </div>
                      )}
                      {batch.payment_proof_link && (
                        <div className="flex gap-4 text-sm mt-1">
                          <span className="text-gray-500">Link Factura:</span>
                          <a href={batch.payment_proof_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline">{batch.payment_proof_link}</a>
                        </div>
                      )}
                      {batch.payment_proof && (
                        <div className="flex gap-4 text-sm mt-1">
                          <span className="text-gray-500">Archivo:</span>
                          <a href={`/storage/${batch.payment_proof}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline">Descargar</a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
