/**
 * @file Contenido del tab "Por Aprobar"
 * @module compraskrsft/components/PendingTab
 */
import {
  ChevronRightIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Badge from './ui/Badge';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { getProjectColor, formatProjectDisplay, getOrderTitle, getOrderQty } from '../utils';

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
 *   pendingProjects: Array,
 *   selectedPendingIds: number[],
 *   setSelectedPendingIds: Function,
 *   expandedProjects: Object,
 *   expandedLists: Object,
 *   approvingPending: boolean,
 *   openApprovalModal: Function,
 *   toggleProjectExpanded: Function,
 *   getProjectLists: Function,
 *   getListKey: Function,
 *   toggleListExpanded: Function,
 *   getListOrders: Function,
 *   isPendingSelected: Function,
 *   togglePendingSelect: Function,
 *   approveSinglePending: Function,
 *   rejectOrder: Function,
 * }} props
 */
export default function PendingTab({
  loading,
  pendingProjects,
  selectedPendingIds,
  setSelectedPendingIds,
  expandedProjects,
  expandedLists,
  approvingPending,
  openApprovalModal,
  toggleProjectExpanded,
  getProjectLists,
  getListKey,
  toggleListExpanded,
  getListOrders,
  isPendingSelected,
  togglePendingSelect,
  approveSinglePending,
  rejectOrder,
}) {
  if (loading) return <LoadingSpinner />;

  if (pendingProjects.length === 0) {
    return (
      <EmptyState
        title="No hay órdenes pendientes"
        subtitle="Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos"
      />
    );
  }

  return (
    <>
      {/* Floating selection panel — bottom-center */}
      {selectedPendingIds.length > 0 && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-primary-200 bg-white px-5 py-3 shadow-2xl ring-1 ring-primary-100">
          <CheckCircleIcon className="size-5 text-primary shrink-0" />
          <span className="text-sm font-semibold text-gray-800">
            {selectedPendingIds.length} seleccionado{selectedPendingIds.length !== 1 ? 's' : ''}
          </span>
          <Button variant="primary" size="sm" onClick={() => openApprovalModal()} disabled={approvingPending} loading={approvingPending}>
            {approvingPending ? 'Aprobando...' : 'Aprobar órdenes'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setSelectedPendingIds([])}>Cancelar</Button>
        </div>,
        document.body
      )}

      <div className="space-y-4">
        {/* Project accordion */}
        <div className="space-y-3">
          {pendingProjects.map((proj) => (
            <div key={proj.id} className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm">
              {/* Project Header */}
              <button
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${expandedProjects[proj.id] ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                onClick={() => toggleProjectExpanded(proj.id)}
              >
                <ChevronRightIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${expandedProjects[proj.id] ? 'rotate-90' : ''}`} />
                <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: getProjectColor(proj.id) }}>{formatProjectDisplay(proj)}</span>
                <Badge variant="gray">{proj.count} items</Badge>
              </button>

              {/* Lists under project */}
              {expandedProjects[proj.id] && (
                <div className="border-t border-gray-100">
                  {getProjectLists(proj.id).map((list) => {
                    const listKey = getListKey(proj.id, list.filename);
                    return (
                      <div key={list.filename || 'manual'}>
                        {/* List Header */}
                        <div>
                          <button
                            className={`flex w-full items-center gap-3 border-b border-gray-50 px-6 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${expandedLists[listKey] ? 'bg-gray-50' : ''
                              }`}
                            onClick={() => toggleListExpanded(proj.id, list.filename)}
                          >
                            <ChevronRightIcon className={`size-3.5 shrink-0 text-gray-400 transition-transform ${expandedLists[listKey] ? 'rotate-90' : ''}`} />
                            <DocumentTextIcon className="size-4 shrink-0 text-gray-400" />
                            <span className="truncate font-medium text-gray-600">{list.filename}</span>
                            <Badge variant="gray">{list.count}</Badge>
                          </button>
                          {expandedLists[listKey] && (
                            <div className="border-b border-gray-50 px-6 py-2 flex items-center gap-3 bg-gray-50">
                              <IndeterminateCheckbox
                                onChange={(e) => {
                                  const listOrders = getListOrders(proj.id, list.filename);
                                  if (e.target.checked) {
                                    const newIds = [...selectedPendingIds, ...listOrders.filter(o => !selectedPendingIds.includes(o.id)).map(o => o.id)];
                                    setSelectedPendingIds(newIds);
                                  } else {
                                    const orderIds = listOrders.map(o => o.id);
                                    setSelectedPendingIds(selectedPendingIds.filter(id => !orderIds.includes(id)));
                                  }
                                }}
                                checked={getListOrders(proj.id, list.filename).length > 0 && getListOrders(proj.id, list.filename).every(o => selectedPendingIds.includes(o.id))}
                                indeterminate={getListOrders(proj.id, list.filename).some(o => selectedPendingIds.includes(o.id)) && !getListOrders(proj.id, list.filename).every(o => selectedPendingIds.includes(o.id))}
                                className="rounded border-gray-300"
                              />
                              <span className="text-sm text-gray-600 font-medium">Seleccionar todos</span>
                            </div>
                          )}
                        </div>

                        {/* Table — layout differs for services vs materials */}
                        {expandedLists[listKey] && (() => {
                          const orders = getListOrders(proj.id, list.filename);
                          const isService = orders.length > 0 && orders[0].type === 'service';
                          if (isService) {
                            return (
                              <div className="overflow-x-auto">
                                <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                                  <colgroup>
                                    <col style={{ width: '4%' }} />
                                    <col style={{ width: '7%' }} />
                                    <col style={{ width: '37%' }} />
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '12%' }} />
                                  </colgroup>
                                  <thead className="bg-gray-50">
                                    <tr className="*:px-3 *:py-2 *:text-xs *:font-medium *:uppercase *:text-gray-500 *:text-center">
                                      <th></th>
                                      <th>ITEM</th>
                                      <th className="!text-left">DESCRIPCIÓN</th>
                                      <th>TIEMPO</th>
                                      <th>LUGAR</th>
                                      <th>ACCIONES</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {orders.map((order) => {
                                      const timeVal = Array.isArray(order.materials) && order.materials[0] ? order.materials[0].qty : '—';
                                      const timeUnit = order.unit || '';
                                      const location = order.notes || '—';
                                      return (
                                        <tr key={order.id} className={`transition-colors ${isPendingSelected(order.id) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                                          <td className="px-3 py-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={isPendingSelected(order.id)} onChange={() => togglePendingSelect(order.id)} className="rounded border-gray-300" />
                                          </td>
                                          <td className="px-3 py-2 text-gray-700 align-middle text-center font-medium cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.item_number || '-'}</td>
                                          <td className="px-3 py-2 text-gray-700 align-middle text-left truncate cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.description}</td>
                                          <td className="px-3 py-2 text-gray-700 align-middle text-center cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{timeVal} {timeUnit}</td>
                                          <td className="px-3 py-2 text-gray-700 align-middle text-center cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{location}</td>
                                          <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-center gap-1.5 w-4/5 mx-auto">
                                              <button onClick={() => approveSinglePending(order.id)} title="Aprobar" className="flex-1 flex items-center justify-center rounded-lg py-1.5 bg-emerald-100 text-emerald-600 transition-colors hover:bg-emerald-200 hover:text-emerald-700 font-semibold"><CheckIcon className="size-4" /></button>
                                              <button onClick={() => rejectOrder(order.id)} title="Rechazar" className="flex-1 flex items-center justify-center rounded-lg py-1.5 bg-red-100 text-red-600 transition-colors hover:bg-red-200 hover:text-red-700 font-semibold"><XMarkIcon className="size-4" /></button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }
                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                                <colgroup>
                                  <col style={{ width: '4%' }} />
                                  <col style={{ width: '5%' }} />
                                  <col style={{ width: '7%' }} />
                                  <col style={{ width: '14%' }} />
                                  <col style={{ width: '22%' }} />
                                  <col style={{ width: '8%' }} />
                                  <col style={{ width: '10%' }} />
                                  <col style={{ width: '16%' }} />
                                  <col style={{ width: '14%' }} />
                                </colgroup>
                                <thead className="bg-gray-50">
                                  <tr className="*:px-3 *:py-2 *:text-xs *:font-medium *:uppercase *:text-gray-500 *:text-center">
                                    <th></th>
                                    <th>ITEM</th>
                                    <th>CANTIDAD</th>
                                    <th className="!text-left">TIPO DE MATERIAL</th>
                                    <th className="!text-left">ESPECIFICACION TECNICA</th>
                                    <th>MEDIDA</th>
                                    <th>TIPO DE CONEXIÓN</th>
                                    <th className="!text-left">OBSERVACIONES</th>
                                    <th>ACCIONES</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {orders.map((order) => (
                                    <tr key={order.id} className={`transition-colors ${isPendingSelected(order.id) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                                      <td className="px-3 py-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={isPendingSelected(order.id)} onChange={() => togglePendingSelect(order.id)} className="rounded border-gray-300" />
                                      </td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-center font-medium cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.item_number || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-center cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{getOrderQty(order)}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-left cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.material_type || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-left truncate cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{getOrderTitle(order)}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-center cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.diameter || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-center cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.series || '-'}</td>
                                      <td className="px-3 py-2 text-gray-700 align-middle text-left cursor-pointer" onClick={() => togglePendingSelect(order.id)}>{order.notes || '-'}</td>
                                      <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-center gap-1.5 w-4/5 mx-auto">
                                          <button onClick={() => approveSinglePending(order.id)} title="Aprobar" className="flex-1 flex items-center justify-center rounded-lg py-1.5 bg-emerald-100 text-emerald-600 transition-colors hover:bg-emerald-200 hover:text-emerald-700 font-semibold"><CheckIcon className="size-4" /></button>
                                          <button onClick={() => rejectOrder(order.id)} title="Rechazar" className="flex-1 flex items-center justify-center rounded-lg py-1.5 bg-red-100 text-red-600 transition-colors hover:bg-red-200 hover:text-red-700 font-semibold"><XMarkIcon className="size-4" /></button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
