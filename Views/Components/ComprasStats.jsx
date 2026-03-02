/**
 * @file Grid de estadísticas del módulo Compras con seguimiento mensual de "Total Pagado".
 *
 * Lógica del contador mensual:
 *  - Filtra los `paidBatches` cuya fecha de pago (`payment_confirmed_at`) pertenece
 *    al mes/año actual y suma sus totales.
 *  - Al inicio de cada mes (primer render con un mes distinto al guardado en localStorage),
 *    guarda automáticamente el total del mes anterior como "GASTOS-MESAÑO".
 *  - El botón de lista abre un modal con el historial de snapshots guardados en localStorage.
 *
 * @module compraskrsft/components/ComprasStats
 */
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ClockIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ListBulletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import StatsCard from './ui/StatsCard';
import { formatNumber } from '../utils';

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

const LS_KEY = 'compras_monthly_snapshots';

function getSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSnapshot(label, total) {
  const snaps = getSnapshots();
  // avoid duplicates for the same label
  const existing = snaps.findIndex((s) => s.label === label);
  if (existing >= 0) {
    snaps[existing] = { label, total, savedAt: new Date().toISOString() };
  } else {
    snaps.push({ label, total, savedAt: new Date().toISOString() });
  }
  localStorage.setItem(LS_KEY, JSON.stringify(snaps));
}

// ── History Modal ────────────────────────────────────────────────────────────

function HistoryModal({ open, onClose }) {
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    if (open) setSnapshots(getSnapshots().reverse());
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-100 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ListBulletIcon className="size-4 text-emerald-600" />
            Historial de Gastos Mensuales
          </h3>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {snapshots.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-400">
              Aún no hay registros guardados.<br />
              <span className="text-xs">Se guardan automáticamente al inicio de cada mes.</span>
            </p>
          ) : (
            snapshots.map((s) => (
              <div key={s.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-gray-700">{s.label}</span>
                <span className="text-sm font-bold text-emerald-700">S/ {formatNumber(s.total)}</span>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   pendingCount: number,
 *   toPayCount: number,
 *   totalToPay: number,
 *   totalPaid: number,
 *   paidBatches: Array,
 * }} props
 */
export default function ComprasStats({ pendingCount, toPayCount, totalToPay, totalPaid, paidBatches = [] }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Monthly total ────────────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  const monthlyPaid = useMemo(() => {
    return paidBatches.reduce((sum, b) => {
      const dateStr = b.payment_confirmed_at || b.paid_at || null;
      if (!dateStr) return sum;
      const d = new Date(dateStr);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        return sum + (b.total_pen || b.total || 0);
      }
      return sum;
    }, 0);
  }, [paidBatches, currentMonth, currentYear]);

  // ── Auto-snapshot: on mount, check if we need to save last month ─────────
  useEffect(() => {
    const LS_LAST = 'compras_last_snapshot_month';
    const lastSaved = localStorage.getItem(LS_LAST);
    const currentKey = `${currentYear}-${currentMonth}`;
    if (lastSaved && lastSaved !== currentKey) {
      // A new month has started since last visit — save the previous month snapshot
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonth = prevDate.getMonth();
      const prevYear = prevDate.getFullYear();
      const prevLabel = `GASTOS-${MONTHS_ES[prevMonth]}-${prevYear}`;
      // We recalculate the previous month total from paidBatches
      const prevTotal = paidBatches.reduce((sum, b) => {
        const dateStr = b.payment_confirmed_at || b.paid_at || null;
        if (!dateStr) return sum;
        const d = new Date(dateStr);
        if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
          return sum + (b.total_pen || b.total || 0);
        }
        return sum;
      }, 0);
      if (prevTotal > 0) saveSnapshot(prevLabel, prevTotal);
    }
    localStorage.setItem(LS_LAST, currentKey);
  }, [paidBatches, currentMonth, currentYear]);

  const monthLabel = `${MONTHS_ES[currentMonth]} ${currentYear}`;

  return (
    <>
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))' }}
      >
        <div className="min-w-0">
          <StatsCard
            title="Pendientes"
            value={pendingCount}
            icon={<ClockIcon className="size-5" />}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>
        <div className="min-w-0">
          <StatsCard
            title="Por Pagar"
            value={toPayCount}
            icon={<BanknotesIcon className="size-5" />}
            iconBg="bg-red-100"
            iconColor="text-red-600"
          />
        </div>
        <div className="min-w-0">
          <StatsCard
            title="Total Por Pagar"
            value={`S/ ${formatNumber(totalToPay)}`}
            icon={<CurrencyDollarIcon className="size-5" />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
        </div>
        <div className="min-w-0">
          <StatsCard
            title={`Total Pagado — ${monthLabel}`}
            value={`S/ ${formatNumber(monthlyPaid)}`}
            icon={<CheckCircleIcon className="size-5" />}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            action={
              <button
                onClick={() => setHistoryOpen(true)}
                title="Ver historial mensual"
                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
              >
                <ListBulletIcon className="size-4" />
              </button>
            }
          />
        </div>
      </section>
    </>
  );
}
