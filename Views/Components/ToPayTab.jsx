/**
 * @file Contenido del tab "Por Pagar"
 * @module compraskrsft/components/ToPayTab
 */
import {
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
  ClockIcon,
  PencilSquareIcon,
  ArrowUturnLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import {
  getProjectColor,
  formatProjectDisplay,
  getOrderTitle,
  getOrderQty,
  getOrderQtyNum,
  getPaymentAlertStatus,
  getAlertLabel,
  formatNumber,
  formatDate,
} from '../utils';

/**
 * Checkbox que soporta el estado indeterminate correctamente mediante ref.
 * En React, `indeterminate` no es un atributo HTML estándar y debe
 * asignarse imperativamente sobre el elemento DOM.
 */
function IndeterminateCheckbox({ checked, indeterminate, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      className={className}
      {...props}
    />
  );
}

/**
 * @param {{
 *   loading: boolean,
 *   toPaySearch: string, setToPaySearch: Function,
 *   toPayFilterProject: string, setToPayFilterProject: Function,
 *   toPayFilterCurrency: string, setToPayFilterCurrency: Function,
 *   toPayFilterPaymentType: string, setToPayFilterPaymentType: Function,
 *   toPayFilterIgv: string, setToPayFilterIgv: Function,
 *   toPayFilterAlert: string, setToPayFilterAlert: Function,
 *   toPayProjects: Array,
 *   filteredToPayBatches: Array,
 *   expandedToPayBatches: Object,
 *   toggleToPayBatchExpanded: Function,
 *   openPaymentModal: Function,
 *   onOpenQuickPay: Function,
 *   onOpenEditCredit: Function,
 *   selectedOrders: Array,
 *   toggleOrderSelect: Function,
 *   openBulkModal: Function,
 *   openReturnModal: Function,
 * }} props
 */
export default function ToPayTab({
  loading,
  toPaySearch, setToPaySearch,
  toPayFilterProject, setToPayFilterProject,
  toPayFilterCurrency, setToPayFilterCurrency,
  toPayFilterPaymentType, setToPayFilterPaymentType,
  toPayFilterIgv, setToPayFilterIgv,
  toPayFilterAlert, setToPayFilterAlert,
  toPayProjects,
  filteredToPayBatches,
  expandedToPayBatches,
  toggleToPayBatchExpanded,
  openPaymentModal,
  onOpenQuickPay,
  onOpenEditCredit,
  selectedOrders,
  toggleOrderSelect,
  openBulkModal,
  openReturnModal,
  openInfoModal,
}) {
  if (loading) return <LoadingSpinner />;

  if (filteredToPayBatches.length === 0) {
    return (
      <EmptyState
        title="No hay órdenes por pagar"
        subtitle="Las órdenes aprobadas aparecerán aquí para registrar el pago"
      />
    );
  }

  return (
    <>
      {/* Bulk actions */}
      {selectedOrders.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 shadow-md">
          <span className="text-sm font-medium text-primary-700">{selectedOrders.length} seleccionados</span>
          <Button variant="primary" size="sm" onClick={openBulkModal}>
            Pagar seleccionados
          </Button>
          <Button variant="danger" size="sm" onClick={() => setSelectedOrders([])}>Cancelar</Button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={toPaySearch}
            onChange={(e) => setToPaySearch(e.target.value)}
            type="text"
            placeholder="Buscar por proveedor..."
            className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm transition-colors focus:border-primary focus:ring-primary"
          />
        </div>
        <select value={toPayFilterProject} onChange={(e) => setToPayFilterProject(e.target.value)} className="rounded border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-primary focus:ring-primary">
          <option value="">Todos proyectos</option>
          {toPayProjects.map((proj) => (
            <option key={proj.id} value={proj.id}>{formatProjectDisplay(proj)}</option>
          ))}
        </select>
        <select value={toPayFilterCurrency} onChange={(e) => setToPayFilterCurrency(e.target.value)} className="rounded border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-primary focus:ring-primary">
          <option value="">Moneda</option>
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </select>
        <select value={toPayFilterPaymentType} onChange={(e) => setToPayFilterPaymentType(e.target.value)} className="rounded border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-primary focus:ring-primary">
          <option value="">Tipo pago</option>
          <option value="cash">Contado</option>
          <option value="loan">Crédito</option>
        </select>
        <select value={toPayFilterIgv} onChange={(e) => setToPayFilterIgv(e.target.value)} className="rounded border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-primary focus:ring-primary">
          <option value="">IGV</option>
          <option value="true">Con IGV</option>
          <option value="false">Sin IGV</option>
        </select>
        
        <button
          onClick={() => setToPayFilterAlert(prev => prev === 'overdue' ? '' : 'overdue')}
          className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-1.5 transition-colors border ${
            toPayFilterAlert === 'overdue'
              ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <ClockIcon className="size-4" />
          Vencidos
        </button>
        
        <Button variant="primary" size="md" onClick={onOpenQuickPay} className="ml-auto gap-2">
          <CurrencyDollarIcon className="size-4" />
          Pago Rápido
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {filteredToPayBatches.map((batch) => {
          const alertStatus = getPaymentAlertStatus(batch);
          return (
            <div
              key={batch.batch_id}
              className={`overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${alertStatus === 'overdue' ? 'border-red-300' :
                alertStatus === 'today' ? 'border-amber-300' :
                  alertStatus === 'urgent' ? 'border-orange-300' :
                    'border-gray-200'
                }`}
            >
              {/* Batch Header */}
              <button
                onClick={() => toggleToPayBatchExpanded(batch.batch_id)}
                className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${expandedToPayBatches[batch.batch_id] ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                  }`}
              >
                <ChevronDownIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${expandedToPayBatches[batch.batch_id] ? 'rotate-180' : ''}`} />
                <span className="font-mono text-xs text-gray-400">{batch.batch_id}</span>
                <span className="font-medium text-gray-700 truncate">Proveedor: {batch.seller_name}</span>
                <Badge variant="gray">{batch.orders.length} items</Badge>
                {batch.payment_type === 'loan'
                  ? <Badge variant="purple">CRÉDITO</Badge>
                  : <Badge variant="emerald">CONTADO</Badge>
                }
                <Badge variant={batch.currency === 'PEN' ? 'blue' : 'red'}>{batch.currency}</Badge>
                {batch.igv_enabled && <Badge variant="cyan">+IGV</Badge>}
                {batch.payment_type === 'loan' && alertStatus && alertStatus !== 'normal' && (
                  <Badge variant={alertStatus === 'overdue' ? 'red' : alertStatus === 'today' ? 'red' : 'amber'}>
                    <ClockIcon className="mr-1 size-3" />
                    {getAlertLabel(batch)}
                  </Badge>
                )}
                <span className="ml-auto font-semibold text-gray-900">{batch.currency} {formatNumber((batch.total_with_igv ?? batch.total) || 0)}</span>
              </button>

              {/* Expanded Content */}
              {expandedToPayBatches[batch.batch_id] && (
                <div className="border-t border-gray-100">
                  <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-gray-500">
                    {batch.approved_by_name && <span>Aprobado por: {batch.approved_by_name}</span>}
                    <span>Aprobado {formatDate(batch.approved_at)}</span>
                    {batch.issue_date && <span>Emisión {formatDate(batch.issue_date)}</span>}
                    {batch.due_date && <span>Vence {formatDate(batch.due_date)}</span>}
                    {batch.credit_extended_by_name && (
                      <span className="text-blue-600 font-medium">
                        Cambio de emisión por: {batch.credit_extended_by_name}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-gray-50 px-4">
                    {batch.orders.map((order) => {
                      const amount = (order.amount_with_igv ?? order.amount) || 0;
                      const qty = getOrderQty(order);
                      const qtyNum = getOrderQtyNum(order);
                      const unitPrice = qtyNum > 0 ? amount / qtyNum : 0;
                      return (
                        <div key={order.id} className="flex items-center gap-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrderSelect(order.id)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: getProjectColor(order.project_id) }}>{formatProjectDisplay(order)}</span>
                          <span className="flex-1 truncate text-gray-700">{getOrderTitle(order)}</span>
                          {qty !== '-' && qty > 0 && <span className="text-gray-500">Cant: {qty}</span>}
                          {amount > 0 && qtyNum > 0 && (
                            <span className="text-gray-600">P.Unit: {batch.currency} {formatNumber(unitPrice)}</span>
                          )}
                          {amount > 0 ? (
                            <span className="font-medium text-gray-900">{batch.currency} {formatNumber(amount)}</span>
                          ) : null}
                          <button
                            onClick={() => openInfoModal(order)}
                            className="flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                            title="Info"
                          >
                            <InformationCircleIcon className="size-4" />
                          </button>
                          <button
                            onClick={() => openReturnModal(order)}
                            className="ml-auto flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                            title="Devolver a Por Cotizar"
                          >
                            <ArrowUturnLeftIcon className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">
                      Total: {batch.currency} {formatNumber((batch.total_with_igv ?? batch.total) || 0)}
                    </span>
                    <div className="flex items-center gap-2">
                      {batch.payment_type === 'loan' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onOpenEditCredit(batch); }}
                          className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <PencilSquareIcon className="size-3.5" />
                          EDITAR
                        </Button>
                      )}
                      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); openPaymentModal(batch); }}>
                        Pagar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
