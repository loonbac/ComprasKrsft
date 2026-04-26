/**
 * @file Contenido del tab "Pagadas"
 * @module compraskrsft/components/PaidTab
 */
import { useState } from 'react';
import {
  ChevronDownIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import FileViewerModal from './modals/FileViewerModal';
import CancelInvoiceModal from './modals/CancelInvoiceModal';
import FinalizeCancellationModal from './modals/FinalizeCancellationModal';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './EmptyState';
import {
  getProjectColor,
  formatProjectDisplay,
  getOrderTitle,
  getOrderQty,
  getOrderQtyNum,
  batchAllDelivered,
  batchMissingComprobante,
  formatNumber,
  formatDate,
  getCsrfToken,
} from '../utils';

// Formatea una fecha a dd/mm/yyyy
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * @param {{
 *   paidBatches: Array,
 *   filteredPaidBatches: Array,
 *   expandedPaidBatches: Object,
 *   paidFilterStartDate: string, setPaidFilterStartDate: Function,
 *   paidFilterEndDate: string, setPaidFilterEndDate: Function,
 *   resetPaidFilter: Function,
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
  togglePaidBatchExpanded,
  openEditComprobante,
  verifyBatch,
  verifying,
  apiBase,
  verificationFilter, setVerificationFilter,
  bankFilter, setBankFilter,
  uniqueBanks,
  showToast,
  loadPaidBatches,
  permissions = {},
}) {
  // batch_id del modal de info abierto (null = cerrado)
  const [infoModalBatch, setInfoModalBatch] = useState(null);
  
  // batch_id del modal de confirmación de verificación (null = cerrado)
  const [verifyModalBatch, setVerifyModalBatch] = useState(null);
  
  // Archivo que se está visulaizando en el FileViewerModal
  const [viewingFile, setViewingFile] = useState(null);

  // ── Estado de anulación ─────────────────────────────────────────────
  const [cancelModalBatch, setCancelModalBatch] = useState(null);
  const [finalizeModalBatch, setFinalizeModalBatch] = useState(null);
  const [cancelProcessing, setCancelProcessing] = useState(false);

  const openInfo = (e, batch) => { e.stopPropagation(); setInfoModalBatch(batch); };
  const closeInfo = () => setInfoModalBatch(null);

  // ── Handlers de anulación ───────────────────────────────────────────

  /** Paso 1: Solo cambia estado a solicitando_anulacion (sin datos NC) */
  const handleInitCancellation = async (batchId) => {
    setCancelProcessing(true);
    try {
      const res = await fetch(`${apiBase}/cancel/init`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken() 
        },
        body: JSON.stringify({ batch_id: String(batchId) }),
      });
      const result = await res.json();
      if (result.success) {
        showToast?.('Anulación iniciada. Ingrese los datos de Nota de Crédito.', 'warning');
        loadPaidBatches?.();
      } else {
        showToast?.(result.message || 'Error al iniciar anulación', 'error');
      }
    } catch {
      showToast?.('Error de conexión', 'error');
    }
    setCancelProcessing(false);
  };

  /** Paso 2: Guardar datos de NC (la factura ya está en solicitando_anulacion) */
  const handleRequestCancellation = async (data, resetForm) => {
    setCancelProcessing(true);
    try {
      const formData = new FormData();
      formData.append('batch_id', data.batch_id);
      formData.append('nc_serie', data.nc_serie);
      formData.append('nc_number', data.nc_number);
      if (data.nc_document) formData.append('nc_document', data.nc_document);
      if (data.nc_document_link) formData.append('nc_document_link', data.nc_document_link);

      const res = await fetch(`${apiBase}/cancel/request`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken()
        },
        body: formData
      });
      const result = await res.json();
      if (result.success) {
        showToast?.('Datos de Nota de Crédito registrados', 'success');
        resetForm();
        setCancelModalBatch(null);
        loadPaidBatches?.();
      } else {
        showToast?.(result.message || 'Error al registrar datos', 'error');
      }
    } catch {
      showToast?.('Error de conexión', 'error');
    }
    setCancelProcessing(false);
  };

  const handleConfirmCancellation = async (batchId) => {
    setCancelProcessing(true);
    try {
      const res = await fetch(`${apiBase}/cancel/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken() 
        },
        body: JSON.stringify({ batch_id: String(batchId) }),
      });
      const result = await res.json();
      if (result.success) {
        showToast?.('Datos confirmados. Pendiente de finalización.', 'success');
        loadPaidBatches?.();
      } else {
        showToast?.(result.message || 'Error al confirmar', 'error');
      }
    } catch {
      showToast?.('Error de conexión', 'error');
    }
    setCancelProcessing(false);
  };

  const handleFinalizeCancellation = async (batchId) => {
    setCancelProcessing(true);
    try {
      const res = await fetch(`${apiBase}/cancel/finalize`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken() 
        },
        body: JSON.stringify({ batch_id: String(batchId) }),
      });
      const result = await res.json();
      if (result.success) {
        showToast?.('Factura anulada exitosamente', 'success');
        setFinalizeModalBatch(null);
        loadPaidBatches?.();
      } else {
        showToast?.(result.message || 'Error al finalizar anulación', 'error');
      }
    } catch {
      showToast?.('Error de conexión', 'error');
    }
    setCancelProcessing(false);
  };

  const handleRejectCancellation = async (batchId) => {
    setCancelProcessing(true);
    try {
      const res = await fetch(`${apiBase}/cancel/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken() 
        },
        body: JSON.stringify({ batch_id: String(batchId) }),
      });
      const result = await res.json();
      if (result.success) {
        showToast?.('Anulación rechazada. La factura vuelve a su estado normal.', 'warning');
        setFinalizeModalBatch(null);
        loadPaidBatches?.();
      } else {
        showToast?.(result.message || 'Error al rechazar', 'error');
      }
    } catch {
      showToast?.('Error de conexión', 'error');
    }
    setCancelProcessing(false);
  };

  // ── Helper: badge de estado de anulación ────────────────────────────
  const getCancellationBadge = (batch) => {
    if (batch.cancellation_status === 'anulada') {
      return <Badge variant="red"><NoSymbolIcon className="mr-1 size-3.5" />ANULADA</Badge>;
    }
    if (batch.cancellation_status === 'finalizar_anulacion') {
      return <Badge variant="warning"><ExclamationTriangleIcon className="mr-1 size-3.5" />Finalizar Anulación</Badge>;
    }
    if (batch.cancellation_status === 'solicitando_anulacion') {
      return <Badge variant="amber"><XCircleIcon className="mr-1 size-3.5" />Solicitando Anulación</Badge>;
    }
    return null;
  };

  return (
    <>
      {/* Filter bar */}
      {paidBatches.length > 0 && (() => {
        const hasFilters = paidFilterStartDate || paidFilterEndDate || verificationFilter !== 'all' || bankFilter;
        return (
          <div className="rounded-xl border-2 border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
              {/* Fechas */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Desde</span>
                <input value={paidFilterStartDate} onChange={(e) => setPaidFilterStartDate(e.target.value)} type="date" className="rounded-lg border border-gray-300 px-2 py-1 text-[12.5px] shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Hasta</span>
                <input value={paidFilterEndDate} onChange={(e) => setPaidFilterEndDate(e.target.value)} type="date" className="rounded-lg border border-gray-300 px-2 py-1 text-[12.5px] shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>

              {/* Separador */}
              <div className="h-5 w-px bg-gray-200" />

              {/* Estado de verificación */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Verificación</span>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                  {[
                    { value: 'all', label: 'Todas' },
                    { value: 'unverified', label: 'Sin verificar' },
                    { value: 'verified', label: 'Verificadas' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setVerificationFilter(value)}
                      className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        verificationFilter === value
                          ? 'bg-primary text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separador + Banco */}
              {uniqueBanks.length > 0 && (
                <>
                  <div className="h-5 w-px bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Banco</span>
                    <select
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-[12.5px] shadow-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="">Todos</option>
                      {uniqueBanks.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Limpiar */}
              {hasFilters && (
                <>
                  <div className="h-5 w-px bg-gray-200" />
                  <button onClick={resetPaidFilter} className="rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors text-white text-[11px] font-medium px-2.5 py-1.5">Limpiar filtros</button>
                </>
              )}

              {/* Contador de resultados */}
              {hasFilters && (
                <span className="ml-auto text-[11px] text-gray-400">
                  {filteredPaidBatches.length} de {paidBatches.length} facturas
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Content */}
      {paidBatches.length === 0 ? (
        <EmptyState
          title="No hay compras pagadas"
          subtitle="Las compras con pago confirmado aparecerán aquí"
        />
      ) : (
        <div className="space-y-3">
          {filteredPaidBatches.map((batch) => {
            const isAnulada = batch.cancellation_status === 'anulada';
            const isSolicitando = batch.cancellation_status === 'solicitando_anulacion';
            const isFinalizar = batch.cancellation_status === 'finalizar_anulacion';
            const hasCancellationFlow = isAnulada || isSolicitando || isFinalizar;

            return (
            <div key={batch.batch_id} className={`overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${
              isAnulada ? 'border-red-300 opacity-75' : hasCancellationFlow ? 'border-amber-300' : 'border-gray-200'
            }`}>
              {/* Header */}
              <button
                onClick={() => togglePaidBatchExpanded(batch.batch_id)}
                className={`flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${expandedPaidBatches[batch.batch_id] ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                  }`}
              >
                <ChevronDownIcon className={`size-4 shrink-0 text-gray-400 transition-transform ${expandedPaidBatches[batch.batch_id] ? 'rotate-180' : ''}`} />
                <span className="font-mono text-xs text-gray-400">{batch.batch_id}</span>
                <span className={`font-medium truncate ${isAnulada ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{batch.seller_name}</span>

                {/* Cancellation badge (takes priority) */}
                {getCancellationBadge(batch) || (
                  batchAllDelivered(batch)
                    ? <Badge variant="emerald" dot>Entregado</Badge>
                    : <Badge variant="blue" dot>Pagado</Badge>
                )}

                {batchMissingComprobante(batch) && !hasCancellationFlow && (
                  <Badge variant="warning">
                    <ExclamationTriangleIcon className="mr-1 size-4" />
                    Sin comprobante
                  </Badge>
                )}
                <Badge variant="gray">{batch.orders.length} items</Badge>
                {/* Pill Verificada */}
                {batch.contasis_verified && (
                  <Badge variant="emerald" dot>Verificada</Badge>
                )}
                {/* Botón Información */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => openInfo(e, batch)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openInfo(e, batch); }}
                  className="rounded p-1 text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                  title="Información de aprobación y pago"
                >
                  <InformationCircleIcon className="size-5" />
                </span>
                {/* Botón Verificar (no mostrar si está en proceso de anulación intermedio) */}
                {permissions.paid_full && !batch.contasis_verified && !isSolicitando && !isFinalizar && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setVerifyModalBatch(batch); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setVerifyModalBatch(batch); } }}
                    className={`rounded p-1 transition-colors cursor-pointer ${
                      verifying ? 'text-gray-300 cursor-wait' : 'text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                    title="Verificar factura"
                  >
                    <CheckCircleIcon className="size-5" />
                  </span>
                )}
                <span className={`ml-auto font-semibold ${isAnulada ? 'text-red-400 line-through' : 'text-gray-900'}`}>{batch.currency} {formatNumber(batch.total)}</span>
                {!batchMissingComprobante(batch) && !hasCancellationFlow && (
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
                        const qtyNum = getOrderQtyNum(order);
                        const totalDirectCost = order.igv_enabled
                          ? parseFloat(order.amount || 0) + parseFloat(order.igv_amount || 0)
                          : parseFloat(order.amount || 0);
                        const unitDirectPrice = qtyNum > 0 ? totalDirectCost / qtyNum : 0;
                        const stockCost = isFromInventory && orderQty > 0 ? (refPrice * orderQty) : 0;

                        return (
                          <div key={order.id} className={`flex items-center gap-3 py-2 text-sm ${isFromInventory ? 'bg-primary-50/30' : ''}`}>
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: getProjectColor(order.project_id) }}>{formatProjectDisplay(order)}</span>
                            <span className="flex-1 truncate text-gray-700">{getOrderTitle(order)}</span>
                            {isFromInventory && (
                              <Badge variant="cyan">De Almacén</Badge>
                            )}
                            <span className="text-gray-500">Cant: {orderQty}</span>
                            {isFromInventory ? (
                              <>
                                {refPrice > 0 && (
                                  <span className="text-primary-700">P.Unit: {order.currency || batch.currency} {formatNumber(refPrice)}</span>
                                )}
                                {stockCost > 0 ? (
                                  <span className="font-medium text-primary-700">
                                    Costo Ref: {order.currency || batch.currency} {formatNumber(stockCost)}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {unitDirectPrice > 0 && (
                                  <span className="text-gray-600">P.Unit: {order.currency || batch.currency} {formatNumber(unitDirectPrice)}</span>
                                )}
                                {totalDirectCost > 0 ? (
                                  <span className="font-medium text-gray-900">{order.currency || batch.currency} {formatNumber(totalDirectCost)}</span>
                                ) : null}
                              </>
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
                      {batchMissingComprobante(batch) && !hasCancellationFlow && (
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
                      {batch.payment_bank && (
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-500">Banco:</span>
                          <span className="text-gray-700 font-medium">{batch.payment_bank}</span>
                        </div>
                      )}
                      {batch.payment_proof_link && (
                        <div className="flex gap-4 text-sm mt-1">
                          <span className="text-gray-500">Link Factura:</span>
                          <a href={batch.payment_proof_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-700 underline">{batch.payment_proof_link}</a>
                        </div>
                      )}
                      {batch.payment_proof && (() => {
                        const pathStr = batch.payment_proof;
                        const fileName = pathStr.split('/').pop() || 'archivo';
                        const ext = fileName.split('.').pop()?.toLowerCase();
                        let mime = 'application/octet-stream';
                        if (ext === 'pdf') mime = 'application/pdf';
                        else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mime = 'image/' + ext;
                        else if (['xls', 'xlsx'].includes(ext)) mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        else if (['doc', 'docx'].includes(ext)) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

                        // Construir URL de acceso a través del backend (evita restricciones de Vite)
                        const fileApiUrl = `${apiBase}/payment-proof-file?path=${encodeURIComponent(pathStr)}`;

                        return (
                          <div className="flex items-center gap-4 text-sm mt-1">
                            <span className="text-gray-500">Archivo:</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingFile({
                                    id: pathStr,
                                    original_name: fileName,
                                    mime_type: mime
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                                title="Ver archivo"
                              >
                                <EyeIcon className="size-4" />
                                <span>Ver</span>
                              </button>
                              <a 
                                href={fileApiUrl}
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-primary hover:text-primary-700 font-medium underline"
                                title="Descargar"
                              >
                                <ArrowDownTrayIcon className="size-4" />
                                <span>Descargar</span>
                              </a>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Datos de Nota de Crédito (si existe) ─────────────── */}
                    {hasCancellationFlow && (
                      <div className="border-t border-red-100 bg-red-50/50 px-4 py-3 space-y-2">
                        <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide">Nota de Crédito</h4>
                        <div className="flex gap-4 text-sm">
                          <span className="text-red-400">Tipo CP:</span>
                          <span className="font-medium text-red-700">{batch.nc_type || '07'}</span>
                          <span className="text-red-400">Serie:</span>
                          <span className="font-medium text-red-700">{batch.nc_serie || '—'}</span>
                          <span className="text-red-400">Número:</span>
                          <span className="font-medium text-red-700">{batch.nc_number || '—'}</span>
                        </div>
                        
                        {(batch.nc_document || batch.nc_document_link) && (
                          <div className="flex items-center gap-4 text-sm mt-1">
                            <span className="text-red-400">Doc. NC:</span>
                            <div className="flex items-center gap-3">
                              {batch.nc_document_link && (
                                <a href={batch.nc_document_link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700 underline">
                                  Ver link
                                </a>
                              )}
                              
                              {batch.nc_document && (() => {
                                const pathStr = batch.nc_document;
                                const fileName = pathStr.split('/').pop() || 'archivo_nc';
                                const ext = fileName.split('.').pop()?.toLowerCase();
                                let mime = 'application/octet-stream';
                                if (ext === 'pdf') mime = 'application/pdf';
                                else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mime = 'image/' + ext;
                                else if (['xls', 'xlsx'].includes(ext)) mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                                else if (['doc', 'docx'].includes(ext)) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

                                // Construir URL de acceso a través del backend
                                const fileApiUrl = `${apiBase}/payment-proof-file?path=${encodeURIComponent(pathStr)}`;

                                return (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingFile({
                                          id: pathStr,
                                          original_name: fileName,
                                          mime_type: mime
                                        });
                                      }}
                                      className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                                      title="Ver archivo"
                                    >
                                      <EyeIcon className="size-4" />
                                      <span>Ver</span>
                                    </button>
                                    <a 
                                      href={fileApiUrl}
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-medium underline"
                                      title="Descargar"
                                    >
                                      <ArrowDownTrayIcon className="size-4" />
                                      <span>Descargar</span>
                                    </a>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Alerta y botones de acción de anulación ──────────── */}
                    {!isAnulada && (
                      <>
                        {/* Alerta: Solicitando anulación sin datos de NC */}
                        {isSolicitando && !batch.nc_serie && (
                          <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ExclamationTriangleIcon className="size-5 text-amber-500 shrink-0" />
                              <span className="flex-1 text-sm text-amber-700 font-medium">
                                Anulación en proceso — Debe ingresar los datos de la Nota de Crédito
                              </span>
                              <Button
                                variant="warning"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setCancelModalBatch(batch); }}
                                className="gap-1.5 shrink-0"
                              >
                                <PencilSquareIcon className="size-3.5" />
                                Ingresar Datos
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-end gap-2">
                          {/* Sin anulación en curso: mostrar botón "Anular" */}
                          {permissions.paid_full && !hasCancellationFlow && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleInitCancellation(batch.batch_id); }}
                              disabled={cancelProcessing}
                              loading={cancelProcessing}
                              className="gap-1.5"
                            >
                              <XCircleIcon className="size-4" />
                              Anular Factura
                            </Button>
                          )}

                          {/* Solicitando anulación CON datos de NC: botón para confirmar */}
                          {permissions.paid_full && isSolicitando && batch.nc_serie && (
                            <Button
                              variant="warning"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleConfirmCancellation(batch.batch_id); }}
                              disabled={cancelProcessing}
                              loading={cancelProcessing}
                              className="gap-1.5"
                            >
                              <CheckCircleIcon className="size-4" />
                              Confirmar Datos
                            </Button>
                          )}

                          {/* Finalizar anulación: botones aprobar/rechazar */}
                          {permissions.paid_full && isFinalizar && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setFinalizeModalBatch(batch); }}
                              className="gap-1.5"
                            >
                              <NoSymbolIcon className="size-4" />
                              Finalizar Anulación
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          );})}
        </div>
      )}

      {/* ── Modal de Información ──────────────────────────────── */}
      {infoModalBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeInfo}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Título */}
            <div className="mb-4 flex items-center gap-2">
              <InformationCircleIcon className="size-5 text-blue-500" />
              <h3 className="text-base font-semibold text-gray-800">Información de la Factura</h3>
            </div>

            {/* Contenido */}
            <div className="space-y-3 text-sm">
              {/* Proveedor */}
              <div className="flex justify-between">
                <span className="text-gray-500">Proveedor:</span>
                <span className="font-medium text-gray-800 text-right max-w-[200px]">{infoModalBatch.seller_name ?? '—'}</span>
              </div>

              <div className="border-t border-gray-100" />

              {/* Aprobado por */}
              <div className="flex justify-between">
                <span className="text-gray-500">Aprobado por:</span>
                <span className="font-medium text-gray-800">{infoModalBatch.approved_by_name ?? '—'}</span>
              </div>

              {/* Pagado por */}
              <div className="flex justify-between">
                <span className="text-gray-500">Pagado por:</span>
                <span className="font-medium text-gray-800">{infoModalBatch.payment_confirmed_by_name ?? '—'}</span>
              </div>

              <div className="border-t border-gray-100" />

              {/* Fecha de pago */}
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha de pago:</span>
                <span className="font-medium text-gray-800">{fmtDate(infoModalBatch.payment_confirmed_at)}</span>
              </div>

              {/* Fecha de emisión */}
              {infoModalBatch.issue_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha de emisión:</span>
                  <span className="font-medium text-gray-800">{fmtDate(infoModalBatch.issue_date)}</span>
                </div>
              )}

              {/* Editado por */}
              {infoModalBatch.edited_by_name && (
                <>
                  <div className="border-t border-gray-100" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Editado por:</span>
                    <span className="font-medium text-amber-600">{infoModalBatch.edited_by_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha de edición:</span>
                    <span className="font-medium text-gray-800">{fmtDate(infoModalBatch.edited_at)}</span>
                  </div>
                </>
              )}

              {/* Verificado por */}
              {infoModalBatch.contasis_verified && (
                <>
                  <div className="border-t border-gray-100" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Verificado por:</span>
                    <span className="font-medium text-emerald-600">{infoModalBatch.verified_by_name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha verificación:</span>
                    <span className="font-medium text-gray-800">{fmtDate(infoModalBatch.contasis_verified_at)}</span>
                  </div>
                </>
              )}

              {/* Estado de anulación */}
              {infoModalBatch.cancellation_status && (
                <>
                  <div className="border-t border-red-100" />
                  <div className="flex justify-between">
                    <span className="text-red-500">Estado de Anulación:</span>
                    <span className="font-medium text-red-700">
                      {infoModalBatch.cancellation_status === 'anulada' ? 'FACTURA ANULADA'
                        : infoModalBatch.cancellation_status === 'finalizar_anulacion' ? 'Pendiente de Finalización'
                        : 'Solicitando Datos'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer / Botón Cerrar */}
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={closeInfo}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmación de Verificación ───────────────────── */}
      {verifyModalBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setVerifyModalBatch(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <CheckCircleIcon className="size-6 text-emerald-500" />
              <h3 className="text-lg font-semibold text-gray-800">Verificar Factura</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás seguro de que deseas marcar la factura de <span className="font-semibold">{verifyModalBatch.seller_name}</span> como verificada? Esta acción la removerá del listado del Contasis.
            </p>

            <div className="flex justify-end gap-3">
              <Button 
                variant="danger" 
                onClick={() => setVerifyModalBatch(null)}
                disabled={verifying}
              >
                Cancelar
              </Button>
              <Button 
                variant="success" 
                onClick={async () => {
                  await verifyBatch(verifyModalBatch.batch_id);
                  setVerifyModalBatch(null);
                }}
                disabled={verifying}
                loading={verifying}
              >
                Verificar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Anulación de Factura (paso 1) ──────────────────── */}
      <CancelInvoiceModal
        open={!!cancelModalBatch}
        onClose={() => setCancelModalBatch(null)}
        batch={cancelModalBatch}
        onSubmit={handleRequestCancellation}
        submitting={cancelProcessing}
        apiBase={apiBase}
      />

      {/* ── Modal de Finalización de Anulación (paso 3) ─────────────── */}
      <FinalizeCancellationModal
        open={!!finalizeModalBatch}
        onClose={() => setFinalizeModalBatch(null)}
        batch={finalizeModalBatch}
        onFinalize={handleFinalizeCancellation}
        onReject={handleRejectCancellation}
        processing={cancelProcessing}
        apiBase={apiBase}
      />

      {/* ── Visualizador de Archivos (Facturas) ───────────────────── */}
      <FileViewerModal
        isOpen={!!viewingFile}
        file={viewingFile}
        getDownloadUrl={(path) => `${apiBase}/payment-proof-file?path=${encodeURIComponent(path)}`}
        onClose={() => setViewingFile(null)}
      />
    </>
  );
}
