/**
 * @file Hook de lógica del tab "Por Pagar"
 * @module compraskrsft/hooks/useToPayTab
 */
import { useState, useCallback, useMemo } from 'react';
import { getCsrfToken, getLocalDateString, isProjectInProgress } from '../utils';

/**
 * @typedef {Object} UseToPayTabParams
 * @property {Array} orders
 * @property {string} apiBase
 * @property {Function} showToast
 * @property {Function} loadToPayOrders
 * @property {Function} loadPaidBatches
 * @property {number} currentExchangeRate
 * @property {boolean} loadingRate
 * @property {Function} fetchExchangeRate
 */

/**
 * Estado y lógica del tab "Por Pagar":
 * - Filtros, búsqueda, expansión de lotes
 * - Pago individual (PaymentModal) y bulk (BulkPayModal)
 *
 * @param {UseToPayTabParams} ctx
 */
export function useToPayTab(ctx) {
  const {
    orders,
    apiBase,
    showToast,
    loadToPayOrders,
    loadPaidBatches,
    currentExchangeRate,
    fetchExchangeRate,
    permissions = {},
  } = ctx;

  // ── Filters ───────────────────────────────────────────────────────────
  const [toPaySearch, setToPaySearch] = useState('');
  const [toPayFilterProject, setToPayFilterProject] = useState('');
  const [toPayFilterCurrency, setToPayFilterCurrency] = useState('');
  const [toPayFilterPaymentType, setToPayFilterPaymentType] = useState('');
  const [toPayFilterIgv, setToPayFilterIgv] = useState('');
  const [expandedToPayBatches, setExpandedToPayBatches] = useState({});

  // ── Bulk modal state ──────────────────────────────────────────────────
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [prices, setPrices] = useState({});
  const [approving, setApproving] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    seller_name: '',
    seller_document: '',
    currency: 'PEN',
    issue_date: getLocalDateString(),
    payment_type: 'cash',
    date_value: '',
    igv_enabled: false,
    igv_rate: 18.0,
    notes: '',
  });

  // ── Payment modal state ───────────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    cdp_type: '',
    cdp_serie: '',
    cdp_number: '',
    payment_proof: null,
    payment_proof_link: '',
    payment_bank: '',
  });

  // ── Edit credit modal state ───────────────────────────────────────────
  const [showEditCreditModal, setShowEditCreditModal] = useState(false);
  const [editCreditBatch, setEditCreditBatch] = useState(null);
  const [savingCredit, setSavingCredit] = useState(false);

  // ── Batched view (derives from raw orders) ────────────────────────────
  const toPayBatches = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
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
          // Extensión de crédito
          credit_extended_by_name: order.credit_extended_by_name || null,
          credit_extended_at: order.credit_extended_at || null,
          original_due_date: order.original_due_date || null,
          orders: [],
          total: 0,
          total_with_igv: 0,
          total_pen: 0,
          igv_enabled: false,
        };
      }
      const b = map[batchId];
      const orderDueDate = order.due_date || order.payment_due_date || order.credit_due_date || null;
      if (!b.seller_document && order.seller_document) b.seller_document = order.seller_document;
      if (!b.issue_date && order.issue_date) b.issue_date = order.issue_date;
      if (order.payment_type === 'loan') b.payment_type = 'loan';
      if (orderDueDate) {
        if (!b.due_date) {
          b.due_date = orderDueDate;
        } else {
          const currentDue = new Date(b.due_date);
          const nextDue = new Date(orderDueDate);
          if (nextDue < currentDue) b.due_date = orderDueDate;
        }
      }
      const baseAmount = parseFloat(order.amount || 0);
      const igvEnabled = !!order.igv_enabled;
      const igvRate = parseFloat(order.igv_rate ?? 18);

      // Calcular IGV sobre la moneda original (amount), NO sobre amount_pen
      // (order.igv_amount y order.total_with_igv de la BD están en PEN)
      const igvAmount = igvEnabled ? baseAmount * (igvRate / 100) : 0;
      const totalWithIgv = baseAmount + igvAmount;

      order.amount_with_igv = totalWithIgv;
      order.igv_rate = igvRate;
      order.igv_amount = igvAmount;
      order.igv_enabled = igvEnabled;

      b.orders.push(order);
      b.total += baseAmount;
      b.total_with_igv += totalWithIgv;
      // total en PEN para estadísticas globales (S/)
      b.total_pen += parseFloat(order.total_with_igv || order.amount_pen || order.amount || 0);
      if (igvEnabled) b.igv_enabled = true;
    });
    return Object.values(map).sort((a, b2) => new Date(b2.approved_at) - new Date(a.approved_at));
  }, [orders]);

  /** Total consolidado de todas las órdenes por pagar (en PEN para stats) */
  const totalToPayAmount = useMemo(
    () => toPayBatches.reduce((sum, b) => sum + (b.total_pen || 0), 0),
    [toPayBatches],
  );

  const toPayProjects = useMemo(() => {
    const map = {};
    toPayBatches.forEach((batch) => {
      batch.orders.forEach((order) => {
        if (!map[order.project_id]) {
          map[order.project_id] = {
            id: order.project_id,
            name: order.project_name,
                        project_name: order.project_name,
                        project_abbreviation: order.project_abbreviation,
                        ceco_codigo: order.ceco_codigo,
            status: order.project_status,
            estado: order.project_estado,
          };
        }
      });
    });
    return Object.values(map).filter(isProjectInProgress).sort((a, b) => a.name.localeCompare(b.name));
  }, [toPayBatches]);

  const filteredToPayBatches = useMemo(() => {
    let result = toPayBatches;
    if (toPaySearch.trim()) {
      const s = toPaySearch.toLowerCase().trim();
      result = result.filter(
        (b) =>
          (b.seller_name || '').toLowerCase().includes(s) ||
          (b.seller_document || '').toLowerCase().includes(s),
      );
    }
    if (toPayFilterProject) result = result.filter((b) => b.orders.some((o) => o.project_id === toPayFilterProject));
    if (toPayFilterCurrency) result = result.filter((b) => b.currency === toPayFilterCurrency);
    if (toPayFilterPaymentType) result = result.filter((b) => b.payment_type === toPayFilterPaymentType);
    if (toPayFilterIgv) {
      const hasIgv = toPayFilterIgv === 'true';
      result = result.filter((b) => b.igv_enabled === hasIgv);
    }
    return result;
  }, [toPayBatches, toPaySearch, toPayFilterProject, toPayFilterCurrency, toPayFilterPaymentType, toPayFilterIgv]);

  // ── Bulk derived ──────────────────────────────────────────────────────
  const selectedOrderSet = useMemo(() => new Set(selectedOrders), [selectedOrders]);
  const selectedOrdersData = useMemo(() => orders.filter((o) => selectedOrderSet.has(o.id)), [orders, selectedOrderSet]);
  const bulkSubtotal = useMemo(() => selectedOrders.reduce((s, id) => s + (parseFloat(prices[id]) || 0), 0), [selectedOrders, prices]);
  const bulkIgv = bulkForm.igv_enabled ? bulkSubtotal * (bulkForm.igv_rate / 100) : 0;
  const bulkTotal = bulkSubtotal + bulkIgv;
  const bulkTotalPen = bulkForm.currency === 'USD' && currentExchangeRate > 0 ? bulkTotal * currentExchangeRate : bulkTotal;
  const canSubmitBulk = useMemo(() => {
    if (!bulkForm.seller_name) return false;
    if (bulkSubtotal <= 0) return false;
    if (bulkForm.currency === 'USD' && currentExchangeRate <= 0) return false;
    return true;
  }, [bulkForm.seller_name, bulkForm.currency, bulkSubtotal, currentExchangeRate]);

  // ── Callbacks ─────────────────────────────────────────────────────────
  const toggleToPayBatchExpanded = useCallback((batchId) => {
    setExpandedToPayBatches((prev) => {
      const next = { ...prev };
      if (next[batchId]) delete next[batchId];
      else next[batchId] = true;
      return next;
    });
  }, []);

  // Payment modal
  const openPaymentModal = useCallback((batch) => {
    setPaymentBatch(batch);
    setPaymentForm({ cdp_type: '', cdp_serie: '', cdp_number: '', payment_proof: null, payment_proof_link: '', payment_bank: '' });
    setShowPaymentModal(true);
  }, []);

  const closePaymentModal = useCallback(() => {
    setShowPaymentModal(false);
    setPaymentBatch(null);
  }, []);

  const onPaymentProofChange = useCallback((e) => {
    setPaymentForm((prev) => ({ ...prev, payment_proof: e.target.files[0] || null }));
  }, []);

  const confirmPayment = useCallback(async () => {
    setConfirmingPayment(true);
    try {
      const formData = new FormData();
      formData.append('batch_id', paymentBatch.batch_id);
      formData.append('cdp_type', paymentForm.cdp_type);
      formData.append('cdp_serie', paymentForm.cdp_serie);
      formData.append('cdp_number', paymentForm.cdp_number);
      formData.append('payment_bank', paymentForm.payment_bank);
      if (paymentForm.payment_proof_link) formData.append('payment_proof_link', paymentForm.payment_proof_link);
      if (paymentForm.payment_proof) formData.append('payment_proof', paymentForm.payment_proof);
      const res = await fetch(`${apiBase}/pay-batch`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast('Pago confirmado', 'success');
        closePaymentModal();
        await Promise.all([
          loadToPayOrders(),
          permissions.paid_limited ? loadPaidBatches() : Promise.resolve(),
        ]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
    setConfirmingPayment(false);
  }, [apiBase, closePaymentModal, loadPaidBatches, loadToPayOrders, paymentBatch, paymentForm, showToast]);

  // Edit credit modal
  const openEditCreditModal = useCallback((batch) => {
    setEditCreditBatch(batch);
    setShowEditCreditModal(true);
  }, []);

  const closeEditCreditModal = useCallback(() => {
    setShowEditCreditModal(false);
    setEditCreditBatch(null);
  }, []);

  const confirmExtendCredit = useCallback(async (batchId, newDueDate) => {
    setSavingCredit(true);
    try {
      const res = await fetch(`${apiBase}/extend-credit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify({ batch_id: batchId, due_date: newDueDate }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Plazo de crédito extendido correctamente', 'success');
        closeEditCreditModal();
        await loadToPayOrders();
      } else {
        showToast(data.message || 'Error al extender el crédito', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
    setSavingCredit(false);
  }, [apiBase, closeEditCreditModal, loadToPayOrders, showToast]);


  // Bulk modal — showBulkModal is controlled by state
  const openBulkModal = useCallback(() => {
    if (selectedOrders.length > 0) {
      setShowBulkModal(true);
    }
  }, [selectedOrders]);

  const closeBulkModal = useCallback(() => {
    setShowBulkModal(false);
  }, []);

  const toggleOrderSelect = useCallback((orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  }, []);

  const onCurrencyChange = useCallback((newCurrency) => {
    if (newCurrency === 'USD') fetchExchangeRate();
  }, [fetchExchangeRate]);

  const submitBulkApprove = useCallback(async () => {
    if (!canSubmitBulk) return;
    setApproving(true);
    try {
      const payload = {
        order_ids: selectedOrders,
        prices,
        currency: bulkForm.currency,
        seller_name: bulkForm.seller_name,
        seller_document: bulkForm.seller_document,
        issue_date: bulkForm.issue_date,
        payment_type: bulkForm.payment_type,
        payment_date: bulkForm.payment_type === 'cash' ? bulkForm.date_value : null,
        due_date: bulkForm.payment_type === 'loan' ? bulkForm.date_value : null,
        igv_enabled: bulkForm.igv_enabled,
        igv_rate: bulkForm.igv_rate,
        notes: bulkForm.notes,
      };
      const res = await fetch(`${apiBase}/pay-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        closeBulkModal();
        setSelectedOrders([]);
        setPrices({});
        await Promise.all([
          loadToPayOrders(),
          permissions.paid_limited ? loadPaidBatches() : Promise.resolve(),
        ]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
    setApproving(false);
  }, [apiBase, bulkForm, canSubmitBulk, closeBulkModal, loadPaidBatches, loadToPayOrders, prices, selectedOrders, showToast]);

  return {
    // Filters
    toPaySearch, setToPaySearch,
    toPayFilterProject, setToPayFilterProject,
    toPayFilterCurrency, setToPayFilterCurrency,
    toPayFilterPaymentType, setToPayFilterPaymentType,
    toPayFilterIgv, setToPayFilterIgv,
    expandedToPayBatches,
    toggleOrderSelect,
    // Derived
    toPayBatches, toPayProjects, filteredToPayBatches, totalToPayAmount,
    // Bulk
    setSelectedOrders,
    selectedOrders, prices, setPrices,
    showBulkModal, bulkForm, setBulkForm, approving, openBulkModal, closeBulkModal,
    selectedOrdersData, bulkSubtotal, bulkIgv, bulkTotal, bulkTotalPen, canSubmitBulk,
    onCurrencyChange, submitBulkApprove,
    // Payment
    showPaymentModal, paymentBatch, paymentForm, setPaymentForm, confirmingPayment,
    openPaymentModal, closePaymentModal, onPaymentProofChange, confirmPayment,
    // Edit credit
    showEditCreditModal, editCreditBatch, savingCredit,
    openEditCreditModal, closeEditCreditModal, confirmExtendCredit,
    // Batch expand
    toggleToPayBatchExpanded,
  };
}
