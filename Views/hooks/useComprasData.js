/**
 * @file Hook de datos centrales – carga, caché y polling
 * @module compraskrsft/hooks/useComprasData
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  POLLING_INTERVAL_MS,
  arraysEqual,
  saveToCache,
  loadFromCache,
} from '../utils';
import { hasPermission } from '@/utils/permissions';

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
export function useComprasData({ apiBase, auth }) {
  const permissions = useMemo(() => ({
    view:            hasPermission(auth, 'module.compraskrsft.view'),
    approve:         hasPermission(auth, 'module.compraskrsft.approve'),
    pay:             hasPermission(auth, 'module.compraskrsft.pay'),
    paid_full:       hasPermission(auth, 'module.compraskrsft.paid_full'),
    paid_limited:    hasPermission(auth, 'module.compraskrsft.paid_limited')
                     || hasPermission(auth, 'module.compraskrsft.paid_full'),
    export:          hasPermission(auth, 'module.compraskrsft.export'),
    finalize:        hasPermission(auth, 'module.compraskrsft.finalize'),
  }), [auth]);

  const firstAllowedTab = useMemo(() => {
    if (permissions.view)            return 'pending';
    if (permissions.approve)         return 'quoted';
    if (permissions.pay)             return 'to_pay';
    if (permissions.paid_limited)    return 'paid';
    if (permissions.export)          return 'recopilacion';
    if (permissions.finalize)        return 'contasis';
    return 'pending';
  }, [permissions]);

  const pollingRef = useRef(null);

  // ── Core state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [quotedOrders, setQuotedOrders] = useState([]);
  const [paidBatches, setPaidBatches] = useState([]);
  const [activeTab, setActiveTab] = useState(firstAllowedTab);
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
        if (!res.ok) return;
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

  const loadQuotedOrders = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`${apiBase}/quoted`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          const newOrders = data.orders || [];
          setQuotedOrders((prev) => {
            if (arraysEqual(prev, newOrders)) return prev;
            saveToCache('quotedOrders', newOrders);
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
        if (!res.ok) return;
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
      if (!res.ok) return;
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
              payment_bank: order.payment_bank || null,
              payment_confirmed_by_name: order.payment_confirmed_by_name,
              approved_by_name: order.approved_by_name,
              edited_by_name: order.edited_by_name || null,
              edited_at: order.edited_at || null,
              contasis_verified: !!order.contasis_verified,
              contasis_verified_at: order.contasis_verified_at || null,
              verified_by_name: order.verified_by_name || null,
              // Cancellation / Nota de Crédito fields
              cancellation_status: order.cancellation_status || null,
              nc_type: order.nc_type || null,
              nc_serie: order.nc_serie || null,
              nc_number: order.nc_number || null,
              nc_document: order.nc_document || null,
              nc_document_link: order.nc_document_link || null,
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
    const cachedQuoted = loadFromCache('quotedOrders');
    const cachedToPay = loadFromCache('toPayOrders');
    const cachedPaid = loadFromCache('paidBatches');
    if (cachedPending) setPendingOrders(cachedPending);
    if (cachedQuoted) setQuotedOrders(cachedQuoted);
    if (cachedToPay) setOrders(cachedToPay);
    if (cachedPaid) setPaidBatches(cachedPaid);
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    initFromCache();
    Promise.all([
      permissions.view            ? loadPendingOrders() : Promise.resolve(),
      permissions.approve         ? loadQuotedOrders()  : Promise.resolve(),
      permissions.pay             ? loadToPayOrders()   : Promise.resolve(),
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling (reinicia al cambiar de tab) ────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'pending') loadPendingOrders();
      else if (activeTab === 'quoted') loadQuotedOrders();
      else if (activeTab === 'to_pay') loadToPayOrders();
      else if (activeTab === 'paid') loadPaidBatches();
    }, POLLING_INTERVAL_MS);
    pollingRef.current = interval;
    return () => {
      clearInterval(interval);
      pollingRef.current = null;
    };
  }, [activeTab, loadPendingOrders, loadQuotedOrders, loadToPayOrders, loadPaidBatches]);

  return {
    loading,
    setLoading,
    orders,
    pendingOrders,
    quotedOrders,
    paidBatches,
    activeTab,
    setActiveTab,
    toast,
    setToast,
    showToast,
    goBack,
    loadPendingOrders,
    loadQuotedOrders,
    loadToPayOrders,
    loadPaidBatches,
    permissions,
  };
}
