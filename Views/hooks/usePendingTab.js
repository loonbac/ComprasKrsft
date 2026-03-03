/**
 * @file Hook de lógica del tab "Por Aprobar" (pendientes)
 * @module compraskrsft/hooks/usePendingTab
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getCsrfToken, getLocalDateString } from '../utils';

/**
 * @typedef {Object} UsePendingTabParams
 * @property {Array} pendingOrders
 * @property {string} apiBase
 * @property {Function} showToast
 * @property {Function} loadPendingOrders
 * @property {Function} loadToPayOrders
 * @property {number} currentExchangeRate
 * @property {boolean} loadingRate
 * @property {Function} fetchExchangeRate
 */

/**
 * Estado y lógica del tab "Por Aprobar":
 * - Selección, expansión de proyectos/listas
 * - Modal de aprobación con precios
 * - Rechazo de órdenes
 *
 * @param {UsePendingTabParams} ctx
 */
export function usePendingTab(ctx) {
  const {
    pendingOrders,
    apiBase,
    showToast,
    loadPendingOrders,
    loadToPayOrders,
    currentExchangeRate,
    loadingRate,
    fetchExchangeRate,
  } = ctx;

  // ── State ─────────────────────────────────────────────────────────────
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedLists, setExpandedLists] = useState({});
  const [approvingPending, setApprovingPending] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalPrices, setApprovalPrices] = useState({});
  const [selectedApprovalIds, setSelectedApprovalIds] = useState([]);
  const selectedApprovalIdsRef = useRef(selectedApprovalIds);
  const [stockAssignments, setStockAssignments] = useState({});
  const stockAssignmentsRef = useRef(stockAssignments);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    seller_name: '',
    seller_document: '',
    payment_type: 'cash',
    currency: 'PEN',
    issue_date: getLocalDateString(),
    due_date: '',
    igv_enabled: false,
    igv_rate: 18.0,
  });

  // ── Sync expansions when pendingOrders change ─────────────────────────
  useEffect(() => {
    if (pendingOrders.length === 0) return;
    // Prune stale selections
    const idSet = new Set(pendingOrders.map((o) => o.id));
    setSelectedPendingIds((prev) => prev.filter((id) => idSet.has(id)));
  }, [pendingOrders]);

  // ── Derived ───────────────────────────────────────────────────────────
  const selectedPendingIdSet = useMemo(() => new Set(selectedPendingIds), [selectedPendingIds]);

  /** @type {{ id: number, name: string, count: number }[]} */
  const pendingProjects = useMemo(() => {
    const map = {};
    pendingOrders.forEach((order) => {
      if (!map[order.project_id]) {
        map[order.project_id] = { 
          id: order.project_id, 
          name: order.project_name,
          project_name: order.project_name,
          project_abbreviation: order.project_abbreviation,
          ceco_codigo: order.ceco_codigo,
          count: 0 
        };
      }
      map[order.project_id].count += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingOrders]);

  // Sincronizar refs para evitar stale closures
  useEffect(() => { selectedApprovalIdsRef.current = selectedApprovalIds; }, [selectedApprovalIds]);
  useEffect(() => { stockAssignmentsRef.current = stockAssignments; }, [stockAssignments]);

  const selectedApprovalIdsSet = useMemo(
    () => new Set(selectedApprovalIds),
    [selectedApprovalIds],
  );

  const selectedApprovalOrdersData = useMemo(
    () => pendingOrders.filter((order) => selectedApprovalIdsSet.has(order.id)),
    [pendingOrders, selectedApprovalIdsSet],
  );

  const approvalCashflowTotal = useMemo(
    () => selectedPendingIds.reduce((sum, id) => sum + (parseFloat(approvalPrices[id]) || 0), 0),
    [approvalPrices, selectedPendingIds],
  );

  const approvalIgv = approvalForm.igv_enabled
    ? approvalCashflowTotal * (approvalForm.igv_rate / 100)
    : 0;

  const approvalTotal = approvalCashflowTotal + approvalIgv;

  const canSubmitApproval = useMemo(() => {
    if (!approvalForm.seller_name) return false;
    if (approvalCashflowTotal <= 0) return false;
    if (approvalForm.currency === 'USD' && currentExchangeRate <= 0) return false;
    return true;
  }, [approvalForm.seller_name, approvalForm.currency, approvalCashflowTotal, currentExchangeRate]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const getListKey = useCallback(
    (projectId, filename) => `${projectId}-${filename || 'manual'}`,
    [],
  );

  const isPendingSelected = useCallback(
    (orderId) => selectedPendingIdSet.has(orderId),
    [selectedPendingIdSet],
  );

  const togglePendingSelect = useCallback((orderId) => {
    setSelectedPendingIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  }, []);

  const toggleProjectExpanded = useCallback((projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  }, []);

  const toggleListExpanded = useCallback(
    (projectId, filename) => {
      const key = getListKey(projectId, filename);
      setExpandedLists((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [getListKey],
  );

  const getProjectLists = useCallback(
    (projectId) => {
      const lists = {};
      pendingOrders
        .filter((order) => order.project_id === projectId)
        .forEach((order) => {
          // Use filename if imported, otherwise separate by type
          const filename = order.source_filename
            || (order.type === 'service' ? 'Servicios Manuales' : 'Órdenes Manuales');
          if (!lists[filename]) lists[filename] = { filename, count: 0 };
          lists[filename].count += 1;
        });
      return Object.values(lists).sort((a, b) => a.filename.localeCompare(b.filename));
    },
    [pendingOrders],
  );

  const getListOrders = useCallback(
    (projectId, filename) =>
      pendingOrders
        .filter((order) => {
          if (order.project_id !== projectId) return false;
          const orderFilename = order.source_filename
            || (order.type === 'service' ? 'Servicios Manuales' : 'Órdenes Manuales');
          return orderFilename === filename;
        })
        .sort((a, b) => {
          const aNum = parseInt(a.item_number, 10);
          const bNum = parseInt(b.item_number, 10);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
          const aItem = (a.item_number || '').toString();
          const bItem = (b.item_number || '').toString();
          if (aItem !== bItem) return aItem.localeCompare(bItem);
          return (a.id || 0) - (b.id || 0);
        }),
    [pendingOrders],
  );

  // ── Modal de Aprobación ───────────────────────────────────────────────
  /**
   * @param {number[]} [overrideIds] — IDs a aprobar; si se omite usa selectedPendingIds.
   */
  const openApprovalModal = useCallback((overrideIds) => {
    const ids = Array.isArray(overrideIds) ? overrideIds : selectedPendingIds;
    if (!ids.length) return;

    setSelectedApprovalIds([...ids]);
    selectedApprovalIdsRef.current = [...ids];
    setApprovalPrices(() => {
      const next = {};
      ids.forEach((id) => {
        next[id] = 0;
      });
      return next;
    });

    const defaultForm = {
      seller_name: '',
      seller_document: '',
      payment_type: 'cash',
      currency: 'PEN',
      issue_date: getLocalDateString(),
      due_date: '',
      igv_enabled: false,
      igv_rate: 18.0,
    };

    if (ids.length === 1) {
      const order = pendingOrders.find((c) => c.id === ids[0]);
      if (order) {
        setApprovalForm({
          ...defaultForm,
          seller_name: order.seller_name || defaultForm.seller_name,
          seller_document: order.seller_document || defaultForm.seller_document,
          payment_type: order.payment_type || defaultForm.payment_type,
          currency: order.currency || defaultForm.currency,
          issue_date: order.issue_date || defaultForm.issue_date,
          due_date:
            order.due_date || order.payment_due_date || order.credit_due_date || defaultForm.due_date,
        });
      } else {
        setApprovalForm({ ...defaultForm });
      }
    } else {
      const ordersForForm = ids
        .map((id) => pendingOrders.find((o) => o.id === id))
        .filter(Boolean);
      const paymentTypes = new Set(ordersForForm.map((o) => o.payment_type).filter(Boolean));
      const currencies = new Set(ordersForForm.map((o) => o.currency).filter(Boolean));
      setApprovalForm((prev) => ({
        ...prev,
        ...defaultForm,
        payment_type: paymentTypes.size === 1 ? ordersForForm[0].payment_type : prev.payment_type,
        currency: currencies.size === 1 ? ordersForForm[0].currency : prev.currency,
      }));
    }

    setShowApprovalModal(true);

    // Si la moneda pre-llenada es USD, obtener tipo de cambio automáticamente
    const resolvedCurrency = ids.length === 1
      ? (pendingOrders.find((c) => c.id === ids[0])?.currency || 'PEN')
      : (() => {
        const ordersForForm = ids.map((id) => pendingOrders.find((o) => o.id === id)).filter(Boolean);
        const currencies = new Set(ordersForForm.map((o) => o.currency).filter(Boolean));
        return currencies.size === 1 ? ordersForForm[0].currency : 'PEN';
      })();
    if (resolvedCurrency === 'USD') fetchExchangeRate();
  }, [pendingOrders, selectedPendingIds, fetchExchangeRate]);

  const closeApprovalModal = useCallback(() => {
    setShowApprovalModal(false);
    setStockAssignments({});
  }, []);

  // ── Búsqueda de inventario ────────────────────────────────────────────
  const searchInventory = useCallback(
    async (orderId, searchText) => {
      try {
        const res = await fetch(
          `${apiBase}/search-inventory?search=${encodeURIComponent(searchText)}`,
          { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getCsrfToken() } },
        );
        const data = await res.json();
        if (data.success && data.items) {
          return data.items
            .map((item) => ({
              id: item.id,
              name: item.name || item.nombre || item.description || item.descripcion || '',
              location: item.location || item.ubicacion || '',
              unitPrice: Math.round(parseFloat(item.unit_price || item.precio_unitario || item.costo_unitario || 0) * 100) / 100,
              available: parseInt(item.stock_available || item.cantidad_disponible || 0, 10),
              currency: item.currency || item.moneda || 'PEN',
              unit: item.unit || item.unidad || 'und',
              expiringSoon: !!item.expiring_soon,
            }))
            .filter((item) => item.available > 0);
        }
        return [];
      } catch {
        return [];
      }
    },
    [apiBase],
  );

  const onApprovalCurrencyChange = useCallback((newCurrency) => {
    if (newCurrency === 'USD') fetchExchangeRate();
  }, [fetchExchangeRate]);

  const submitApprovalPending = useCallback(async () => {
    if (!canSubmitApproval) return;
    setApprovingPending(true);
    try {
      // Leer de refs para evitar stale closures
      const currentIds = selectedApprovalIdsRef.current;
      const currentAssignments = stockAssignmentsRef.current;

      // Transformar stockAssignments a formato backend (splits)
      const splits = {};
      for (const [orderId, assignment] of Object.entries(currentAssignments)) {
        if (assignment && assignment.qty > 0) {
          splits[orderId] = {
            inventory_item_id: assignment.lotId,
            qty_from_inventory: assignment.qty,
            reference_price: assignment.unitPrice || 0,
          };
        }
      }

      const payload = {
        order_ids: currentIds,
        prices: approvalPrices,
        currency: approvalForm.currency,
        seller_name: approvalForm.seller_name,
        seller_document: approvalForm.seller_document,
        payment_type: approvalForm.payment_type,
        issue_date: approvalForm.issue_date,
        due_date: approvalForm.payment_type === 'loan' ? approvalForm.due_date : null,
        igv_enabled: approvalForm.igv_enabled,
        igv_rate: approvalForm.igv_rate,
        splits,
      };
      const res = await fetch(`${apiBase}/mark-to-pay-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Órdenes procesadas', 'success');
        closeApprovalModal();
        setSelectedPendingIds([]);
        setApprovalPrices({});
        await Promise.all([loadPendingOrders(), loadToPayOrders()]);
      } else {
        showToast(data.message || 'Error al aprobar', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al aprobar', 'error');
    }
    setApprovingPending(false);
  }, [
    apiBase,
    approvalForm,
    approvalPrices,
    canSubmitApproval,
    closeApprovalModal,
    loadPendingOrders,
    loadToPayOrders,
    showToast,
  ]);

  const approveSinglePending = useCallback(
    (orderId) => {
      setSelectedPendingIds([orderId]);
      // Pasar ID directamente para evitar stale closures
      openApprovalModal([orderId]);
    },
    [openApprovalModal],
  );

  // ── Rechazo ───────────────────────────────────────────────────────────
  const openRejectModal = useCallback((orderId) => {
    setRejectingOrderId(orderId);
    setShowRejectModal(true);
  }, []);

  const closeRejectModal = useCallback(() => {
    setShowRejectModal(false);
    setRejectingOrderId(null);
  }, []);

  const rejectOrder = useCallback(
    async (id) => {
      openRejectModal(id);
    },
    [openRejectModal],
  );

  const confirmReject = useCallback(async () => {
    if (!rejectingOrderId) return;
    setRejecting(true);
    try {
      const res = await fetch(`${apiBase}/${rejectingOrderId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-TOKEN': getCsrfToken(),
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Orden rechazada', 'success');
        closeRejectModal();
        await Promise.all([loadPendingOrders(), loadToPayOrders()]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch {
      showToast('Error', 'error');
    }
    setRejecting(false);
  }, [apiBase, rejectingOrderId, loadPendingOrders, loadToPayOrders, showToast, closeRejectModal]);

  return {
    // State
    selectedPendingIds,
    setSelectedPendingIds,
    expandedProjects,
    expandedLists,
    approvingPending,
    showApprovalModal,
    approvalForm,
    setApprovalForm,
    approvalPrices,
    setApprovalPrices,
    stockAssignments,
    setStockAssignments,
    showRejectModal,
    rejectingOrderId,
    rejecting,
    // Derived
    pendingProjects,
    selectedApprovalOrdersData,
    approvalCashflowTotal,
    approvalIgv,
    approvalTotal,
    canSubmitApproval,
    // Callbacks
    getListKey,
    isPendingSelected,
    togglePendingSelect,
    toggleProjectExpanded,
    toggleListExpanded,
    getProjectLists,
    getListOrders,
    openApprovalModal,
    closeApprovalModal,
    onApprovalCurrencyChange,
    submitApprovalPending,
    approveSinglePending,
    rejectOrder,
    openRejectModal,
    closeRejectModal,
    confirmReject,
    searchInventory,
  };
}
