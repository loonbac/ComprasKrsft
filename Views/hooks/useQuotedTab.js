/**
 * @file Hook de lógica del tab "Por Aprobar" (cotizaciones pendientes de aprobación gerencial)
 * @module compraskrsft/hooks/useQuotedTab
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { getCsrfToken } from '../utils';

/**
 * @typedef {Object} UseQuotedTabParams
 * @property {Array} quotedOrders
 * @property {string} apiBase
 * @property {Function} showToast
 * @property {Function} loadQuotedOrders
 * @property {Function} loadToPayOrders
 * @property {Function} loadPendingOrders
 */

export function useQuotedTab(ctx) {
  const { quotedOrders, apiBase, showToast, loadQuotedOrders, loadToPayOrders, loadPendingOrders, permissions = {} } = ctx;

  // ── State ─────────────────────────────────────────────────────────────
  const [expandedQuotedBatches, setExpandedQuotedBatches] = useState({});
  const [approvingBatchId, setApprovingBatchId] = useState(null);
  const [rejectingBatchId, setRejectingBatchId] = useState(null);

  // ── Batch grouping ────────────────────────────────────────────────────
  const quotedBatches = useMemo(() => {
    const map = {};
    quotedOrders.forEach((order) => {
      const batchId = order.batch_id || `SINGLE-${order.id}`;
      if (!map[batchId]) {
        map[batchId] = {
          batch_id: batchId,
          seller_name: order.seller_name || 'Sin proveedor',
          seller_document: order.seller_document || '',
          currency: order.currency || 'PEN',
          payment_type:
            order.payment_type ||
            (order.due_date || order.payment_due_date || order.credit_due_date ? 'loan' : 'cash'),
          issue_date: order.issue_date || null,
          due_date: order.due_date || order.payment_due_date || order.credit_due_date || null,
          approved_by_name: order.approved_by_name || '',
          approved_at: order.approved_at || order.updated_at || order.created_at,
          orders: [],
          total: 0,
          total_with_igv: 0,
          igv_enabled: false,
        };
      }
      const b = map[batchId];
      if (!b.issue_date && order.issue_date) b.issue_date = order.issue_date;

      const baseAmount = parseFloat(order.amount || 0);
      const igvEnabled = !!order.igv_enabled;
      const igvRate = parseFloat(order.igv_rate ?? 18);
      const igvAmount = igvEnabled ? baseAmount * (igvRate / 100) : 0;
      const totalWithIgv = baseAmount + igvAmount;

      order.amount_with_igv = totalWithIgv;
      order.igv_rate = igvRate;
      order.igv_amount = igvAmount;
      order.igv_enabled = igvEnabled;

      b.orders.push(order);
      b.total += baseAmount;
      b.total_with_igv += totalWithIgv;
      if (igvEnabled) b.igv_enabled = true;
    });
    return Object.values(map).sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
  }, [quotedOrders]);

  // Auto-expand single batch
  useEffect(() => {
    if (quotedBatches.length === 1) {
      setExpandedQuotedBatches({ [quotedBatches[0].batch_id]: true });
    }
  }, [quotedBatches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────
  const toggleBatchExpanded = useCallback((batchId) => {
    setExpandedQuotedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  }, []);

  // ── Aprobación por lote (quoted → to_pay) ─────────────────────────────
  const approveBatch = useCallback(
    async (batch) => {
      const ids = batch.orders.map((o) => o.id);
      setApprovingBatchId(batch.batch_id);
      try {
        const res = await fetch(`${apiBase}/approve-quoted-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
          },
          body: JSON.stringify({ order_ids: ids }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Cotización aprobada — enviada a Por Pagar', 'success');
          await Promise.all([
            loadQuotedOrders(),
            permissions.pay ? loadToPayOrders() : Promise.resolve(),
          ]);
        } else {
          showToast(data.message || 'Error al aprobar', 'error');
        }
      } catch {
        showToast('Error de conexión', 'error');
      }
      setApprovingBatchId(null);
    },
    [apiBase, showToast, loadQuotedOrders, loadToPayOrders],
  );

  // ── Rechazo por lote (quoted → pending) ───────────────────────────────
  const rejectBatch = useCallback(
    async (batch) => {
      const ids = batch.orders.map((o) => o.id);
      setRejectingBatchId(batch.batch_id);
      try {
        const res = await fetch(`${apiBase}/reject-quoted-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
          },
          body: JSON.stringify({ order_ids: ids }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Cotización devuelta a Por Cotizar', 'info');
          await Promise.all([
            loadQuotedOrders(),
            permissions.view ? loadPendingOrders() : Promise.resolve(),
          ]);
        } else {
          showToast(data.message || 'Error al rechazar', 'error');
        }
      } catch {
        showToast('Error de conexión', 'error');
      }
      setRejectingBatchId(null);
    },
    [apiBase, showToast, loadQuotedOrders, loadPendingOrders],
  );

  return {
    quotedBatches,
    expandedQuotedBatches,
    approvingBatchId,
    rejectingBatchId,
    toggleBatchExpanded,
    approveBatch,
    rejectBatch,
  };
}
