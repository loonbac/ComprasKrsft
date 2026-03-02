/**
 * @file Hook de datos centrales – carga, caché y polling
 * @module compraskrsft/hooks/useComprasData
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  POLLING_INTERVAL_MS,
  arraysEqual,
  saveToCache,
  loadFromCache,
} from '../utils';

/**
 * @typedef {Object} UseComprasDataParams
 * @property {string} apiBase - URL base de la API
 */

/**
 * Gestiona el estado global de datos del módulo Compras:
 * - Órdenes pendientes / por pagar / pagadas
 * - Tab activo, toast, loading
 * - Polling automático por tab
 *
 * @param {UseComprasDataParams} params
 */
export function useComprasData({ apiBase }) {
  const pollingRef = useRef(null);

  // ── Core state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [paidBatches, setPaidBatches] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // ── Toast ───────────────────────────────────────────────────────────────
  /** @param {string} message @param {'success'|'error'|'warning'|'info'} [type] */
  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  }, []);

  /** Navega al dashboard principal */
  const goBack = useCallback(() => {
    window.location.href = '/';
  }, []);

  // ── Data loaders ────────────────────────────────────────────────────────
  const loadPendingOrders = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`${apiBase}/pending`);
        const data = await res.json();
        if (data.success) {
          const newOrders = data.orders || [];
          setPendingOrders((prev) => {
            if (arraysEqual(prev, newOrders)) return prev;
            saveToCache('pendingOrders', newOrders);
            return newOrders;
          });
        }
      } catch (e) {
        console.error(e);
      }
      if (showLoading) setLoading(false);
    },
    [apiBase],
  );

  const loadToPayOrders = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`${apiBase}/to-pay`);
        const data = await res.json();
        if (data.success) {
          const newOrders = data.orders || [];
          setOrders((prev) => {
            if (arraysEqual(prev, newOrders)) return prev;
            saveToCache('toPayOrders', newOrders);
            return newOrders;
          });
        }
      } catch (e) {
        console.error(e);
      }
      if (showLoading) setLoading(false);
    },
    [apiBase],
  );

  const loadPaidBatches = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/paid-orders`);
      const data = await res.json();
      if (data.success) {
        const batchMap = {};
        (data.orders || []).forEach((order) => {
          const batchId = order.batch_id || `SINGLE-${order.id}`;
          if (!batchMap[batchId]) {
            batchMap[batchId] = {
              batch_id: batchId,
              seller_name: order.seller_name,
              seller_document: order.seller_document || '',
              currency: order.currency,
              payment_type: order.payment_type || 'cash',
              issue_date: order.issue_date || null,
              due_date: order.due_date || order.payment_due_date || order.credit_due_date || null,
              payment_confirmed_at: order.payment_confirmed_at,
              cdp_type: order.cdp_type,
              cdp_serie: order.cdp_serie,
              cdp_number: order.cdp_number,
              payment_proof: order.payment_proof,
              payment_proof_link: order.payment_proof_link,
              payment_confirmed_by_name: order.payment_confirmed_by_name,
              approved_by_name: order.approved_by_name,
              orders: [],
              total: 0,
              total_pen: 0,
              igv_enabled: false,
            };
          }
          if (order.issue_date && !batchMap[batchId].issue_date) {
            batchMap[batchId].issue_date = order.issue_date;
          }
          if (order.igv_enabled || order.igv_amount > 0) {
            batchMap[batchId].igv_enabled = true;
          }
          batchMap[batchId].orders.push(order);

          // total en moneda original del lote (para display con batch.currency)
          const baseAmt = parseFloat(order.amount || 0);
          const hasIgv = !!order.igv_enabled;
          const rate = parseFloat(order.igv_rate ?? 18);
          const igvOnBase = hasIgv ? baseAmt * (rate / 100) : 0;
          batchMap[batchId].total += baseAmt + igvOnBase;

          // total en PEN (para estadísticas globales en S/)
          batchMap[batchId].total_pen += parseFloat(order.total_with_igv || order.amount_pen || order.amount || 0);
        });
        const newBatches = Object.values(batchMap).sort(
          (a, b) => new Date(b.payment_confirmed_at) - new Date(a.payment_confirmed_at),
        );
        setPaidBatches((prev) => {
          if (arraysEqual(prev, newBatches)) return prev;
          saveToCache('paidBatches', newBatches);
          return newBatches;
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiBase]);

  // ── Cache bootstrap ─────────────────────────────────────────────────────
  const initFromCache = useCallback(() => {
    const cachedPending = loadFromCache('pendingOrders');
    const cachedToPay = loadFromCache('toPayOrders');
    const cachedPaid = loadFromCache('paidBatches');
    if (cachedPending) setPendingOrders(cachedPending);
    if (cachedToPay) setOrders(cachedToPay);
    if (cachedPaid) setPaidBatches(cachedPaid);
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    initFromCache();
    Promise.all([loadPendingOrders(), loadToPayOrders()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling (reinicia al cambiar de tab) ────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'pending') loadPendingOrders();
      else if (activeTab === 'to_pay') loadToPayOrders();
      else if (activeTab === 'paid') loadPaidBatches();
    }, POLLING_INTERVAL_MS);
    pollingRef.current = interval;
    return () => {
      clearInterval(interval);
      pollingRef.current = null;
    };
  }, [activeTab, loadPendingOrders, loadToPayOrders, loadPaidBatches]);

  return {
    loading,
    setLoading,
    orders,
    pendingOrders,
    paidBatches,
    activeTab,
    setActiveTab,
    toast,
    setToast,
    showToast,
    goBack,
    loadPendingOrders,
    loadToPayOrders,
    loadPaidBatches,
  };
}
