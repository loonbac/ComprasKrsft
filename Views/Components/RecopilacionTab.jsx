/**
 * @file Contenido del tab "Recopilación"
 * @module compraskrsft/components/RecopilacionTab
 */
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState, useMemo } from 'react';
import Badge from './ui/Badge';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import {
  getProjectColor,
  formatProjectDisplay,
  getOrderTitle,
  getOrderQty,
  formatNumber,
  formatDate,
} from '../utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   loading: boolean,
 *   pendingOrders: Array,
 *   toPayBatches: Array,
 *   paidBatches: Array,
 * }} props
 */
export default function RecopilacionTab({
  loading,
  pendingOrders,
  toPayBatches,
  paidBatches,
}) {
  // null = "Todos"
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Meses disponibles ────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set();

    pendingOrders.forEach((order) => {
      const k = getMonthKey(order.created_at);
      if (k) months.add(k);
    });

    toPayBatches.forEach((batch) => {
      const k = getMonthKey(batch.issue_date || batch.approved_at || batch.created_at);
      if (k) months.add(k);
    });

    paidBatches.forEach((batch) => {
      const k = getMonthKey(batch.payment_confirmed_at || batch.issue_date || batch.created_at);
      if (k) months.add(k);
    });

    return Array.from(months).sort().reverse();
  }, [pendingOrders, toPayBatches, paidBatches]);

  // ── Datos aplanados ──────────────────────────────────────────────────────
  const allRows = useMemo(() => {
    const results = [];

    pendingOrders.forEach((order) => {
      const pendingBase = parseFloat(order.amount || 0);
      const pendingIgv = order.igv_enabled ? pendingBase * (parseFloat(order.igv_rate ?? 18) / 100) : 0;
      results.push({
        id: `pending-${order.id}`,
        type: 'pending',
        monthKey: getMonthKey(order.created_at),
        seller_name: order.seller_name || '-',
        seller_document: order.seller_document || '-',
        batch_id: null,
        cdp: null,
        project_id: order.project_id,
        project_name: order.project_name,
        project_abbreviation: order.project_abbreviation,
        ceco_codigo: order.ceco_codigo,
        expense_type: order.expense_type,
        order_title: getOrderTitle(order),
        order_qty: getOrderQty(order),
        currency: order.currency || 'PEN',
        amount: pendingBase,
        amount_with_igv: order.amount_with_igv || (pendingBase + pendingIgv),
        igv_enabled: !!order.igv_enabled,
        payment_type: order.payment_type || null,
        issue_date: order.issue_date || order.created_at,
        due_date: order.payment_type === 'cash' ? (order.issue_date || order.created_at) : (order.due_date || null),
        status: 'Por Aprobar',
      });
    });

    toPayBatches.forEach((batch) => {
      batch.orders.forEach((order) => {
        const toPayBase = parseFloat(order.amount || 0);
        const toPayIgv = batch.igv_enabled ? toPayBase * (parseFloat(order.igv_rate ?? 18) / 100) : 0;
        results.push({
          id: `topay-${batch.batch_id}-${order.id}`,
          type: 'to_pay',
          monthKey: getMonthKey(batch.issue_date || batch.approved_at || batch.created_at),
          seller_name: batch.seller_name || '-',
          seller_document: batch.seller_document || '-',
          batch_id: batch.batch_id,
          cdp: null,
          project_id: order.project_id,
          project_name: order.project_name,
          project_abbreviation: order.project_abbreviation,
          ceco_codigo: order.ceco_codigo,
          expense_type: order.expense_type,
          order_title: getOrderTitle(order),
          order_qty: getOrderQty(order),
          currency: batch.currency || 'PEN',
          amount: toPayBase,
          amount_with_igv: order.amount_with_igv ?? (toPayBase + toPayIgv),
          igv_enabled: !!batch.igv_enabled,
          payment_type: batch.payment_type || null,
          issue_date: batch.issue_date || null,
          due_date: batch.payment_type === 'cash' ? (batch.issue_date || null) : (batch.due_date || null),
          status: 'Por Pagar',
        });
      });
    });

    paidBatches.forEach((batch) => {
      const cdp =
        batch.cdp_type && batch.cdp_serie && batch.cdp_number
          ? `${batch.cdp_type} ${batch.cdp_serie}-${batch.cdp_number}`
          : null;
      batch.orders.forEach((order) => {
        const paidBase = parseFloat(order.amount || 0);
        const paidIgv = (order.igv_enabled || batch.igv_enabled) ? paidBase * (parseFloat(order.igv_rate ?? 18) / 100) : 0;
        results.push({
          id: `paid-${batch.batch_id}-${order.id}`,
          type: 'paid',
          monthKey: getMonthKey(batch.payment_confirmed_at || batch.issue_date || batch.created_at),
          seller_name: batch.seller_name || '-',
          seller_document: batch.seller_document || '-',
          batch_id: batch.batch_id,
          cdp,
          project_id: order.project_id,
          project_name: order.project_name,
          project_abbreviation: order.project_abbreviation,
          ceco_codigo: order.ceco_codigo,
          expense_type: order.expense_type,
          order_title: getOrderTitle(order),
          order_qty: getOrderQty(order),
          currency: batch.currency || 'PEN',
          amount: paidBase,
          amount_with_igv: paidBase + paidIgv,
          igv_enabled: !!(order.igv_enabled || batch.igv_enabled),
          payment_type: batch.payment_type || null,
          issue_date: batch.issue_date || null,
          due_date: batch.payment_type === 'cash' ? (batch.issue_date || null) : (batch.due_date || null),
          status: 'Pagada',
        });
      });
    });

    return results;
  }, [pendingOrders, toPayBatches, paidBatches]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (selectedMonth) {
      rows = rows.filter((r) => r.monthKey === selectedMonth);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.seller_name || '').toLowerCase().includes(term) ||
          (r.order_title || '').toLowerCase().includes(term) ||
          (formatProjectDisplay(r) || '').toLowerCase().includes(term),
      );
    }

    return rows;
  }, [allRows, selectedMonth, searchTerm]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            type="text"
            placeholder="Buscar por proveedor, proyecto o descripción..."
            className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm transition-colors focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      {/* Month pills — horizontal scrollable row like Excel sheet tabs */}
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {/* "Todos" pill */}
          <button
            onClick={() => setSelectedMonth(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedMonth === null
              ? 'border-primary bg-primary text-white shadow-sm'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800'
              }`}
          >
            Todos
          </button>

          {/* Month pills — oldest first (reversed so newest is at right) */}
          {[...availableMonths].reverse().map((monthKey) => (
            <button
              key={monthKey}
              onClick={() => setSelectedMonth(monthKey)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedMonth === monthKey
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800'
                }`}
            >
              {formatMonthKey(monthKey)}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {filteredRows.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          subtitle={
            selectedMonth
              ? `No hay registros para ${formatMonthKey(selectedMonth)}`
              : 'No hay registros disponibles'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3 text-center">MES</th>
                <th className="px-3 py-3 text-center">PROVEEDOR</th>
                <th className="px-3 py-3 text-center">RUC</th>
                <th className="px-3 py-3 text-center">N° FACTURA</th>
                <th className="px-3 py-3 text-center">MONEDA</th>
                <th className="px-3 py-3 text-center">MONTO</th>
                <th className="px-3 py-3 text-center">F. EMISIÓN</th>
                <th className="px-3 py-3 text-center">F. VENCIMIENTO</th>
                <th className="px-3 py-3 text-center">DÍAS CRÉDITO</th>
                <th className="px-3 py-3 text-center">STATUS</th>
                <th className="px-3 py-3 text-center">TIPO</th>
                <th className="px-3 py-3 text-center">DESCRIPCIÓN</th>
                <th className="px-3 py-3 text-center">PROYECTO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => {
                const displayAmount = row.amount_with_igv > 0 ? row.amount_with_igv : row.amount;
                // Al contado: misma fecha emisión y vencimiento → 0 días
                // A crédito: calcular diferencia entre fechas
                let creditDays = null;
                if (row.payment_type === 'cash') {
                  creditDays = 0;
                } else if (row.payment_type === 'loan' && row.issue_date && row.due_date) {
                  creditDays = Math.round(
                    (new Date(row.due_date) - new Date(row.issue_date)) /
                    (1000 * 60 * 60 * 24),
                  );
                }

                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {/* MES */}
                    <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap">
                      {row.monthKey ? formatMonthKey(row.monthKey) : '-'}
                    </td>

                    {/* PROVEEDOR */}
                    <td className="px-3 py-2 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
                      {row.seller_name}
                    </td>

                    {/* RUC */}
                    <td className="px-3 py-2 text-center text-sm text-gray-500 whitespace-nowrap">
                      {row.seller_document !== '-' ? row.seller_document : '-'}
                    </td>

                    {/* N° FACTURA */}
                    <td className="px-3 py-2 text-center text-sm text-gray-700 whitespace-nowrap">
                      {row.cdp || '-'}
                    </td>

                    {/* MONEDA */}
                    <td className="px-3 py-2 text-center">
                      <Badge variant={row.currency === 'PEN' ? 'blue' : 'amber'}>
                        {row.currency}
                      </Badge>
                    </td>

                    {/* MONTO */}
                    <td className="px-3 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">
                      {displayAmount > 0 ? formatNumber(displayAmount) : '-'}
                    </td>

                    {/* F. EMISIÓN */}
                    <td className="px-3 py-2 text-center text-sm text-gray-500 whitespace-nowrap">
                      {row.issue_date ? formatDate(row.issue_date) : '-'}
                    </td>

                    {/* F. VENCIMIENTO */}
                    <td className="px-3 py-2 text-center text-sm text-gray-500 whitespace-nowrap">
                      {row.due_date ? formatDate(row.due_date) : '-'}
                    </td>

                    {/* DÍAS CRÉDITO */}
                    <td className="px-3 py-2 text-center text-sm text-gray-500">
                      {creditDays !== null ? creditDays : '-'}
                    </td>

                    {/* STATUS */}
                    <td className="px-3 py-2 text-center">
                      <Badge
                        variant={
                          row.status === 'Por Aprobar'
                            ? 'amber'
                            : row.status === 'Por Pagar'
                              ? 'red'
                              : 'emerald'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>

                    {/* TIPO */}
                    <td className="px-3 py-2 text-center">
                      {row.payment_type ? (
                        <Badge variant={row.payment_type === 'cash' ? 'emerald' : 'purple'}>
                          {row.payment_type === 'cash' ? 'Contado' : 'Crédito'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* DESCRIPCIÓN */}
                    <td className="px-3 py-2 text-center text-sm text-gray-700 max-w-[200px] truncate">
                      {row.order_title || '-'}
                    </td>

                    {/* PROYECTO */}
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap"
                        style={{ background: getProjectColor(row.project_id) }}
                      >
                        {formatProjectDisplay(row)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
