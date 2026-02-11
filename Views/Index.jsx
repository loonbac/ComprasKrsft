import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

/* Core ERP base styles */
import '../../../resources/css/Bytewave-theme.css';
import '../../../resources/css/modules-layout.css';
import '../../../resources/css/modules-modal.css';

/* Module-specific styles - Theme MUST be first for CSS variables */
import './compras_theme.css';
import './compras-variables.css';
import './compras-layout.css';
import './compras-table.css';
import './compras-batches.css';
import './compras-form.css';
import './compras-modal.css';
import './compras-pending.css';
import './compras-quickpay.css';
import './compras-filters.css';
import './compras-inventory.css';

const POLLING_INTERVAL_MS = 3000;
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `compras_${CACHE_VERSION}_`;

const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

const saveToCache = (key, data) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn('Cache save error:', e);
  }
};

const loadFromCache = (key) => {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) {
      const { data } = JSON.parse(cached);
      return data;
    }
  } catch (e) {
    console.warn('Cache load error:', e);
  }
  return null;
};

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNumber = (num) =>
  parseFloat(num || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (dateValue) =>
  dateValue
    ? new Date(dateValue).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
      })
    : '';

const getCsrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content || '';

const PROJECT_COLORS = [
  '#0AA4A4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#06b6d4',
  '#6366f1',
  '#84cc16',
];

const getProjectColor = (projectId) => {
  const index = Number(projectId || 0) % PROJECT_COLORS.length;
  return PROJECT_COLORS[index];
};

const isProjectInProgress = (project) => {
  const rawStatus = (project?.status ?? project?.estado ?? '')
    .toString()
    .trim()
    .toLowerCase();
  if (!rawStatus) return true;
  if (
    rawStatus.includes('final') ||
    rawStatus.includes('completed') ||
    rawStatus.includes('closed') ||
    rawStatus.includes('cerrado')
  ) {
    return false;
  }
  return true;
};

const toggleDarkMode = () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  try { localStorage.setItem('darkMode', isDark ? 'true' : 'false'); } catch {}
};

let didInitDarkMode = false;
const initDarkMode = () => {
  if (didInitDarkMode) return;
  didInitDarkMode = true;
  try {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      document.body.classList.add('dark-mode');
    }
  } catch {}
};

// Hoisted SVG icons (Vercel Best Practice: rendering-hoist-jsx)
const AlertIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default function ComprasIndex() {
  const pollingRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(0);
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [paidBatches, setPaidBatches] = useState([]);
  const [projectList, setProjectList] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [prices, setPrices] = useState({});
  const [activeTab, setActiveTab] = useState('pending');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [selectedPendingProjectId, setSelectedPendingProjectId] = useState(null);
  const [selectedPendingListId, setSelectedPendingListId] = useState(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const [approvingPending, setApprovingPending] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalPrices, setApprovalPrices] = useState({});
  const [selectedApprovalIds, setSelectedApprovalIds] = useState([]);
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedLists, setExpandedLists] = useState({});
  const [dismissedPaymentAlerts, setDismissedPaymentAlerts] = useState({});

  const [inventorySearchResults, setInventorySearchResults] = useState({});
  const [inventoryLoading, setInventoryLoading] = useState({});
  const [inventoryExpanded, setInventoryExpanded] = useState({});
  const [inventorySelection, setInventorySelection] = useState({});
  const [inventoryAutoSearched, setInventoryAutoSearched] = useState({});
  const [inventorySplitData, setInventorySplitData] = useState({});

  const perPagePending = 20;
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const [paidFilterStartDate, setPaidFilterStartDate] = useState('');
  const [paidFilterEndDate, setPaidFilterEndDate] = useState('');
  const [expandedPaidBatches, setExpandedPaidBatches] = useState({});

  const [showEditComprobanteModal, setShowEditComprobanteModal] = useState(false);
  const [editComprobanteBatch, setEditComprobanteBatch] = useState(null);
  const [editComprobanteForm, setEditComprobanteForm] = useState({
    cdp_type: '',
    cdp_serie: '',
    cdp_number: '',
    payment_proof: null,
    payment_proof_link: '',
  });
  const [savingComprobante, setSavingComprobante] = useState(false);

  const [exportFilter, setExportFilter] = useState({
    startDate: '',
    endDate: '',
    preset: '30days',
  });

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

  const [paymentForm, setPaymentForm] = useState({
    cdp_type: '',
    cdp_serie: '',
    cdp_number: '',
    payment_proof: null,
    payment_proof_link: '',
  });

  const [showQuickPayModal, setShowQuickPayModal] = useState(false);
  const [quickPayStep, setQuickPayStep] = useState(1);
  const [quickPaySelectedProject, setQuickPaySelectedProject] = useState(null);
  const [quickPayProjects, setQuickPayProjects] = useState([]);
  const [quickPayItems, setQuickPayItems] = useState([]);

  const [toPaySearch, setToPaySearch] = useState('');
  const [toPayFilterProject, setToPayFilterProject] = useState('');
  const [toPayFilterCurrency, setToPayFilterCurrency] = useState('');
  const [toPayFilterPaymentType, setToPayFilterPaymentType] = useState('');
  const [toPayFilterIgv, setToPayFilterIgv] = useState('');
  const [expandedToPayBatches, setExpandedToPayBatches] = useState({});

  const [quickPayApprovalForm, setQuickPayApprovalForm] = useState({
    seller_name: '',
    seller_document: '',
    payment_type: 'cash',
    currency: 'PEN',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
  });
  const [quickPayPaymentForm, setQuickPayPaymentForm] = useState({
    cdp_type: '',
    cdp_serie: '',
    cdp_number: '',
    payment_proof: null,
    payment_proof_link: '',
  });
  const [quickPayMaterialForm, setQuickPayMaterialForm] = useState({
    qty: 1,
    unit: '',
    description: '',
    diameter: '',
    series: '',
    material_type: '',
  });
  const [quickPayLoading, setQuickPayLoading] = useState(false);

  console.log('ComprasKrsft v5.14.0 loaded successfully');

  const apiBase = useMemo(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)/);
    const moduleName = match ? match[1] : 'compraskrsft';
    return `/api/${moduleName}`;
  }, []);

  const quickPayAvailableProjects = useMemo(
    () => quickPayProjects.filter(isProjectInProgress),
    [quickPayProjects]
  );

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterProject) {
      result = result.filter((order) => order.project_id == filterProject);
    }
    if (filterType) {
      result = result.filter((order) => order.type === filterType);
    }
    return result;
  }, [orders, filterProject, filterType]);

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
            (order.due_date || order.payment_due_date || order.credit_due_date
              ? 'loan'
              : 'cash'),
          issue_date: order.issue_date || null,
          due_date:
            order.due_date || order.payment_due_date || order.credit_due_date || null,
          approved_by_name: order.approved_by_name || '',
          approved_at: order.approved_at || order.updated_at || order.created_at,
          orders: [],
          total: 0,
          total_with_igv: 0,
          igv_enabled: false,
        };
      }

      const orderDueDate =
        order.due_date || order.payment_due_date || order.credit_due_date || null;
      if (!map[batchId].seller_document && order.seller_document) {
        map[batchId].seller_document = order.seller_document;
      }
      if (!map[batchId].issue_date && order.issue_date) {
        map[batchId].issue_date = order.issue_date;
      }
      if (order.payment_type === 'loan' || orderDueDate) {
        map[batchId].payment_type = 'loan';
      }
      if (orderDueDate) {
        if (!map[batchId].due_date) {
          map[batchId].due_date = orderDueDate;
        } else {
          const currentDue = new Date(map[batchId].due_date);
          const nextDue = new Date(orderDueDate);
          if (nextDue < currentDue) {
            map[batchId].due_date = orderDueDate;
          }
        }
      }

      const baseAmount = parseFloat(order.amount || 0);
      const igvEnabled = !!order.igv_enabled;
      const igvRate = parseFloat(order.igv_rate ?? 18);
      const igvAmount = igvEnabled
        ? parseFloat(order.igv_amount ?? 0) || baseAmount * (igvRate / 100)
        : 0;
      const totalWithIgv = igvEnabled
        ? parseFloat(order.total_with_igv ?? 0) || baseAmount + igvAmount
        : baseAmount;

      order.amount_with_igv = totalWithIgv;
      order.igv_rate = igvRate;
      order.igv_amount = igvAmount;
      order.igv_enabled = igvEnabled;

      map[batchId].orders.push(order);
      map[batchId].total += baseAmount;
      map[batchId].total_with_igv += totalWithIgv;
      if (igvEnabled) {
        map[batchId].igv_enabled = true;
      }
    });

    return Object.values(map).sort(
      (a, b) => new Date(b.approved_at) - new Date(a.approved_at)
    );
  }, [orders]);

  const toPayProjects = useMemo(() => {
    const map = {};
    toPayBatches.forEach((batch) => {
      batch.orders.forEach((order) => {
        if (!map[order.project_id]) {
          map[order.project_id] = {
            id: order.project_id,
            name: order.project_name,
            status: order.project_status,
            estado: order.project_estado,
          };
        }
      });
    });
    const allProjects = Object.values(map);
    const activeProjects = allProjects.filter(isProjectInProgress);
    return activeProjects.sort((a, b) => a.name.localeCompare(b.name));
  }, [toPayBatches]);

  const filteredToPayBatches = useMemo(() => {
    let result = toPayBatches;

    if (toPaySearch.trim()) {
      const searchLower = toPaySearch.toLowerCase().trim();
      result = result.filter(
        (batch) =>
          (batch.seller_name || '').toLowerCase().includes(searchLower) ||
          (batch.seller_document || '').toLowerCase().includes(searchLower)
      );
    }
    if (toPayFilterProject) {
      result = result.filter((batch) =>
        batch.orders.some((order) => order.project_id === toPayFilterProject)
      );
    }
    if (toPayFilterCurrency) {
      result = result.filter((batch) => batch.currency === toPayFilterCurrency);
    }
    if (toPayFilterPaymentType) {
      result = result.filter(
        (batch) => batch.payment_type === toPayFilterPaymentType
      );
    }
    if (toPayFilterIgv) {
      const hasIgv = toPayFilterIgv === 'true';
      result = result.filter((batch) => batch.igv_enabled === hasIgv);
    }

    return result;
  }, [
    toPayBatches,
    toPaySearch,
    toPayFilterProject,
    toPayFilterCurrency,
    toPayFilterPaymentType,
    toPayFilterIgv,
  ]);

  const pendingProjects = useMemo(() => {
    const map = {};
    pendingOrders.forEach((order) => {
      if (!map[order.project_id]) {
        map[order.project_id] = {
          id: order.project_id,
          name: order.project_name,
          count: 0,
        };
      }
      map[order.project_id].count += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingOrders]);

  const selectedPendingProject = useMemo(() => {
    if (!selectedPendingProjectId) return null;
    return (
      pendingProjects.find((project) => project.id === selectedPendingProjectId) ||
      null
    );
  }, [pendingProjects, selectedPendingProjectId]);

  const pendingLists = useMemo(() => {
    if (!selectedPendingProjectId) return [];
    const lists = {};
    pendingOrders
      .filter((order) => order.project_id === selectedPendingProjectId)
      .forEach((order) => {
        const filename = order.source_filename || 'Manual';
        if (!lists[filename]) {
          lists[filename] = { filename, count: 0 };
        }
        lists[filename].count += 1;
      });
    return Object.values(lists).sort((a, b) => a.filename.localeCompare(b.filename));
  }, [pendingOrders, selectedPendingProjectId]);

  const selectedPendingList = useMemo(() => {
    if (!selectedPendingListId) return null;
    return (
      pendingLists.find((list) => list.filename === selectedPendingListId) || null
    );
  }, [pendingLists, selectedPendingListId]);

  const selectedPendingOrders = useMemo(() => {
    if (!selectedPendingProjectId || !selectedPendingListId) return [];
    return pendingOrders.filter(
      (order) =>
        order.project_id === selectedPendingProjectId &&
        (order.source_filename || 'Manual') === selectedPendingListId
    );
  }, [pendingOrders, selectedPendingProjectId, selectedPendingListId]);

  const totalPagesPending =
    Math.ceil(selectedPendingOrders.length / perPagePending) || 1;

  const paginatedPendingOrders = useMemo(() => {
    const start = (currentPagePending - 1) * perPagePending;
    return selectedPendingOrders.slice(start, start + perPagePending);
  }, [selectedPendingOrders, currentPagePending, perPagePending]);

  // Derived Sets for O(1) lookups (Rule 7.11)
  const selectedPendingIdSet = useMemo(
    () => new Set(selectedPendingIds),
    [selectedPendingIds]
  );
  const selectedOrderSet = useMemo(
    () => new Set(selectedOrders),
    [selectedOrders]
  );

  const pendingListAllSelected = useMemo(() => {
    if (!selectedPendingListId) return false;
    const ids = selectedPendingOrders.map((order) => order.id);
    return ids.length > 0 && ids.every((id) => selectedPendingIdSet.has(id));
  }, [selectedPendingListId, selectedPendingOrders, selectedPendingIdSet]);

  const totalPages =
    Math.ceil(filteredOrders.length / perPage) || 1;

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredOrders.slice(start, start + perPage);
  }, [filteredOrders, currentPage, perPage]);

  const allSelected = useMemo(
    () =>
      paginatedOrders.length > 0 &&
      paginatedOrders.every((order) => selectedOrderSet.has(order.id)),
    [paginatedOrders, selectedOrderSet]
  );

  const allToPaySelected = useMemo(() => {
    if (filteredOrders.length === 0) return false;
    return filteredOrders.every((order) => selectedOrderSet.has(order.id));
  }, [filteredOrders, selectedOrderSet]);

  const selectedApprovalOrdersData = useMemo(
    () => pendingOrders.filter((order) => selectedPendingIdSet.has(order.id)),
    [pendingOrders, selectedPendingIdSet]
  );

  const selectedOrdersData = useMemo(
    () => orders.filter((order) => selectedOrderSet.has(order.id)),
    [orders, selectedOrderSet]
  );

  const bulkSubtotal = useMemo(
    () =>
      selectedOrders.reduce(
        (sum, id) => sum + (parseFloat(prices[id]) || 0),
        0
      ),
    [selectedOrders, prices]
  );

  const bulkIgv = bulkForm.igv_enabled ? bulkSubtotal * (bulkForm.igv_rate / 100) : 0;

  const bulkTotal = bulkSubtotal + bulkIgv;

  const bulkTotalPen =
    bulkForm.currency === 'USD' && currentExchangeRate > 0
      ? bulkTotal * currentExchangeRate
      : bulkTotal;

  const approvalSubtotal = useMemo(
    () =>
      selectedPendingIds.reduce(
        (sum, id) => sum + (parseFloat(approvalPrices[id]) || 0),
        0
      ),
    [selectedPendingIds, approvalPrices]
  );

  const approvalIgv =
    approvalForm.igv_enabled
      ? approvalSubtotal * (approvalForm.igv_rate / 100)
      : 0;

  const approvalTotal = approvalSubtotal + approvalIgv;

  const canSubmitApproval = useMemo(() => {
    if (!approvalForm.seller_name) return false;
    const allFromInventory = selectedPendingIds.every((id) => {
      const selection = inventorySelection[id];
      return selection && selection.type === 'inventory';
    });
    if (!allFromInventory && approvalSubtotal <= 0) return false;
    if (approvalForm.currency === 'USD' && currentExchangeRate <= 0) return false;
    return true;
  }, [
    approvalForm.seller_name,
    approvalForm.currency,
    approvalSubtotal,
    currentExchangeRate,
    inventorySelection,
    selectedPendingIds,
  ]);

  const canSubmitBulk = useMemo(() => {
    if (!bulkForm.seller_name) return false;
    if (bulkSubtotal <= 0) return false;
    if (bulkForm.currency === 'USD' && currentExchangeRate <= 0) return false;
    return true;
  }, [bulkForm.seller_name, bulkForm.currency, bulkSubtotal, currentExchangeRate]);

  const filteredPaidBatches = useMemo(() => {
    if (!paidFilterStartDate && !paidFilterEndDate) {
      return paidBatches;
    }

    return paidBatches.filter((batch) => {
      const paymentDate = new Date(batch.payment_confirmed_at);
      paymentDate.setHours(0, 0, 0, 0);

      if (paidFilterStartDate) {
        const startDate = new Date(paidFilterStartDate);
        startDate.setHours(0, 0, 0, 0);
        if (paymentDate < startDate) return false;
      }

      if (paidFilterEndDate) {
        const endDate = new Date(paidFilterEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (paymentDate > endDate) return false;
      }

      return true;
    });
  }, [paidBatches, paidFilterStartDate, paidFilterEndDate]);

  const goBack = useCallback(() => {
    window.location.href = '/';
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  }, []);

  const getOrderTitle = useCallback((order) => {
    if (order.type === 'service') return order.description;
    if (order.materials?.length > 0) {
      const mat = order.materials[0];
      return typeof mat === 'object' ? mat.name : mat;
    }
    return order.description;
  }, []);

  const batchAllDelivered = useCallback(
    (batch) => batch.orders?.every((order) => order.delivery_confirmed) || false,
    []
  );

  const getDaysUntilDue = useCallback((dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const getPaymentAlertStatus = useCallback(
    (batch) => {
      const daysRemaining = getDaysUntilDue(batch.due_date);
      if (daysRemaining === null) return null;
      if (daysRemaining < 0) return 'overdue';
      if (daysRemaining === 0) return 'today';
      if (daysRemaining <= 3) return 'urgent';
      if (daysRemaining <= 7) return 'warning';
      return 'normal';
    },
    [getDaysUntilDue]
  );

  const getAlertLabel = useCallback(
    (batch) => {
      const daysRemaining = getDaysUntilDue(batch.due_date);
      if (daysRemaining === null) return '';
      if (daysRemaining < 0) {
        return `Vencido hace ${Math.abs(daysRemaining)} días`;
      }
      if (daysRemaining === 0) return 'Vence HOY';
      return `Vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`;
    },
    [getDaysUntilDue]
  );

  const getPaymentTypeLabel = useCallback(
    (batch) => {
      if (batch.payment_type === 'loan') {
        const dueLabel = getAlertLabel(batch);
        return dueLabel ? `Crédito · ${dueLabel}` : 'Crédito';
      }
      return 'Contado';
    },
    [getAlertLabel]
  );

  const getOrderQty = useCallback((order) => {
    if (order.type === 'service') return '-';
    if (order.materials?.length > 0) {
      const mat = order.materials[0];
      if (typeof mat === 'object' && mat.qty) return mat.qty;
    }
    return '-';
  }, []);

  const getOrderQtyNum = useCallback((order) => {
    if (order.type === 'service') return 1;
    if (order.materials?.length > 0) {
      const mat = order.materials[0];
      if (typeof mat === 'object' && mat.qty) return parseInt(mat.qty, 10) || 1;
    }
    return 1;
  }, []);

  const selectPendingProject = useCallback((projectId) => {
    setSelectedPendingProjectId(projectId);
    setSelectedPendingListId(null);
    setCurrentPagePending(1);
  }, []);

  const selectPendingList = useCallback((filename) => {
    setSelectedPendingListId(filename);
    setCurrentPagePending(1);
  }, []);

  const selectAllPendingList = useCallback(() => {
    if (!selectedPendingListId) return;
    const ids = selectedPendingOrders.map((order) => order.id);
    const idSet = new Set(ids);
    if (pendingListAllSelected) {
      setSelectedPendingIds((prev) => prev.filter((id) => !idSet.has(id)));
    } else {
      setSelectedPendingIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }, [pendingListAllSelected, selectedPendingListId, selectedPendingOrders]);

  const pendingProjectAllSelected = useMemo(() => {
    if (!selectedPendingProjectId) return false;
    const ids = pendingOrders
      .filter((order) => order.project_id === selectedPendingProjectId)
      .map((order) => order.id);
    return ids.length > 0 && ids.every((id) => selectedPendingIdSet.has(id));
  }, [pendingOrders, selectedPendingProjectId, selectedPendingIdSet]);

  const autoSearchInventoryForAll = useCallback(async () => {
    const ordersToSearch = selectedApprovalIds
      .map((id) => pendingOrders.find((order) => order.id === id))
      .filter(Boolean);

    const promises = ordersToSearch
      .filter((order) => order.type === 'material')
      .map(async (order) => {
        if (inventoryAutoSearched[order.id]) return;
        setInventoryAutoSearched((prev) => ({ ...prev, [order.id]: true }));
        setInventoryLoading((prev) => ({ ...prev, [order.id]: true }));
        try {
          const searchTerm = order.description || getOrderTitle(order);
          const res = await fetch(
            `${apiBase}/search-inventory?search=${encodeURIComponent(
              searchTerm
            )}&project_id=${order.project_id}`
          );
          const data = await res.json();
          if (data.success) {
            setInventorySearchResults((prev) => ({
              ...prev,
              [order.id]: data.items || [],
            }));
          } else {
            setInventorySearchResults((prev) => ({ ...prev, [order.id]: [] }));
          }
        } catch (e) {
          setInventorySearchResults((prev) => ({ ...prev, [order.id]: [] }));
        }
        setInventoryLoading((prev) => ({ ...prev, [order.id]: false }));
      });

    await Promise.all(promises);
  }, [
    apiBase,
    getOrderTitle,
    inventoryAutoSearched,
    pendingOrders,
    selectedApprovalIds,
  ]);

  const openApprovalModal = useCallback(() => {
    setSelectedApprovalIds([...selectedPendingIds]);
    setApprovalPrices(() => {
      const next = {};
      selectedPendingIds.forEach((id) => {
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

    if (selectedPendingIds.length === 1) {
      const order = pendingOrders.find(
        (candidate) => candidate.id === selectedPendingIds[0]
      );
      if (order) {
        setApprovalForm({
          ...defaultForm,
          seller_name: order.seller_name || defaultForm.seller_name,
          seller_document: order.seller_document || defaultForm.seller_document,
          payment_type: order.payment_type || defaultForm.payment_type,
          currency: order.currency || defaultForm.currency,
          issue_date: order.issue_date || defaultForm.issue_date,
          due_date:
            order.due_date ||
            order.payment_due_date ||
            order.credit_due_date ||
            defaultForm.due_date,
        });
      } else {
        setApprovalForm({ ...defaultForm });
      }
    } else {
      const ordersForForm = selectedPendingIds
        .map((id) => pendingOrders.find((order) => order.id === id))
        .filter(Boolean);
      const paymentTypes = new Set(
        ordersForForm.map((order) => order.payment_type).filter(Boolean)
      );
      const currencies = new Set(
        ordersForForm.map((order) => order.currency).filter(Boolean)
      );

      setApprovalForm((prev) => ({
        ...prev,
        ...defaultForm,
        payment_type: paymentTypes.size === 1 ? ordersForForm[0].payment_type : prev.payment_type,
        currency: currencies.size === 1 ? ordersForForm[0].currency : prev.currency,
      }));
    }

    setShowApprovalModal(true);
    autoSearchInventoryForAll();
  }, [
    autoSearchInventoryForAll,
    pendingOrders,
    selectedPendingIds,
  ]);

  const closeApprovalModal = useCallback(() => {
    setShowApprovalModal(false);
    setInventorySearchResults({});
    setInventoryLoading({});
    setInventoryExpanded({});
    setInventorySelection({});
    setInventoryAutoSearched({});
    setInventorySplitData({});
  }, []);

  const searchInventoryForOrder = useCallback(
    async (order) => {
      const orderId = order.id;
      setInventoryLoading((prev) => ({ ...prev, [orderId]: true }));
      setInventoryExpanded((prev) => ({ ...prev, [orderId]: true }));

      try {
        const searchTerm = order.description || getOrderTitle(order);
        const res = await fetch(
          `${apiBase}/search-inventory?search=${encodeURIComponent(
            searchTerm
          )}&project_id=${order.project_id}`
        );
        const data = await res.json();

        if (data.success) {
          setInventorySearchResults((prev) => ({
            ...prev,
            [orderId]: data.items || [],
          }));
        } else {
          setInventorySearchResults((prev) => ({ ...prev, [orderId]: [] }));
          showToast(data.message || 'Error al buscar en inventario', 'error');
        }
      } catch (e) {
        console.error('Error searching inventory:', e);
        setInventorySearchResults((prev) => ({ ...prev, [orderId]: [] }));
        showToast('Error al consultar inventario', 'error');
      }

      setInventoryLoading((prev) => ({ ...prev, [orderId]: false }));
    },
    [apiBase, getOrderTitle, showToast]
  );

  const hasInventoryMatch = useCallback(
    (orderId) => {
      const results = inventorySearchResults[orderId];
      return results && results.length > 0 && results.some((item) => item.disponible);
    },
    [inventorySearchResults]
  );

  const getBestInventoryMatch = useCallback(
    (orderId) => {
      const results = inventorySearchResults[orderId];
      if (!results || results.length === 0) return null;
      return results.find((item) => item.disponible) || null;
    },
    [inventorySearchResults]
  );

  const selectInventoryItem = useCallback(
    (orderId, item, orderQty) => {
      const qtyNeeded = parseInt(orderQty, 10) || 1;
      const qtyAvailable = item.cantidad_disponible;

      if (qtyAvailable >= qtyNeeded) {
        const totalPrice = item.costo_unitario * qtyNeeded;

        setInventorySelection((prev) => ({
          ...prev,
          [orderId]: {
            type: 'inventory',
            itemId: item.id,
            itemName: item.nombre,
            qtyUsed: qtyNeeded,
            qtyNeeded,
            unitCost: item.costo_unitario,
            totalPrice,
            moneda: item.moneda,
            stockAvailable: qtyAvailable,
          },
        }));

        setApprovalPrices((prev) => ({ ...prev, [orderId]: 0 }));
        setInventorySplitData((prev) => ({
          ...prev,
          [orderId]: {
            inventory_item_id: item.id,
            qty_from_inventory: qtyNeeded,
            qty_to_buy: 0,
            reference_price: parseFloat(totalPrice.toFixed(2)),
            source_type: 'inventory',
          },
        }));

        setInventoryExpanded((prev) => ({ ...prev, [orderId]: false }));
        showToast(`✅ ${qtyNeeded} unidades cubiertas con inventario`, 'success');
      } else {
        const qtyFromInventory = qtyAvailable;
        const qtyToBuy = qtyNeeded - qtyAvailable;
        const inventoryRefPrice = item.costo_unitario * qtyFromInventory;

        setInventorySelection((prev) => ({
          ...prev,
          [orderId]: {
            type: 'split',
            itemId: item.id,
            itemName: item.nombre,
            qtyUsed: qtyFromInventory,
            qtyNeeded,
            qtyToBuy,
            unitCost: item.costo_unitario,
            referencePrice: inventoryRefPrice,
            budgetTotalInput: parseFloat(
              (item.costo_unitario * qtyNeeded).toFixed(2)
            ),
            moneda: item.moneda,
            stockAvailable: qtyAvailable,
          },
        }));

        setApprovalPrices((prev) => ({ ...prev, [orderId]: 0 }));
        setInventorySplitData((prev) => ({
          ...prev,
          [orderId]: {
            inventory_item_id: item.id,
            qty_from_inventory: qtyFromInventory,
            qty_to_buy: qtyToBuy,
            reference_price: parseFloat(inventoryRefPrice.toFixed(2)),
            source_type: 'split',
          },
        }));

        setInventoryExpanded((prev) => ({ ...prev, [orderId]: false }));
        showToast(`📦 ${qtyFromInventory} de inventario + ${qtyToBuy} a comprar`, 'success');
      }
    },
    [showToast]
  );

  const updateInventoryUsage = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      if (!selection) return;

      const order = pendingOrders.find((candidate) => candidate.id === orderId);
      if (!order) return;

      const qtyNeeded = getOrderQtyNum(order);
      let requestedQty = parseFloat(selection.qtyUsed);

      if (Number.isNaN(requestedQty)) requestedQty = 0;

      const maxStock = selection.stockAvailable;
      if (requestedQty > maxStock) requestedQty = maxStock;
      if (requestedQty > qtyNeeded) requestedQty = qtyNeeded;
      if (requestedQty < 0) requestedQty = 0;

      setInventorySelection((prev) => {
        const next = { ...prev };
        const nextSelection = { ...next[orderId], qtyUsed: requestedQty };

        if (requestedQty >= qtyNeeded) {
          nextSelection.type = 'inventory';
          nextSelection.qtyToBuy = 0;
          nextSelection.totalPrice = nextSelection.unitCost * requestedQty;

          setApprovalPrices((pricesPrev) => ({ ...pricesPrev, [orderId]: 0 }));
          setInventorySplitData((splitPrev) => ({
            ...splitPrev,
            [orderId]: {
              inventory_item_id: nextSelection.itemId,
              qty_from_inventory: requestedQty,
              qty_to_buy: 0,
              reference_price: parseFloat(
                (nextSelection.unitCost * requestedQty).toFixed(2)
              ),
              source_type: 'inventory',
            },
          }));
        } else {
          nextSelection.type = 'split';
          nextSelection.qtyToBuy = parseFloat(
            (qtyNeeded - requestedQty).toFixed(2)
          );
          nextSelection.referencePrice = nextSelection.unitCost * requestedQty;

          if (nextSelection.budgetTotalInput === undefined) {
            nextSelection.budgetTotalInput = parseFloat(
              (nextSelection.unitCost * qtyNeeded).toFixed(2)
            );
          }

          setInventorySplitData((splitPrev) => ({
            ...splitPrev,
            [orderId]: {
              inventory_item_id: nextSelection.itemId,
              qty_from_inventory: requestedQty,
              qty_to_buy: nextSelection.qtyToBuy,
              reference_price: parseFloat(
                nextSelection.referencePrice.toFixed(2)
              ),
              source_type: 'split',
            },
          }));
        }

        next[orderId] = nextSelection;
        return next;
      });
    },
    [getOrderQtyNum, inventorySelection, pendingOrders]
  );

  const updateReferencePrice = useCallback(() => {}, []);

  const selectNewPurchase = useCallback((orderId) => {
    setInventorySelection((prev) => ({
      ...prev,
      [orderId]: {
        type: 'new',
        itemId: null,
      },
    }));
    setApprovalPrices((prev) => ({ ...prev, [orderId]: 0 }));
    setInventorySplitData((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setInventoryExpanded((prev) => ({ ...prev, [orderId]: false }));
  }, []);

  const clearInventorySelection = useCallback((orderId) => {
    setInventorySelection((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setInventorySplitData((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setApprovalPrices((prev) => ({ ...prev, [orderId]: 0 }));
    setInventoryExpanded((prev) => ({ ...prev, [orderId]: false }));
  }, []);

  const isInventoryItemSelected = useCallback(
    (orderId, itemId) => {
      const selection = inventorySelection[orderId];
      return (
        selection &&
        (selection.type === 'inventory' || selection.type === 'split') &&
        selection.itemId === itemId
      );
    },
    [inventorySelection]
  );

  const isNewPurchaseSelected = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      return selection && selection.type === 'new';
    },
    [inventorySelection]
  );

  const isPriceLocked = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      return selection && selection.type === 'inventory';
    },
    [inventorySelection]
  );

  const isSplitActive = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      return selection && selection.type === 'split';
    },
    [inventorySelection]
  );

  const getSplitInfo = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      if (!selection || selection.type !== 'split') return null;
      return {
        qtyFromInventory: selection.qtyUsed,
        qtyToBuy: selection.qtyToBuy,
        totalNeeded: selection.qtyNeeded,
        unitCost: selection.unitCost,
        referencePrice: selection.referencePrice,
        itemName: selection.itemName,
      };
    },
    [inventorySelection]
  );

  const getProjectBudgetCost = useCallback(
    (orderId) => {
      const selection = inventorySelection[orderId];
      const purchasePrice = parseFloat(approvalPrices[orderId]) || 0;

      if (!selection) return purchasePrice;

      if (selection.type === 'inventory') {
        return selection.totalPrice || 0;
      }
      if (selection.type === 'split') {
        if (selection.budgetTotalInput !== undefined) {
          return selection.budgetTotalInput || 0;
        }
        return purchasePrice + (selection.referencePrice || 0);
      }
      return purchasePrice;
    },
    [approvalPrices, inventorySelection]
  );

  const approvalBudgetTotal = useMemo(
    () => selectedPendingIds.reduce((sum, id) => sum + getProjectBudgetCost(id), 0),
    [getProjectBudgetCost, selectedPendingIds]
  );

  const approvalCashflowTotal = useMemo(
    () =>
      selectedPendingIds.reduce(
        (sum, id) => sum + (parseFloat(approvalPrices[id]) || 0),
        0
      ),
    [approvalPrices, selectedPendingIds]
  );

  const onApprovalCurrencyChange = useCallback(() => {
    if (approvalForm.currency === 'USD') {
      fetchExchangeRate();
    }
  }, [approvalForm.currency]);

  const submitApprovalPending = useCallback(async () => {
    if (!canSubmitApproval) return;
    setApprovingPending(true);
    try {
      const inventorySplitsPayload = {};
      selectedApprovalIds.forEach((orderId) => {
        const splitData = inventorySplitData[orderId];
        const selection = inventorySelection[orderId];

        if (splitData) {
          if (selection && selection.type === 'split' && selection.budgetTotalInput !== undefined) {
            const purchasePrice = parseFloat(approvalPrices[orderId] || 0);
            const totalBudget = parseFloat(selection.budgetTotalInput || 0);
            let inventoryPart = totalBudget - purchasePrice;
            if (inventoryPart < 0) inventoryPart = 0;
            splitData.reference_price = parseFloat(inventoryPart.toFixed(2));
          }

          inventorySplitsPayload[orderId] = splitData;
        }
      });

      const payload = {
        order_ids: selectedApprovalIds,
        prices: approvalPrices,
        inventory_splits: inventorySplitsPayload,
        currency: approvalForm.currency,
        seller_name: approvalForm.seller_name,
        seller_document: approvalForm.seller_document,
        payment_type: approvalForm.payment_type,
        issue_date: approvalForm.issue_date,
        due_date: approvalForm.payment_type === 'loan' ? approvalForm.due_date : null,
        igv_enabled: approvalForm.igv_enabled,
        igv_rate: approvalForm.igv_rate,
      };

      const res = await fetch(`${apiBase}/mark-to-pay-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        let msg = data.message || 'Órdenes procesadas';
        if (data.inventory_count > 0) {
          msg += ` (${data.inventory_count} de inventario)`;
        }
        showToast(msg, 'success');
        closeApprovalModal();
        setSelectedPendingIds([]);
        setApprovalPrices({});
        await Promise.all([loadPendingOrders(), loadToPayOrders()]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      showToast('Error', 'error');
    }
    setApprovingPending(false);
  }, [
    apiBase,
    approvalForm,
    approvalPrices,
    canSubmitApproval,
    closeApprovalModal,
    inventorySelection,
    inventorySplitData,
    selectedApprovalIds,
    showToast,
  ]);

  const markToPay = useCallback(async (id, options = {}) => {
    const { silent = false } = options;
    try {
      const res = await fetch(`${apiBase}/${id}/mark-to-pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
      });
      const data = await res.json();
      if (data.success) {
        if (!silent) {
          showToast(data.message || 'Orden enviada a Por Pagar', 'success');
          await Promise.all([loadPendingOrders(), loadToPayOrders()]);
        }
        setSelectedPendingIds((prev) => prev.filter((pid) => pid !== id));
      } else if (!silent) {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      if (!silent) showToast('Error', 'error');
    }
  }, [apiBase, showToast]);

  const approveSelectedPending = useCallback(() => {
    if (selectedPendingIds.length === 0) return;
    openApprovalModal();
  }, [openApprovalModal, selectedPendingIds.length]);

  const approveSinglePending = useCallback(
    (orderId) => {
      setSelectedPendingIds([orderId]);
      openApprovalModal();
    },
    [openApprovalModal]
  );

  const isPendingSelected = useCallback(
    (orderId) => selectedPendingIdSet.has(orderId),
    [selectedPendingIdSet]
  );

  const togglePendingSelect = useCallback((orderId) => {
    setSelectedPendingIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }, []);

  const getListKey = useCallback(
    (projectId, filename) => `${projectId}-${filename || 'manual'}`,
    []
  );

  const toggleProjectExpanded = useCallback((projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  }, []);

  const toggleListExpanded = useCallback(
    (projectId, filename) => {
      const key = getListKey(projectId, filename);
      setExpandedLists((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [getListKey]
  );

  const getProjectLists = useCallback(
    (projectId) => {
      const lists = {};
      pendingOrders
        .filter((order) => order.project_id === projectId)
        .forEach((order) => {
          const filename = order.source_filename || 'Manual';
          if (!lists[filename]) {
            lists[filename] = { filename, count: 0 };
          }
          lists[filename].count += 1;
        });
      return Object.values(lists).sort((a, b) => a.filename.localeCompare(b.filename));
    },
    [pendingOrders]
  );

  const getListOrders = useCallback(
    (projectId, filename) =>
      pendingOrders
        .filter(
          (order) =>
            order.project_id === projectId &&
            (order.source_filename || 'Manual') === filename
        )
        .sort((a, b) => {
          const aNum = parseInt(a.item_number, 10);
          const bNum = parseInt(b.item_number, 10);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return aNum - bNum;
          }
          const aItem = (a.item_number || '').toString();
          const bItem = (b.item_number || '').toString();
          if (aItem !== bItem) return aItem.localeCompare(bItem);
          return (a.id || 0) - (b.id || 0);
        }),
    [pendingOrders]
  );

  const isListAllSelected = useCallback(
    (projectId, filename) => {
      const ordersInList = getListOrders(projectId, filename);
      if (ordersInList.length === 0) return false;
      return ordersInList.every((order) => isPendingSelected(order.id));
    },
    [getListOrders, isPendingSelected]
  );

  const toggleListAllSelect = useCallback(
    (projectId, filename) => {
      const ordersInList = getListOrders(projectId, filename);
      const allSelected = isListAllSelected(projectId, filename);
      const listIds = new Set(ordersInList.map((order) => order.id));

      setSelectedPendingIds((prev) => {
        if (allSelected) {
          return prev.filter((id) => !listIds.has(id));
        }
        return Array.from(new Set([...prev, ...listIds]));
      });
    },
    [getListOrders, isListAllSelected]
  );

  const selectAllPending = useCallback(() => {
    const allIds = pendingOrders.map((order) => order.id);
    setSelectedPendingIds((prev) => Array.from(new Set([...prev, ...allIds])));
  }, [pendingOrders]);

  const deselectAllPending = useCallback(() => {
    setSelectedPendingIds([]);
  }, []);

  const dismissPaymentAlert = useCallback((batchId) => {
    setDismissedPaymentAlerts((prev) => ({ ...prev, [batchId]: true }));
  }, []);

  // ── Data Loading ──────────────────────────────────────────────────────

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

            // Auto-expand all projects & lists
            if (newOrders.length > 0) {
              const projects = new Set(newOrders.map((o) => o.project_id));
              setExpandedProjects((ep) => {
                const next = { ...ep };
                projects.forEach((pid) => { next[pid] = true; });
                return next;
              });
              setExpandedLists((el) => {
                const next = { ...el };
                projects.forEach((pid) => {
                  const filenames = new Set(
                    newOrders
                      .filter((o) => o.project_id === pid)
                      .map((o) => o.source_filename || 'Manual')
                  );
                  filenames.forEach((fn) => {
                    next[`${pid}-${fn}`] = true;
                  });
                });
                return next;
              });
            }

            return newOrders;
          });

          // Reconcile selectedPendingProjectId
          setSelectedPendingProjectId((prev) => {
            if (!prev && newOrders.length > 0) return newOrders[0].project_id;
            if (prev && newOrders.length > 0 && !newOrders.some((o) => o.project_id === prev)) {
              setSelectedPendingListId(null);
              return newOrders[0].project_id;
            }
            return prev;
          });

          // Prune stale selections
          const pendingIdSet = new Set(newOrders.map((o) => o.id));
          setSelectedPendingIds((prev) => prev.filter((id) => pendingIdSet.has(id)));
        }
      } catch (e) {
        console.error(e);
      }
      if (showLoading) setLoading(false);
    },
    [apiBase]
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
            // Extract unique projects for filters
            const projects = {};
            newOrders.forEach((o) => {
              projects[o.project_id] = { id: o.project_id, name: o.project_name };
            });
            setProjectList(
              Object.values(projects).sort((a, b) => a.name.localeCompare(b.name))
            );
            return newOrders;
          });
        }
      } catch (e) {
        console.error(e);
      }
      if (showLoading) setLoading(false);
    },
    [apiBase]
  );

  const loadApprovedUnpaid = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/approved-unpaid`);
      const data = await res.json();
      if (data.success) {
        const batchMap = {};
        (data.orders || []).forEach((order) => {
          const batchId = order.batch_id || `SINGLE-${order.id}`;
          if (!batchMap[batchId]) {
            batchMap[batchId] = {
              batch_id: batchId,
              seller_name: order.seller_name,
              seller_document: order.seller_document,
              currency: order.currency,
              igv_enabled: order.igv_enabled,
              igv_rate: order.igv_rate,
              approved_at: order.approved_at,
              orders: [],
              subtotal: 0,
              igv_amount: 0,
              total: 0,
            };
          }
          batchMap[batchId].orders.push(order);
          batchMap[batchId].subtotal += parseFloat(order.amount_pen || order.amount || 0);
          batchMap[batchId].igv_amount += parseFloat(order.igv_amount || 0);
          batchMap[batchId].total += parseFloat(order.total_with_igv || order.amount || 0);
        });
        setBatches(
          Object.values(batchMap).sort(
            (a, b) => new Date(b.approved_at) - new Date(a.approved_at)
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiBase]);

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
              currency: order.currency,
              payment_type: order.payment_type || 'cash',
              issue_date: order.issue_date || null,
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
          batchMap[batchId].total += parseFloat(order.total_with_igv || order.amount || 0);
        });
        const newBatches = Object.values(batchMap).sort(
          (a, b) => new Date(b.payment_confirmed_at) - new Date(a.payment_confirmed_at)
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

  const initFromCache = useCallback(() => {
    const cachedPending = loadFromCache('pendingOrders');
    const cachedToPay = loadFromCache('toPayOrders');
    const cachedPaid = loadFromCache('paidBatches');
    if (cachedPending) setPendingOrders(cachedPending);
    if (cachedToPay) setOrders(cachedToPay);
    if (cachedPaid) setPaidBatches(cachedPaid);
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    setLoadingRate(true);
    try {
      const res = await fetch(`${apiBase}/exchange-rate`);
      const data = await res.json();
      if (data.success) setCurrentExchangeRate(data.rate);
    } catch (e) {
      console.error(e);
    }
    setLoadingRate(false);
  }, [apiBase]);

  // ── To-Pay Selection ──────────────────────────────────────────────────

  const toggleToPaySelect = useCallback((id) => {
    setSelectedOrders((prev) => {
      if (prev.includes(id)) {
        setPrices((p) => { const n = { ...p }; delete n[id]; return n; });
        return prev.filter((x) => x !== id);
      }
      setPrices((p) => ({ ...p, [id]: 0 }));
      return [...prev, id];
    });
  }, []);

  const selectAllToPay = useCallback(() => {
    const ids = filteredOrders.map((o) => o.id);
    const idSet = new Set(ids);
    setSelectedOrders((prev) => {
      const prevSet = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => prevSet.has(id));
      if (allSelected) {
        setPrices((p) => {
          const n = { ...p };
          ids.forEach((id) => delete n[id]);
          return n;
        });
        return prev.filter((id) => !idSet.has(id));
      }
      setPrices((p) => {
        const n = { ...p };
        ids.forEach((id) => { if (n[id] === undefined) n[id] = 0; });
        return n;
      });
      return Array.from(new Set([...prev, ...ids]));
    });
  }, [filteredOrders]);

  const toggleSelect = useCallback((id) => {
    setSelectedOrders((prev) => {
      if (prev.includes(id)) {
        setPrices((p) => { const n = { ...p }; delete n[id]; return n; });
        return prev.filter((x) => x !== id);
      }
      setPrices((p) => ({ ...p, [id]: 0 }));
      return [...prev, id];
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginatedOrders.map((o) => o.id);
    const pageIdSet = new Set(pageIds);
    setSelectedOrders((prev) => {
      const prevSet = new Set(prev);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prevSet.has(id));
      if (allSelected) {
        setPrices((p) => {
          const n = { ...p };
          pageIds.forEach((id) => delete n[id]);
          return n;
        });
        return prev.filter((id) => !pageIdSet.has(id));
      }
      setPrices((p) => {
        const n = { ...p };
        pageIds.forEach((id) => { if (n[id] === undefined) n[id] = 0; });
        return n;
      });
      return Array.from(new Set([...prev, ...pageIds]));
    });
  }, [paginatedOrders]);

  // ── Bulk Approve Modal ────────────────────────────────────────────────

  const openBulkApproveModal = useCallback(() => {
    if (selectedOrders.length === 0) return;
    setBulkForm({
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
    setShowBulkModal(true);
  }, [selectedOrders.length]);

  const openSingleApproveModal = useCallback(
    (order) => {
      setSelectedOrders([order.id]);
      setPrices({ [order.id]: 0 });
      setTimeout(() => openBulkApproveModal(), 0);
    },
    [openBulkApproveModal]
  );

  const closeBulkModal = useCallback(() => {
    setShowBulkModal(false);
  }, []);

  const onCurrencyChange = useCallback(() => {
    if (bulkForm.currency === 'USD') fetchExchangeRate();
  }, [bulkForm.currency, fetchExchangeRate]);

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
        await Promise.all([loadToPayOrders(), loadPaidBatches()]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
    setApproving(false);
  }, [
    apiBase,
    bulkForm,
    canSubmitBulk,
    closeBulkModal,
    loadPaidBatches,
    loadToPayOrders,
    prices,
    selectedOrders,
    showToast,
  ]);

  // ── Reject ────────────────────────────────────────────────────────────

  const rejectOrder = useCallback(
    async (id) => {
      if (!window.confirm('¿Rechazar esta orden?')) return;
      try {
        const res = await fetch(`${apiBase}/${id}/reject`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        });
        const data = await res.json();
        if (data.success) {
          showToast('Orden rechazada', 'success');
          await Promise.all([loadPendingOrders(), loadToPayOrders()]);
        } else {
          showToast(data.message || 'Error', 'error');
        }
      } catch (e) {
        showToast('Error', 'error');
      }
    },
    [apiBase, loadPendingOrders, loadToPayOrders, showToast]
  );

  // ── Payment Modal ─────────────────────────────────────────────────────

  const openPaymentModal = useCallback((batch) => {
    setPaymentBatch(batch);
    setPaymentForm({ cdp_type: '', cdp_serie: '', cdp_number: '', payment_proof: null, payment_proof_link: '' });
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
      if (paymentForm.payment_proof_link) {
        formData.append('payment_proof_link', paymentForm.payment_proof_link);
      }
      if (paymentForm.payment_proof) {
        formData.append('payment_proof', paymentForm.payment_proof);
      }

      const res = await fetch(`${apiBase}/pay-batch`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        showToast('Pago confirmado', 'success');
        closePaymentModal();
        await Promise.all([loadToPayOrders(), loadPaidBatches()]);
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      showToast('Error', 'error');
    }
    setConfirmingPayment(false);
  }, [apiBase, closePaymentModal, loadPaidBatches, loadToPayOrders, paymentBatch, paymentForm, showToast]);

  // ── Export ─────────────────────────────────────────────────────────────

  const openExportModal = useCallback(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setExportFilter({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      preset: '30days',
    });
    setShowExportModal(true);
  }, []);

  const closeExportModal = useCallback(() => {
    setShowExportModal(false);
  }, []);

  const setExportPreset = useCallback((preset) => {
    const today = new Date();
    const startDate = new Date(today);
    switch (preset) {
      case '7days': startDate.setDate(today.getDate() - 7); break;
      case '30days': startDate.setDate(today.getDate() - 30); break;
      case '90days': startDate.setDate(today.getDate() - 90); break;
      case 'custom': setExportFilter((prev) => ({ ...prev, preset: 'custom' })); return;
    }
    setExportFilter({
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      preset,
    });
  }, []);

  const exportPaidExcelWithFilter = useCallback(() => {
    const params = new URLSearchParams();
    params.append('start_date', exportFilter.startDate);
    params.append('end_date', exportFilter.endDate);
    window.location.href = `${apiBase}/export-paid?${params.toString()}`;
    closeExportModal();
  }, [apiBase, closeExportModal, exportFilter]);

  const resetPaidFilter = useCallback(() => {
    setPaidFilterStartDate('');
    setPaidFilterEndDate('');
  }, []);

  const togglePaidBatchExpanded = useCallback((batchId) => {
    setExpandedPaidBatches((prev) => {
      const next = { ...prev };
      if (next[batchId]) { delete next[batchId]; } else { next[batchId] = true; }
      return next;
    });
  }, []);

  const toggleToPayBatchExpanded = useCallback((batchId) => {
    setExpandedToPayBatches((prev) => {
      const next = { ...prev };
      if (next[batchId]) { delete next[batchId]; } else { next[batchId] = true; }
      return next;
    });
  }, []);

  // ── Quick Pay ─────────────────────────────────────────────────────────

  const openQuickPayModal = useCallback(async () => {
    setShowQuickPayModal(true);
    setQuickPayStep(1);
    setQuickPaySelectedProject(null);
    setQuickPayItems([]);
    setQuickPayMaterialForm({ qty: 1, unit: '', description: '', diameter: '', series: '', material_type: '' });
    try {
      const res = await fetch(`${apiBase}/projects`);
      const data = await res.json();
      setQuickPayProjects(data.projects || []);
    } catch (e) {
      showToast('Error cargando proyectos', 'error');
    }
  }, [apiBase, showToast]);

  const closeQuickPayModal = useCallback(() => {
    setShowQuickPayModal(false);
    setQuickPayStep(1);
    setQuickPaySelectedProject(null);
    setQuickPayItems([]);
  }, []);

  const selectProjectForQuickPay = useCallback((project) => {
    setQuickPaySelectedProject(project);
    setQuickPayStep(2);
  }, []);

  const addQuickPayItem = useCallback(() => {
    if (!quickPayMaterialForm.description || !quickPayMaterialForm.qty) {
      showToast('Completa descripción y cantidad', 'error');
      return;
    }
    setQuickPayItems((prev) => [
      ...prev,
      {
        qty: quickPayMaterialForm.qty,
        unit: quickPayMaterialForm.unit || 'UND',
        description: quickPayMaterialForm.description.trim(),
        diameter: quickPayMaterialForm.diameter || '',
        series: quickPayMaterialForm.series || '',
        material_type: quickPayMaterialForm.material_type || '',
        price: 0,
        subtotal: 0,
      },
    ]);
    setQuickPayMaterialForm({ qty: 1, unit: '', description: '', diameter: '', series: '', material_type: '' });
    showToast('Item agregado', 'success');
  }, [quickPayMaterialForm, showToast]);

  const removeQuickPayItem = useCallback((index) => {
    setQuickPayItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const proceedToQuickPayReview = useCallback(() => {
    if (quickPayItems.length === 0) {
      showToast('Agrega al menos un item', 'error');
      return;
    }
    setQuickPayStep(3);
  }, [quickPayItems.length, showToast]);

  const updateQuickPayItemPrice = useCallback((index, price) => {
    setQuickPayItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, price: parseFloat(price) || 0, subtotal: item.qty * (parseFloat(price) || 0) }
          : item
      )
    );
  }, []);

  const quickPaySubtotal = useMemo(
    () => quickPayItems.reduce((sum, item) => sum + (item.subtotal || 0), 0),
    [quickPayItems]
  );

  const onQuickPayProofChange = useCallback((e) => {
    setQuickPayPaymentForm((prev) => ({ ...prev, payment_proof: e.target.files[0] || null }));
  }, []);

  const onQuickPayApprovalCurrencyChange = useCallback(() => {
    if (quickPayApprovalForm.currency === 'USD' && !quickPayApprovalForm.issue_date) {
      setQuickPayApprovalForm((prev) => ({
        ...prev,
        issue_date: new Date().toISOString().split('T')[0],
      }));
    }
  }, [quickPayApprovalForm.currency, quickPayApprovalForm.issue_date]);

  const completeQuickPay = useCallback(async () => {
    if (!quickPayApprovalForm.seller_name || !quickPayApprovalForm.seller_document) {
      showToast('Complete proveedor y RUC', 'error');
      return;
    }

    setQuickPayLoading(true);
    try {
      const formData = new FormData();
      formData.append('project_id', quickPaySelectedProject.id);
      formData.append('seller_name', quickPayApprovalForm.seller_name);
      formData.append('seller_document', quickPayApprovalForm.seller_document);
      formData.append('payment_type', quickPayApprovalForm.payment_type);
      formData.append('currency', quickPayApprovalForm.currency);
      formData.append('issue_date', quickPayApprovalForm.issue_date);
      if (quickPayApprovalForm.payment_type === 'loan') {
        formData.append('due_date', quickPayApprovalForm.due_date);
      }
      // Optional cdp fields
      formData.append('cdp_type', quickPayPaymentForm.cdp_type || '');
      formData.append('cdp_serie', quickPayPaymentForm.cdp_serie || '');
      formData.append('cdp_number', quickPayPaymentForm.cdp_number || '');
      if (quickPayPaymentForm.payment_proof_link) {
        formData.append('payment_proof_link', quickPayPaymentForm.payment_proof_link);
      }
      if (quickPayPaymentForm.payment_proof) {
        formData.append('payment_proof', quickPayPaymentForm.payment_proof);
      }
      formData.append(
        'items',
        JSON.stringify(
          quickPayItems.map((item) => ({
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            diameter: item.diameter,
            series: item.series,
            material_type: item.material_type,
            price: item.price,
            subtotal: item.subtotal,
          }))
        )
      );

      const res = await fetch(`${apiBase}/quick-pay`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        showToast('Pago rápido completado', 'success');
        closeQuickPayModal();
        await loadPaidBatches();
        setActiveTab('paid');
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    setQuickPayLoading(false);
  }, [
    apiBase,
    closeQuickPayModal,
    loadPaidBatches,
    quickPayApprovalForm,
    quickPayItems,
    quickPayPaymentForm,
    quickPaySelectedProject,
    showToast,
  ]);

  // ── Edit Comprobante ──────────────────────────────────────────────────

  const batchMissingComprobante = useCallback(
    (batch) => !batch.cdp_type || !batch.cdp_serie || !batch.cdp_number,
    []
  );

  const openEditComprobante = useCallback((batch) => {
    setEditComprobanteBatch(batch);
    setEditComprobanteForm({
      cdp_type: batch.cdp_type || '',
      cdp_serie: batch.cdp_serie || '',
      cdp_number: batch.cdp_number || '',
      payment_proof: null,
      payment_proof_link: batch.payment_proof_link || '',
    });
    setShowEditComprobanteModal(true);
  }, []);

  const closeEditComprobante = useCallback(() => {
    setShowEditComprobanteModal(false);
    setEditComprobanteBatch(null);
  }, []);

  const onEditComprobanteFileChange = useCallback((e) => {
    setEditComprobanteForm((prev) => ({ ...prev, payment_proof: e.target.files[0] || null }));
  }, []);

  const saveComprobante = useCallback(async () => {
    if (!editComprobanteForm.cdp_type || !editComprobanteForm.cdp_serie || !editComprobanteForm.cdp_number) {
      showToast('Complete tipo, serie y número de comprobante', 'error');
      return;
    }
    setSavingComprobante(true);
    try {
      const formData = new FormData();
      formData.append('batch_id', editComprobanteBatch.batch_id);
      formData.append('cdp_type', editComprobanteForm.cdp_type);
      formData.append('cdp_serie', editComprobanteForm.cdp_serie);
      formData.append('cdp_number', editComprobanteForm.cdp_number);
      if (editComprobanteForm.payment_proof_link) {
        formData.append('payment_proof_link', editComprobanteForm.payment_proof_link);
      }
      if (editComprobanteForm.payment_proof) {
        formData.append('payment_proof', editComprobanteForm.payment_proof);
      }

      const res = await fetch(`${apiBase}/update-comprobante`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        showToast('Comprobante actualizado', 'success');
        closeEditComprobante();
        await loadPaidBatches();
      } else {
        showToast(data.message || 'Error al actualizar', 'error');
      }
    } catch (e) {
      showToast('Error al actualizar comprobante', 'error');
    }
    setSavingComprobante(false);
  }, [apiBase, closeEditComprobante, editComprobanteBatch, editComprobanteForm, loadPaidBatches, showToast]);

  // ── Lifecycle / Polling ───────────────────────────────────────────────

  useEffect(() => {
    initDarkMode();
    initFromCache();

    // Parallel initial load (Rule 1.1)
    Promise.all([loadPendingOrders(), loadToPayOrders()]);

    const interval = setInterval(() => {
      if (activeTab === 'pending') loadPendingOrders();
      else if (activeTab === 'to_pay') loadToPayOrders();
      else if (activeTab === 'paid') loadPaidBatches();
    }, POLLING_INTERVAL_MS);
    pollingRef.current = interval;

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="compras-layout" data-v="486">
      <div className="compras-bg"></div>

      <div className="compras-container">
        {/* Header */}
        <header className="module-header">
          <div className="header-left">
            <button onClick={goBack} className="btn-back">
              <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Volver
            </button>
            <h1>
              <svg className="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              GESTIÓN DE COMPRAS
            </h1>
          </div>
          <div className="header-right">
            <button onClick={toggleDarkMode} className="theme-toggle" title="Cambiar tema">
              <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="module-content">
          {/* Main Tabs */}
          <div className="main-tabs">
            <button onClick={() => { setActiveTab('to_pay'); loadToPayOrders(); }} className={`main-tab${activeTab === 'to_pay' ? ' active' : ''}`}>
              Por Pagar
              <span className="tab-badge unpaid-badge">{orders.length}</span>
            </button>
            <button onClick={() => { setActiveTab('pending'); loadPendingOrders(); }} className={`main-tab${activeTab === 'pending' ? ' active' : ''}`}>
              Por Aprobar
              <span className="tab-badge pending-badge">{pendingOrders.length}</span>
            </button>
            <button onClick={() => { setActiveTab('paid'); loadPaidBatches(); }} className={`main-tab${activeTab === 'paid' ? ' active' : ''}`}>
              Pagadas
            </button>
          </div>

          {/* TAB: Por Aprobar */}
          {activeTab === 'pending' && (
            <>
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <span>Cargando órdenes...</span>
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay órdenes pendientes</h3>
                  <p>Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos</p>
                </div>
              ) : (
                <div className="pending-approval-reorganized">
                  {/* Bulk actions bar */}
                  {selectedPendingIds.length > 0 && (
                    <div className="bulk-actions-bar">
                      <span className="selection-count">{selectedPendingIds.length} seleccionados</span>
                      <button onClick={openApprovalModal} disabled={approvingPending} className="btn-approve-bulk">
                        {approvingPending ? 'Aprobando...' : 'Aprobar seleccionados'}
                      </button>
                      <button onClick={() => setSelectedPendingIds([])} className="btn-cancel-bulk">Cancelar</button>
                    </div>
                  )}

                  {/* Projects with collapsible lists */}
                  <div className="projects-container">
                    {pendingProjects.map((proj) => (
                      <div key={proj.id} className="project-section">
                        {/* Project Header */}
                        <div className="project-header" onClick={() => toggleProjectExpanded(proj.id)}>
                          <svg className={`expand-icon${expandedProjects[proj.id] ? ' expanded' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                          <span className="project-name-pill" style={{ background: getProjectColor(proj.id) }}>{proj.name}</span>
                          <span className="project-count">{proj.count} items</span>
                        </div>

                        {/* Lists under project */}
                        {expandedProjects[proj.id] && (
                          <div className="lists-container">
                            {getProjectLists(proj.id).map((list) => (
                              <div key={list.filename || 'manual'} className="list-section">
                                {/* List Header */}
                                <div className="list-header" onClick={() => toggleListExpanded(proj.id, list.filename)}>
                                  <svg className={`expand-icon${expandedLists[getListKey(proj.id, list.filename)] ? ' expanded' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
                                  <span className="list-name">{list.filename || 'Órdenes Manuales'}</span>
                                  <span className="list-count">{list.count} items</span>
                                </div>

                                {/* Materials table */}
                                {expandedLists[getListKey(proj.id, list.filename)] && (
                                  <div className="materials-table-container">
                                    <table className="materials-approval-table">
                                      <thead>
                                        <tr>
                                          <th className="col-item">ITEM</th>
                                          <th className="col-description">DESCRIPCIÓN</th>
                                          <th className="col-qty">CANT</th>
                                          <th className="col-und">UND</th>
                                          <th className="col-diam">DIÁMETRO</th>
                                          <th className="col-serie">SERIE</th>
                                          <th className="col-mat">MATERIAL</th>
                                          <th className="col-actions">ACCIONES</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {getListOrders(proj.id, list.filename).map((order) => (
                                          <tr
                                            key={order.id}
                                            className={`clickable-row${isPendingSelected(order.id) ? ' selected' : ''}`}
                                            onClick={() => togglePendingSelect(order.id)}
                                          >
                                            <td className="col-item">{order.item_number || '-'}</td>
                                            <td className="col-description">{getOrderTitle(order)}</td>
                                            <td className="col-qty">{getOrderQty(order)}</td>
                                            <td className="col-und">{order.unit || 'UND'}</td>
                                            <td className="col-diam">{order.diameter || '-'}</td>
                                            <td className="col-serie">{order.series || '-'}</td>
                                            <td className="col-mat">{order.material_type || '-'}</td>
                                            <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                                              <div className="action-buttons">
                                                <button onClick={() => approveSinglePending(order.id)} className="btn-sm btn-approve" title="Aprobar">✓</button>
                                                <button onClick={() => rejectOrder(order.id)} className="btn-sm btn-reject" title="Rechazar">✕</button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB: Por Pagar */}
          {activeTab === 'to_pay' && (
            <>
              {/* Search and Filters Bar */}
              <div className="to-pay-filters-bar">
                <div className="search-filter-group">
                  <input
                    value={toPaySearch}
                    onChange={(e) => setToPaySearch(e.target.value)}
                    type="text"
                    placeholder="Buscar por proveedor..."
                    className="search-input-topay"
                  />
                  <select value={toPayFilterProject} onChange={(e) => setToPayFilterProject(e.target.value)} className="filter-select">
                    <option value="">Todos los proyectos</option>
                    {toPayProjects.map((proj) => (
                      <option key={proj.id} value={proj.id}>{proj.name}</option>
                    ))}
                  </select>
                  <select value={toPayFilterCurrency} onChange={(e) => setToPayFilterCurrency(e.target.value)} className="filter-select">
                    <option value="">Todas las monedas</option>
                    <option value="PEN">PEN (Soles)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                  <select value={toPayFilterPaymentType} onChange={(e) => setToPayFilterPaymentType(e.target.value)} className="filter-select">
                    <option value="">Todos los tipos</option>
                    <option value="cash">Contado</option>
                    <option value="loan">Crédito</option>
                  </select>
                  <select value={toPayFilterIgv} onChange={(e) => setToPayFilterIgv(e.target.value)} className="filter-select">
                    <option value="">IGV: Todos</option>
                    <option value="true">Con IGV</option>
                    <option value="false">Sin IGV</option>
                  </select>
                </div>
                <button onClick={openQuickPayModal} className="btn-quick-pay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  Pago Rápido
                </button>
              </div>

              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <span>Cargando órdenes...</span>
                </div>
              ) : toPayBatches.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay órdenes por pagar</h3>
                  <p>Las órdenes aprobadas aparecerán aquí para registrar el pago</p>
                </div>
              ) : (
                <div className="batches-list">
                  {filteredToPayBatches.map((batch) => {
                    const alertStatus = getPaymentAlertStatus(batch);
                    return (
                      <div
                        key={batch.batch_id}
                        className={`batch-card to-pay collapsed-batch${alertStatus === 'urgent' ? ' alert-urgent' : ''}${alertStatus === 'overdue' ? ' alert-overdue' : ''}${alertStatus === 'today' ? ' alert-today' : ''}${alertStatus === 'warning' ? ' alert-warning' : ''}`}
                      >
                        {/* Collapsed Header */}
                        <div onClick={() => toggleToPayBatchExpanded(batch.batch_id)} className="batch-header collapsed-header">
                          <div className={`expand-icon${expandedToPayBatches[batch.batch_id] ? ' expanded' : ''}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                          <span className="batch-id-compact">{batch.batch_id}</span>
                          <span className="batch-seller-compact">Proveedor: {batch.seller_name}</span>
                          <span className="batch-items-count">{batch.orders.length} items</span>
                          {batch.payment_type === 'loan'
                            ? <span className="pill pill-credit">CRÉDITO</span>
                            : <span className="pill pill-cash">CONTADO</span>
                          }
                          <span className={`pill ${batch.currency === 'PEN' ? 'pill-pen' : 'pill-usd'}`}>{batch.currency}</span>
                          {batch.igv_enabled && <span className="pill pill-igv">+IGV</span>}
                          {batch.payment_type === 'loan' && alertStatus && (
                            <span className={`pill pill-due pill-${alertStatus}`}>
                              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 8v5l3 3 1-1.5-2.5-2.5V8h-1.5z"/>
                                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"/>
                              </svg>
                              {getAlertLabel(batch)}
                            </span>
                          )}
                          <span className="batch-total-compact">{batch.currency} {formatNumber((batch.total_with_igv ?? batch.total) || 0)}</span>
                        </div>

                        {/* Expanded Content */}
                        {expandedToPayBatches[batch.batch_id] && (
                          <div className="batch-expanded-content">
                            <div className="batch-meta-expanded">
                              {batch.approved_by_name && <span className="meta-item">Aprobado por: {batch.approved_by_name}</span>}
                              <span className="meta-item">Aprobado {formatDate(batch.approved_at)}</span>
                              {batch.issue_date && <span className="meta-item">Emisión {formatDate(batch.issue_date)}</span>}
                              {batch.due_date && <span className="meta-item">Vence {formatDate(batch.due_date)}</span>}
                            </div>

                            <div className="batch-items-expanded">
                              {batch.orders.map((order) => (
                                <div key={order.id} className="batch-item-expanded">
                                  <span className="item-project-small">{order.project_name}</span>
                                  <span className="item-desc-small">{getOrderTitle(order)}</span>
                                  <span className="item-qty-small">Cant: {getOrderQty(order)}</span>
                                  <span className="item-amount-small">{batch.currency} {formatNumber((order.amount_with_igv ?? order.amount) || 0)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="batch-footer">
                              <div className="batch-totals">
                                Total: {batch.currency} {formatNumber((batch.total_with_igv ?? batch.total) || 0)}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); openPaymentModal(batch); }} className="btn-confirm-payment">Pagar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB: Pagadas */}
          {activeTab === 'paid' && (
            <>
              {paidBatches.length > 0 && (
                <div className="export-bar">
                  <div className="date-filter-group">
                    <label>Desde:</label>
                    <input value={paidFilterStartDate} onChange={(e) => setPaidFilterStartDate(e.target.value)} type="date" className="input-date" />
                    <label>Hasta:</label>
                    <input value={paidFilterEndDate} onChange={(e) => setPaidFilterEndDate(e.target.value)} type="date" className="input-date" />
                    <button onClick={resetPaidFilter} className="btn-reset-filter">Limpiar</button>
                  </div>
                  <button onClick={openExportModal} className="btn-export">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Exportar Registro
                  </button>
                </div>
              )}

              {paidBatches.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay compras pagadas</h3>
                  <p>Las compras con pago confirmado aparecerán aquí</p>
                </div>
              ) : (
                <div className="batches-list">
                  {filteredPaidBatches.map((batch) => (
                    <div key={batch.batch_id} className="batch-card paid collapsed-batch">
                      {/* Collapsed Header */}
                      <div onClick={() => togglePaidBatchExpanded(batch.batch_id)} className="batch-header collapsed-header">
                        <div className={`expand-icon${expandedPaidBatches[batch.batch_id] ? ' expanded' : ''}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                        <span className="batch-id-compact">{batch.batch_id}</span>
                        <span className="batch-seller-compact">{batch.seller_name}</span>
                        {batchAllDelivered(batch)
                          ? <span className="delivered-badge-compact">✓ Entregado</span>
                          : <span className="paid-badge-compact">✓ Pagado</span>
                        }
                        {batchMissingComprobante(batch) && (
                          <span className="missing-comprobante-badge" title="Faltan datos del comprobante">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Sin comprobante
                          </span>
                        )}
                        <span className="batch-items-count">{batch.orders.length} items</span>
                        <span className="batch-total-compact">{batch.currency} {formatNumber(batch.total)}</span>
                        {!batchMissingComprobante(batch) && (
                          <button onClick={(e) => { e.stopPropagation(); openEditComprobante(batch); }} className="btn-edit-comprobante-header" title="Editar Comprobante">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Editar
                          </button>
                        )}
                      </div>

                      {/* Expanded Content */}
                      {expandedPaidBatches[batch.batch_id] && (
                        <div className="batch-expanded-content">
                          <div className="batch-meta-expanded">
                            <span className="meta-item">Pagado {formatDate(batch.payment_confirmed_at)}</span>
                            {batch.issue_date && <span className="meta-item">Emisión {formatDate(batch.issue_date)}</span>}
                            <span className={`meta-item ${batch.currency === 'PEN' ? 'meta-pen' : 'meta-usd'}`}>{batch.currency}</span>
                            <span className={`meta-item ${batch.payment_type === 'cash' ? 'meta-cash' : 'meta-credit'}`}>
                              {batch.payment_type === 'cash' ? 'Contado' : 'Crédito'}
                            </span>
                            {batch.igv_enabled
                              ? <span className="meta-item meta-igv">Con IGV</span>
                              : <span className="meta-item meta-no-igv">Sin IGV</span>
                            }
                            {batch.approved_by_name && <span className="meta-item meta-info">Aprobado por: {batch.approved_by_name}</span>}
                            {batch.payment_confirmed_by_name && <span className="meta-item meta-info">Pagado por: {batch.payment_confirmed_by_name}</span>}
                          </div>

                          <div className="batch-items-expanded">
                            {batch.orders.map((order) => (
                              <div key={order.id} className="batch-item-expanded">
                                <span className="item-project-small">{order.project_name}</span>
                                <span className="item-desc-small">{getOrderTitle(order)}</span>
                                <span className="item-qty-small">Cant: {getOrderQty(order)}</span>
                                <span className="item-amount-small">{order.currency} {formatNumber(order.amount)}</span>
                                {order.delivery_confirmed && <span className="item-delivered-badge-small">Entregado</span>}
                              </div>
                            ))}
                          </div>

                          <div className="batch-footer-expanded">
                            {batchMissingComprobante(batch) && (
                              <div className="comprobante-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="comprobante-alert-icon">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <span className="comprobante-alert-text">Faltan datos del comprobante de pago</span>
                                <button onClick={(e) => { e.stopPropagation(); openEditComprobante(batch); }} className="btn-edit-comprobante">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                  Completar Comprobante
                                </button>
                              </div>
                            )}

                            <div className="batch-payment-details-expanded">
                              {(batch.cdp_type || batch.cdp_serie) && (
                                <div className="payment-detail-row-small">
                                  <span className="detail-label-small">Comprobante:</span>
                                  <span className="detail-value-small">{batch.cdp_type} {batch.cdp_serie}-{batch.cdp_number}</span>
                                </div>
                              )}
                              {batch.payment_proof_link && (
                                <div className="payment-detail-row-small">
                                  <span className="detail-label-small">Link Factura:</span>
                                  <a href={batch.payment_proof_link} target="_blank" rel="noopener noreferrer" className="detail-link-small">{batch.payment_proof_link}</a>
                                </div>
                              )}
                              {batch.payment_proof && (
                                <div className="payment-detail-row-small">
                                  <span className="detail-label-small">Archivo:</span>
                                  <a href={`/storage/${batch.payment_proof}`} target="_blank" rel="noopener noreferrer" className="detail-link-small">Descargar</a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── MODALS (portals) ── */}

      {/* Approval Pricing Modal (Por Aprobar) */}
      {showApprovalModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeApprovalModal(); }}>
          <div className="modal-content modal-lg approval-modal">
            <div className="modal-header">
              <h2>Enviar {selectedApprovalOrdersData.length} Órdenes a Por Pagar</h2>
            </div>

            <div className="modal-body">
              {/* Seller & Billing Info */}
              <div className="form-section">
                <h4>Datos de Facturación</h4>
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Proveedor *</label>
                    <input value={approvalForm.seller_name} onChange={(e) => setApprovalForm((p) => ({ ...p, seller_name: e.target.value }))} type="text" className="input-field" placeholder="Nombre o Razón Social" />
                  </div>
                  <div className="form-group flex-1">
                    <label>RUC/DNI</label>
                    <input value={approvalForm.seller_document} onChange={(e) => setApprovalForm((p) => ({ ...p, seller_document: e.target.value }))} type="text" className="input-field" placeholder="20123456789" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Tipo de Pago *</label>
                    <select value={approvalForm.payment_type} onChange={(e) => setApprovalForm((p) => ({ ...p, payment_type: e.target.value }))} className="input-field">
                      <option value="cash">Pago Directo</option>
                      <option value="loan">Pago a Crédito</option>
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>Moneda</label>
                    <select value={approvalForm.currency} onChange={(e) => { setApprovalForm((p) => ({ ...p, currency: e.target.value })); onApprovalCurrencyChange(); }} className="input-field">
                      <option value="PEN">PEN - Soles</option>
                      <option value="USD">USD - Dólares</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Fecha Emisión</label>
                    <input value={approvalForm.issue_date} onChange={(e) => setApprovalForm((p) => ({ ...p, issue_date: e.target.value }))} type="date" className="input-field" />
                  </div>
                  {approvalForm.payment_type === 'loan' && (
                    <div className="form-group flex-1">
                      <label>Fecha Vencimiento</label>
                      <input value={approvalForm.due_date} onChange={(e) => setApprovalForm((p) => ({ ...p, due_date: e.target.value }))} type="date" className="input-field" />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={approvalForm.igv_enabled} onChange={(e) => setApprovalForm((p) => ({ ...p, igv_enabled: e.target.checked }))} />
                      Aplicar IGV
                    </label>
                  </div>
                  {approvalForm.igv_enabled && (
                    <div className="form-group flex-1">
                      <label>Tasa IGV (%)</label>
                      <input value={approvalForm.igv_rate} onChange={(e) => setApprovalForm((p) => ({ ...p, igv_rate: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="input-field" />
                    </div>
                  )}
                </div>
              </div>

              {/* Exchange Rate Info */}
              {approvalForm.currency === 'USD' && (
                <div className="exchange-info">
                  {loadingRate ? (
                    <span>Obteniendo tipo de cambio...</span>
                  ) : currentExchangeRate > 0 ? (
                    <span>T.C: 1 USD = S/ {currentExchangeRate.toFixed(4)}</span>
                  ) : (
                    <span className="error">No se pudo obtener tipo de cambio</span>
                  )}
                </div>
              )}

              {/* Materials Pricing with Inventory Search & Split */}
              <div className="form-section">
                <h4>Precios por Material</h4>
                <div className="pricing-list">
                  {selectedApprovalOrdersData.map((order) => (
                    <div key={order.id} className="pricing-row-container">
                      <div className="pricing-row">
                        <div className="pricing-info">
                          <span className="pricing-project-pill" style={{ background: getProjectColor(order.project_id) }}>{order.project_name}</span>
                          <span className="pricing-material">{getOrderTitle(order)}</span>
                          <span className="pricing-qty">{getOrderQty(order)}</span>
                          {!inventoryLoading[order.id] && hasInventoryMatch(order.id) && !inventorySelection[order.id] && (
                            <span className="inventory-badge-auto" title="Se encontraron coincidencias en inventario">📦 En Inventario</span>
                          )}
                          {inventoryLoading[order.id] && (
                            <span className="inventory-badge-loading"><span className="spinner-mini"></span></span>
                          )}
                        </div>
                        <div className="pricing-actions">
                          <button
                            onClick={() => searchInventoryForOrder(order)}
                            disabled={inventoryLoading[order.id]}
                            className={`btn-inventory-search${inventoryExpanded[order.id] ? ' active' : ''}${hasInventoryMatch(order.id) ? ' has-match' : ''}`}
                            title="Consultar Almacén"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                            {inventoryLoading[order.id] ? 'Buscando...' : 'Almacén'}
                          </button>

                          <div className="pricing-input">
                            <span className="currency-prefix">{approvalForm.currency === 'USD' ? '$' : 'S/'}</span>
                            <input
                              value={approvalPrices[order.id] ?? ''}
                              onChange={(e) => setApprovalPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                              type="number"
                              step="0.01"
                              min="0"
                              className={`input-field price-input${isPriceLocked(order.id) ? ' locked' : ''}${isSplitActive(order.id) ? ' split-price' : ''}`}
                              disabled={isPriceLocked(order.id)}
                              placeholder={isPriceLocked(order.id) ? 'De inventario' : isSplitActive(order.id) ? `Precio ${getSplitInfo(order.id)?.qtyToBuy} uds` : '0.00'}
                            />
                            {inventorySelection[order.id]?.type === 'inventory' && <span className="price-source inventory">📦 100% Inventario</span>}
                            {inventorySelection[order.id]?.type === 'split' && <span className="price-source split">✂️ Dividido</span>}
                            {inventorySelection[order.id]?.type === 'new' && <span className="price-source new-purchase">🛒 Nueva compra</span>}
                            {inventorySelection[order.id] && (
                              <button onClick={() => clearInventorySelection(order.id)} className="btn-clear-selection" title="Limpiar selección">✕</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Split info panel */}
                      {isSplitActive(order.id) && (
                        <div className="split-info-panel">
                          <div className="split-header">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            <strong>División de Pedido</strong>
                          </div>
                          <div className="split-rows">
                            <div className="split-row split-row-inventory">
                              <span className="split-label">📦 De Inventario:</span>
                              <div className="qty-edit-wrapper">
                                <input
                                  type="number"
                                  value={inventorySelection[order.id]?.qtyUsed ?? ''}
                                  onChange={(e) => { setInventorySelection((p) => ({ ...p, [order.id]: { ...p[order.id], qtyUsed: parseFloat(e.target.value) || 0 } })); updateInventoryUsage(order.id); }}
                                  className="input-qty-mini"
                                  min="0"
                                  title="Modificar cantidad a usar"
                                />
                              </div>
                              <span className="split-detail">({getSplitInfo(order.id)?.itemName})</span>
                              <span className="split-badge badge-inventory">Entrega Inmediata</span>
                            </div>
                            <div className="split-row split-row-purchase">
                              <span className="split-label">🛒 A Comprar:</span>
                              <span className="split-value">{getSplitInfo(order.id)?.qtyToBuy} uds</span>
                              <span className="split-detail">→ Ingresar precio abajo</span>
                              <span className="split-badge badge-purchase">Por Pagar</span>
                            </div>
                          </div>
                          <div className="split-budget-info">
                            <span className="budget-label">Costo Total (Budget):</span>
                            <div className="qty-edit-wrapper">
                              <span className="currency-prefix-mini">{approvalForm.currency === 'USD' ? '$' : 'S/'}</span>
                              <input
                                type="number"
                                step="0.01"
                                value={inventorySelection[order.id]?.budgetTotalInput ?? ''}
                                onChange={(e) => setInventorySelection((p) => ({ ...p, [order.id]: { ...p[order.id], budgetTotalInput: parseFloat(e.target.value) || 0 } }))}
                                className="input-price-mini"
                                min="0"
                                placeholder="0.00"
                                title="Indique el costo total teórico del pedido completo"
                              />
                            </div>
                            <span className="budget-hint">(Valor imputado al proyecto)</span>
                          </div>
                        </div>
                      )}

                      {/* Info 100% Inventario */}
                      {inventorySelection[order.id]?.type === 'inventory' && (
                        <div className="inventory-full-panel">
                          <div className="inventory-full-row">
                            <span className="inventory-full-icon">✅</span>
                            <span className="inventory-full-text">
                              <div className="qty-edit-inline">
                                <input
                                  type="number"
                                  value={inventorySelection[order.id]?.qtyUsed ?? ''}
                                  onChange={(e) => { setInventorySelection((p) => ({ ...p, [order.id]: { ...p[order.id], qtyUsed: parseFloat(e.target.value) || 0 } })); updateInventoryUsage(order.id); }}
                                  className="input-qty-mini"
                                  min="0"
                                  title="Modificar cantidad"
                                />
                                <span>uds cubiertas desde <strong>{inventorySelection[order.id]?.itemName}</strong></span>
                              </div>
                            </span>
                            <span className="inventory-full-badge">Sin Costo Real</span>
                          </div>
                          <div className="inventory-full-ref">
                            <span>Costo de referencia (presupuesto):</span>
                            <div className="qty-edit-wrapper">
                              <span className="currency-prefix-mini">{approvalForm.currency === 'USD' ? '$' : 'S/'}</span>
                              <input
                                type="number"
                                step="0.01"
                                value={inventorySelection[order.id]?.totalPrice ?? ''}
                                onChange={(e) => { setInventorySelection((p) => ({ ...p, [order.id]: { ...p[order.id], totalPrice: parseFloat(e.target.value) || 0 } })); updateReferencePrice(order.id); }}
                                className="input-price-mini"
                                min="0"
                                placeholder="0.00"
                                title="Valor inmaterial imputado al proyecto"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dropdown de resultados de inventario */}
                      {inventoryExpanded[order.id] && (
                        <div className="inventory-dropdown">
                          {inventoryLoading[order.id] ? (
                            <div className="inventory-loading"><span className="spinner"></span> Buscando en almacén...</div>
                          ) : (inventorySearchResults[order.id]?.length > 0) ? (
                            <div className="inventory-results">
                              <div
                                className={`inventory-item new-purchase-option${isNewPurchaseSelected(order.id) ? ' selected' : ''}`}
                                onClick={() => selectNewPurchase(order.id)}
                              >
                                <div className="item-info">
                                  <span className="item-name">🛒 Sin inventario - Nueva compra</span>
                                  <span className="item-desc">Comprar todas las unidades al proveedor</span>
                                </div>
                                <span className="item-status available">Seleccionar</span>
                              </div>
                              {inventorySearchResults[order.id].map((item) => (
                                <div
                                  key={item.id}
                                  className={`inventory-item${item.apartado ? ' reserved' : ''}${item.disponible ? ' available' : ''}${isInventoryItemSelected(order.id, item.id) ? ' selected' : ''}`}
                                  onClick={() => item.disponible && selectInventoryItem(order.id, item, getOrderQtyNum(order))}
                                >
                                  <div className="item-info">
                                    <span className="item-name">{item.nombre}</span>
                                    <span className="item-desc">
                                      {item.descripcion || ''}
                                      {item.diameter && <> | Ø{item.diameter}</>}
                                      {item.series && <> | Serie {item.series}</>}
                                    </span>
                                    <span className="item-stock">
                                      Stock: {item.cantidad_disponible} {item.unidad} | Costo unit: {item.moneda === 'USD' ? '$' : 'S/'}{item.costo_unitario.toFixed(2)}
                                    </span>
                                    {item.cantidad_disponible >= getOrderQtyNum(order) ? (
                                      <span className="item-coverage full">✅ Cubre todo el pedido</span>
                                    ) : (
                                      <span className="item-coverage partial">⚠️ Cubre {item.cantidad_disponible} de {getOrderQtyNum(order)} — se dividirá</span>
                                    )}
                                  </div>
                                  <div className="item-status-container">
                                    {item.apartado ? (
                                      <span className="item-status reserved">Apartado: {item.nombre_proyecto}</span>
                                    ) : (
                                      <span className="item-status available">Usar Stock</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="inventory-empty">
                              <p>No se encontraron items similares en inventario</p>
                              <button onClick={() => selectNewPurchase(order.id)} className="btn-new-purchase">Continuar como nueva compra</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="totals-section">
                <div className="total-row cashflow-row">
                  <span className="total-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Gasto Real (Pago a proveedor):
                  </span>
                  <span className="total-amount">{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalCashflowTotal)}</span>
                </div>
                {approvalForm.igv_enabled && approvalCashflowTotal > 0 && (
                  <div className="total-row">
                    <span>IGV ({approvalForm.igv_rate}%):</span>
                    <span>{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalIgv)}</span>
                  </div>
                )}
                {approvalForm.igv_enabled && approvalCashflowTotal > 0 && (
                  <div className="total-row total-final">
                    <span>Total con IGV:</span>
                    <span>{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalTotal)}</span>
                  </div>
                )}
                {approvalBudgetTotal !== approvalCashflowTotal && (
                  <div className="total-row budget-row">
                    <span className="total-label">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                      Costo Imputado al Proyecto:
                    </span>
                    <span className="total-amount budget-amount">{approvalForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(approvalBudgetTotal)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closeApprovalModal} className="btn-cancel">Cancelar</button>
              <button onClick={submitApprovalPending} disabled={!canSubmitApproval || approvingPending} className="btn-submit">
                {approvingPending ? 'Procesando...' : `Enviar ${selectedApprovalOrdersData.length} a Por Pagar`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Approve Modal */}
      {showBulkModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeBulkModal(); }}>
          <div className="modal-content modal-lg bulk-approve-modal">
            <div className="modal-header">
              <h2>Pagar {selectedOrdersData.length} Órdenes</h2>
              <button onClick={closeBulkModal} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <h4>Datos de Facturación</h4>
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Proveedor *</label>
                    <input value={bulkForm.seller_name} onChange={(e) => setBulkForm((p) => ({ ...p, seller_name: e.target.value }))} type="text" className="input-field" placeholder="Nombre o Razón Social" />
                  </div>
                  <div className="form-group flex-1">
                    <label>RUC/DNI</label>
                    <input value={bulkForm.seller_document} onChange={(e) => setBulkForm((p) => ({ ...p, seller_document: e.target.value }))} type="text" className="input-field" placeholder="20123456789" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Moneda</label>
                    <select value={bulkForm.currency} onChange={(e) => { setBulkForm((p) => ({ ...p, currency: e.target.value })); onCurrencyChange(); }} className="input-field">
                      <option value="PEN">PEN - Soles</option>
                      <option value="USD">USD - Dólares</option>
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>Fecha Emisión</label>
                    <input value={bulkForm.issue_date} onChange={(e) => setBulkForm((p) => ({ ...p, issue_date: e.target.value }))} type="date" className="input-field" />
                  </div>
                  <div className="form-group flex-1">
                    <label>Tipo Pago</label>
                    <select value={bulkForm.payment_type} onChange={(e) => setBulkForm((p) => ({ ...p, payment_type: e.target.value }))} className="input-field">
                      <option value="cash">Contado</option>
                      <option value="loan">Crédito</option>
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label>{bulkForm.payment_type === 'cash' ? 'F. Pago' : 'F. Vencimiento'}</label>
                    <input value={bulkForm.date_value} onChange={(e) => setBulkForm((p) => ({ ...p, date_value: e.target.value }))} type="date" className="input-field" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={bulkForm.igv_enabled} onChange={(e) => setBulkForm((p) => ({ ...p, igv_enabled: e.target.checked }))} />
                      Aplicar IGV
                    </label>
                  </div>
                  {bulkForm.igv_enabled && (
                    <div className="form-group flex-1">
                      <label>Tasa IGV (%)</label>
                      <input value={bulkForm.igv_rate} onChange={(e) => setBulkForm((p) => ({ ...p, igv_rate: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="input-field" />
                    </div>
                  )}
                </div>
              </div>

              {bulkForm.currency === 'USD' && (
                <div className="exchange-info">
                  {loadingRate ? (
                    <span>Obteniendo tipo de cambio...</span>
                  ) : currentExchangeRate > 0 ? (
                    <span>T.C: 1 USD = S/ {currentExchangeRate.toFixed(4)}</span>
                  ) : (
                    <span className="error">No se pudo obtener tipo de cambio</span>
                  )}
                </div>
              )}

              <div className="form-section">
                <h4>Precios por Material</h4>
                <div className="pricing-list">
                  {selectedOrdersData.map((order) => (
                    <div key={order.id} className="pricing-row">
                      <div className="pricing-info">
                        <span className="pricing-project-pill" style={{ background: getProjectColor(order.project_id) }}>{order.project_name}</span>
                        <span className="pricing-material">{getOrderTitle(order)}</span>
                        <span className="pricing-qty">{getOrderQty(order)}</span>
                      </div>
                      <div className="pricing-input">
                        <span className="currency-prefix">{bulkForm.currency === 'USD' ? '$' : 'S/'}</span>
                        <input
                          value={prices[order.id] ?? ''}
                          onChange={(e) => setPrices((p) => ({ ...p, [order.id]: parseFloat(e.target.value) || 0 }))}
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="input-field price-input"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="totals-section">
                {bulkForm.igv_enabled && (
                  <div className="total-row">
                    <span>IGV ({bulkForm.igv_rate}%):</span>
                    <span>{bulkForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(bulkIgv)}</span>
                  </div>
                )}
                <div className="total-row total-final">
                  <span>TOTAL:</span>
                  <span>{bulkForm.currency === 'USD' ? '$' : 'S/'} {formatNumber(bulkTotal)}</span>
                </div>
                {bulkForm.currency === 'USD' && currentExchangeRate > 0 && (
                  <div className="total-row pen-equivalent">
                    <span>Equivalente en Soles:</span>
                    <span>S/ {formatNumber(bulkTotalPen)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closeBulkModal} className="btn-cancel">Cancelar</button>
              <button onClick={submitBulkApprove} disabled={!canSubmitBulk || approving} className="btn-submit">
                {approving ? 'Pagando...' : `Pagar ${selectedOrdersData.length} Órdenes`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Payment Modal */}
      {showPaymentModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePaymentModal(); }}>
          <div className="modal-content payment-modal">
            <div className="modal-header">
              <h2>CONFIRMAR PAGO</h2>
              {paymentBatch && paymentBatch.igv_enabled && <span className="pill pill-igv header-igv">+IGV</span>}
            </div>

            {paymentBatch && (
              <div className="modal-body">
                <div className="payment-summary-card">
                  <div className="summary-row">
                    <span className="summary-label">Lote:</span>
                    <span className="summary-value">{paymentBatch.batch_id}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Proveedor:</span>
                    <span className="summary-value">{paymentBatch.seller_name}</span>
                  </div>
                  <div className="summary-row total-row">
                    <span className="summary-label">Total:</span>
                    <span className="summary-value total-amount">{paymentBatch.currency} {formatNumber(paymentBatch.total)}</span>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); confirmPayment(); }} className="payment-form">
                  <div className="form-section">
                    <h4>Datos del Comprobante (opcional)</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Tipo CP</label>
                        <input value={paymentForm.cdp_type} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_type: e.target.value }))} type="text" placeholder="01, 03" className="input-field" />
                      </div>
                      <div className="form-group">
                        <label>Serie</label>
                        <input value={paymentForm.cdp_serie} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_serie: e.target.value }))} type="text" placeholder="F001" className="input-field" />
                      </div>
                      <div className="form-group">
                        <label>Número</label>
                        <input value={paymentForm.cdp_number} onChange={(e) => setPaymentForm((p) => ({ ...p, cdp_number: e.target.value }))} type="text" placeholder="00001234" className="input-field" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Comprobante (opcional)</label>
                      <input type="file" onChange={onPaymentProofChange} accept="image/*,.pdf" className="input-file" />
                    </div>
                    <div className="form-group">
                      <label>Link de comprobante (opcional)</label>
                      <input value={paymentForm.payment_proof_link} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_proof_link: e.target.value }))} type="url" placeholder="https://..." className="input-field" />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={closePaymentModal} className="btn-cancel">Cancelar</button>
                    <button type="submit" disabled={confirmingPayment} className="btn-submit">
                      {confirmingPayment ? 'Confirmando...' : 'Confirmar Pago'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Edit Comprobante Modal */}
      {showEditComprobanteModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEditComprobante(); }}>
          <div className="modal-content payment-modal edit-comprobante-modal">
            <div className="modal-header">
              <h2>EDITAR COMPROBANTE</h2>
            </div>

            {editComprobanteBatch && (
              <div className="modal-body">
                <div className="payment-summary-card">
                  <div className="summary-row">
                    <span className="summary-label">Lote:</span>
                    <span className="summary-value">{editComprobanteBatch.batch_id}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Proveedor:</span>
                    <span className="summary-value">{editComprobanteBatch.seller_name}</span>
                  </div>
                  <div className="summary-row total-row">
                    <span className="summary-label">Total:</span>
                    <span className="summary-value total-amount">{editComprobanteBatch.currency} {formatNumber(editComprobanteBatch.total)}</span>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); saveComprobante(); }} className="payment-form">
                  <div className="form-section">
                    <h4>Datos del Comprobante *</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Tipo CP *</label>
                        <input value={editComprobanteForm.cdp_type} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_type: e.target.value }))} type="text" required placeholder="01, 03" className="input-field" />
                      </div>
                      <div className="form-group">
                        <label>Serie *</label>
                        <input value={editComprobanteForm.cdp_serie} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_serie: e.target.value }))} type="text" required placeholder="F001" className="input-field" />
                      </div>
                      <div className="form-group">
                        <label>Número *</label>
                        <input value={editComprobanteForm.cdp_number} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, cdp_number: e.target.value }))} type="text" required placeholder="00001234" className="input-field" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Comprobante (archivo)</label>
                      <input type="file" onChange={onEditComprobanteFileChange} accept="image/*,.pdf" className="input-file" />
                    </div>
                    <div className="form-group">
                      <label>Link de comprobante (opcional)</label>
                      <input value={editComprobanteForm.payment_proof_link} onChange={(e) => setEditComprobanteForm((p) => ({ ...p, payment_proof_link: e.target.value }))} type="url" placeholder="https://..." className="input-field" />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={closeEditComprobante} className="btn-cancel">Cancelar</button>
                    <button type="submit" disabled={savingComprobante} className="btn-submit">
                      {savingComprobante ? 'Guardando...' : 'Guardar Comprobante'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Quick Pay Modal */}
      {showQuickPayModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeQuickPayModal(); }}>
          <div className="modal-content modal-lg quick-pay-modal">
            <div className="modal-header quick-pay-modal-header">
              <div className="quick-pay-header-content">
                <h2 className="quick-pay-title-simple">
                  <svg className="quick-pay-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  PAGO RÁPIDO
                </h2>
                <p className="quick-pay-description">Registra una compra al instante sin pasar por aprobaciones del jefe de proyectos ni esperar autorización de pago</p>
              </div>
            </div>

            <div className="modal-body">
              {/* Step 1: Select Project */}
              {quickPayStep === 1 && (
                <div className="quick-pay-step">
                  <h4 className="quick-pay-subtitle">Selecciona un Proyecto</h4>
                  {quickPayAvailableProjects.length === 0 ? (
                    <div className="empty-state"><p>No hay proyectos disponibles</p></div>
                  ) : (
                    <div className="projects-list">
                      {quickPayAvailableProjects.map((project) => (
                        <button key={project.id} type="button" onClick={() => selectProjectForQuickPay(project)} className="project-list-item">
                          <span className="project-list-left">
                            <span className="project-color-dot" style={{ background: getProjectColor(project.id) }}></span>
                            <span className="project-list-name">{project.name}</span>
                          </span>
                          <span className="project-list-currency">{project.currency}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Add Items */}
              {quickPayStep === 2 && quickPaySelectedProject && (
                <div className="quick-pay-step">
                  <h4>
                    <span className="quick-pay-label">Proyecto:</span>
                    <span className="quick-pay-project-pill" style={{ background: getProjectColor(quickPaySelectedProject.id) }}>{quickPaySelectedProject.name}</span>
                  </h4>
                  <div className="form-section quick-pay-form-section">
                    <h5 className="quick-pay-section-title">Agregar Material</h5>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label>Descripción *</label>
                        <input value={quickPayMaterialForm.description} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, description: e.target.value }))} type="text" className="input-field" placeholder="Ej: BRIDA ANILLO" />
                      </div>
                      <div className="form-group flex-1">
                        <label>Cantidad</label>
                        <input value={quickPayMaterialForm.qty} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, qty: parseInt(e.target.value) || 1 }))} type="number" min="1" className="input-field" placeholder="1" />
                      </div>
                      <div className="form-group flex-1">
                        <label>Unidad</label>
                        <input value={quickPayMaterialForm.unit} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, unit: e.target.value }))} type="text" className="input-field" placeholder="UND" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label>Diámetro</label>
                        <input value={quickPayMaterialForm.diameter} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, diameter: e.target.value }))} type="text" className="input-field" placeholder="Φ1/2 INCH" />
                      </div>
                      <div className="form-group flex-1">
                        <label>Serie</label>
                        <input value={quickPayMaterialForm.series} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, series: e.target.value }))} type="text" className="input-field" placeholder="CLASE 150" />
                      </div>
                      <div className="form-group flex-1">
                        <label>Material</label>
                        <input value={quickPayMaterialForm.material_type} onChange={(e) => setQuickPayMaterialForm((p) => ({ ...p, material_type: e.target.value }))} type="text" className="input-field" placeholder="ACERO INOX" />
                      </div>
                    </div>
                    <button onClick={addQuickPayItem} type="button" className="btn-add-material btn-quick-pay-add">+ Agregar Item</button>
                  </div>

                  {quickPayItems.length > 0 && (
                    <div className="items-summary">
                      <h5>Items Agregados</h5>
                      <div className="items-table items-summary-table">
                        {quickPayItems.map((item, idx) => (
                          <div key={idx} className="item-summary-row">
                            <div className="item-summary-content">
                              <div className="item-summary-title">{item.description}</div>
                              <div className="item-summary-meta">
                                <span><span className="item-summary-label">CANTIDAD:</span> {item.qty}</span>
                                <span><span className="item-summary-label">UNIDAD:</span> {item.unit}</span>
                                {item.diameter && <span><span className="item-summary-label">DIÁMETRO:</span> {item.diameter}</span>}
                                {item.series && <span><span className="item-summary-label">SERIE:</span> {item.series}</span>}
                                {item.material_type && <span><span className="item-summary-label">MATERIAL:</span> {item.material_type}</span>}
                              </div>
                            </div>
                            <button onClick={() => removeQuickPayItem(idx)} type="button" className="btn-remove btn-remove-square" aria-label="Eliminar item">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review & Pay */}
              {quickPayStep === 3 && (
                <div className="quick-pay-step">
                  <div className="quick-pay-review-grid">
                    {/* Left: Items & Pricing */}
                    <div className="quick-pay-box">
                      <h5 className="quick-pay-section-title">Items a Pagar</h5>
                      <div className="items-table quick-pay-items-table">
                        {quickPayItems.map((item, idx) => (
                          <div key={idx} className="item-row">
                            <div className="item-name">{item.description}</div>
                            <div className="item-qty-unit">
                              <span className="item-label">CANTIDAD:</span> {item.qty}
                              <span className="item-label"> UNIDAD:</span> {item.unit}
                            </div>
                            <div className="item-price-row">
                              <label className="price-label">PRECIO x Unidad:</label>
                              <input value={item.price || ''} onChange={(e) => updateQuickPayItemPrice(idx, e.target.value)} type="number" min="0" step="0.01" className="input-price" placeholder="0.00" />
                              <div className="item-subtotal">S/ {formatNumber(item.subtotal)}</div>
                            </div>
                          </div>
                        ))}
                        <div className="total-row">
                          <strong>Total:</strong>
                          <strong>S/ {formatNumber(quickPaySubtotal)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Right: Supplier & Payment Info */}
                    <div className="quick-pay-box">
                      <div className="section-header-with-pill">
                        <h5 className="quick-pay-section-title">Datos del Proveedor</h5>
                        <span className="required-pill">
                          {AlertIcon}
                          OBLIGATORIO
                        </span>
                      </div>
                      <div className="form-section quick-pay-form-section">
                        <div className="form-group quick-pay-inline-group">
                          <label>Proveedor *</label>
                          <input value={quickPayApprovalForm.seller_name} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, seller_name: e.target.value }))} type="text" className="input-field" placeholder="Razón social" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>RUC *</label>
                          <input value={quickPayApprovalForm.seller_document} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, seller_document: e.target.value }))} type="text" className="input-field" placeholder="20123456789" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Moneda</label>
                          <select value={quickPayApprovalForm.currency} onChange={(e) => { setQuickPayApprovalForm((p) => ({ ...p, currency: e.target.value })); onQuickPayApprovalCurrencyChange(); }} className="input-field">
                            <option value="PEN">Soles</option>
                            <option value="USD">Dólares</option>
                          </select>
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Tipo Pago</label>
                          <select value={quickPayApprovalForm.payment_type} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, payment_type: e.target.value }))} className="input-field">
                            <option value="cash">Al Contado</option>
                            <option value="loan">Crédito</option>
                          </select>
                        </div>
                        <div className="quick-pay-dates-row">
                          <div className="form-group quick-pay-inline-group">
                            <label>Fecha Emisión</label>
                            <input value={quickPayApprovalForm.issue_date} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, issue_date: e.target.value }))} type="date" className="input-field" />
                          </div>
                          {quickPayApprovalForm.payment_type === 'loan' && (
                            <div className="form-group quick-pay-inline-group">
                              <label>Fecha Vencimiento</label>
                              <input value={quickPayApprovalForm.due_date} onChange={(e) => setQuickPayApprovalForm((p) => ({ ...p, due_date: e.target.value }))} type="date" className="input-field" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Comprobante section - Optional */}
                      <div className="section-header-with-pill" style={{ marginTop: '1.5rem' }}>
                        <h5 className="quick-pay-section-title">Comprobante de Pago</h5>
                        <span className="optional-pill" style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          NO OBLIGATORIO
                        </span>
                      </div>
                      <div className="form-section quick-pay-form-section">
                        <div className="form-group quick-pay-inline-group">
                          <label>Tipo</label>
                          <input value={quickPayPaymentForm.cdp_type} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_type: e.target.value }))} type="text" className="input-field" placeholder="01, 03" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Serie</label>
                          <input value={quickPayPaymentForm.cdp_serie} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_serie: e.target.value }))} type="text" className="input-field" placeholder="F001" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Número</label>
                          <input value={quickPayPaymentForm.cdp_number} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, cdp_number: e.target.value }))} type="text" className="input-field" placeholder="00001234" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Comprobante (archivo)</label>
                          <input type="file" onChange={onQuickPayProofChange} accept="image/*,.pdf" className="input-file" />
                        </div>
                        <div className="form-group quick-pay-inline-group">
                          <label>Comprobante (link)</label>
                          <input value={quickPayPaymentForm.payment_proof_link} onChange={(e) => setQuickPayPaymentForm((p) => ({ ...p, payment_proof_link: e.target.value }))} type="url" placeholder="https://..." className="input-field" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={closeQuickPayModal} type="button" className="btn-cancel-red">Cancelar</button>
              {quickPayStep > 1 && <button onClick={() => setQuickPayStep((s) => s - 1)} type="button" className="btn-secondary btn-quick-back">Atrás</button>}
              {quickPayStep < 3 && <button onClick={proceedToQuickPayReview} type="button" className="btn-submit">Siguiente</button>}
              {quickPayStep === 3 && (
                <button onClick={completeQuickPay} disabled={quickPayLoading} type="button" className="btn-submit">
                  {quickPayLoading ? 'Procesando...' : 'Confirmar Pago Rápido'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Export Modal */}
      {showExportModal && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeExportModal(); }}>
          <div className="modal-content modal-md">
            <div className="modal-header">
              <h2>Exportar Registro de Compras</h2>
              <button onClick={closeExportModal} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              <div className="export-options">
                <div className="option-group">
                  <label>Período Predefinido:</label>
                  <div className="preset-buttons">
                    <button onClick={() => setExportPreset('7days')} className={`preset-btn${exportFilter.preset === '7days' ? ' active' : ''}`}>Últimos 7 días</button>
                    <button onClick={() => setExportPreset('30days')} className={`preset-btn${exportFilter.preset === '30days' ? ' active' : ''}`}>Últimos 30 días</button>
                    <button onClick={() => setExportPreset('90days')} className={`preset-btn${exportFilter.preset === '90days' ? ' active' : ''}`}>Últimos 90 días</button>
                    <button onClick={() => setExportPreset('custom')} className={`preset-btn${exportFilter.preset === 'custom' ? ' active' : ''}`}>Personalizado</button>
                  </div>
                </div>
                {exportFilter.preset === 'custom' && (
                  <div className="option-group custom-dates">
                    <label>Desde:</label>
                    <input value={exportFilter.startDate} onChange={(e) => setExportFilter((p) => ({ ...p, startDate: e.target.value }))} type="date" className="input-date" />
                    <label>Hasta:</label>
                    <input value={exportFilter.endDate} onChange={(e) => setExportFilter((p) => ({ ...p, endDate: e.target.value }))} type="date" className="input-date" />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={closeExportModal} className="btn-cancel">Cancelar</button>
              <button onClick={exportPaidExcelWithFilter} className="btn-submit">Exportar Excel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast.show && createPortal(
        <div className={`toast ${toast.type}`}>{toast.message}</div>,
        document.body
      )}
    </div>
  );
}
