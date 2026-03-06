/**
 * @file Hook de lógica del tab "Pagadas"
 * @module compraskrsft/hooks/usePaidTab
 */
import { useState, useCallback, useMemo } from 'react';
import { getCsrfToken, getLocalDateString } from '../utils';
import { formatDate as _fmtDate } from '@/services/DateTimeService';

/** Convierte una Date arbitraria a YYYY-MM-DD respetando la zona horaria configurada */
const formatDateIso = (d) => _fmtDate(d, 'iso');

/**
 * @typedef {Object} UsePaidTabParams
 * @property {Array} paidBatches
 * @property {string} apiBase
 * @property {Function} showToast
 * @property {Function} loadPaidBatches
 */

/**
 * Estado y lógica del tab "Pagadas":
 * - Filtro por fechas, expansión de lotes
 * - Edición de comprobante
 * - Exportación a Excel
 *
 * @param {UsePaidTabParams} ctx
 */
export function usePaidTab(ctx) {
  const { paidBatches, apiBase, showToast, loadPaidBatches } = ctx;

  // ── Filters ───────────────────────────────────────────────────────────
  const [paidFilterStartDate, setPaidFilterStartDate] = useState('');
  const [paidFilterEndDate, setPaidFilterEndDate] = useState('');
  const [expandedPaidBatches, setExpandedPaidBatches] = useState({});

  // ── Comprobante modal ─────────────────────────────────────────────────
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

  // ── Export modal ──────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilter, setExportFilter] = useState({
    startDate: '',
    endDate: '',
    preset: '30days',
  });

  // ── Derived ───────────────────────────────────────────────────────────
  const filteredPaidBatches = useMemo(() => {
    if (!paidFilterStartDate && !paidFilterEndDate) return paidBatches;
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

  /** Total consolidado de lotes pagados (en PEN para stats) */
  const totalPaidAmount = useMemo(
    () => paidBatches.reduce((sum, b) => sum + (b.total_pen || b.total || 0), 0),
    [paidBatches],
  );

  // ── Callbacks ─────────────────────────────────────────────────────────
  const resetPaidFilter = useCallback(() => {
    setPaidFilterStartDate('');
    setPaidFilterEndDate('');
  }, []);

  const togglePaidBatchExpanded = useCallback((batchId) => {
    setExpandedPaidBatches((prev) => {
      const next = { ...prev };
      if (next[batchId]) delete next[batchId];
      else next[batchId] = true;
      return next;
    });
  }, []);

  // Comprobante
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
    if (!editComprobanteForm.payment_proof && !editComprobanteForm.payment_proof_link) {
      showToast('Debe adjuntar un archivo o ingresar un link de comprobante', 'error');
      return;
    }
    setSavingComprobante(true);
    try {
      const formData = new FormData();
      formData.append('batch_id', editComprobanteBatch.batch_id);
      formData.append('cdp_type', editComprobanteForm.cdp_type);
      formData.append('cdp_serie', editComprobanteForm.cdp_serie);
      formData.append('cdp_number', editComprobanteForm.cdp_number);
      if (editComprobanteForm.payment_proof_link) formData.append('payment_proof_link', editComprobanteForm.payment_proof_link);
      if (editComprobanteForm.payment_proof) formData.append('payment_proof', editComprobanteForm.payment_proof);
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
    } catch {
      showToast('Error al actualizar comprobante', 'error');
    }
    setSavingComprobante(false);
  }, [apiBase, closeEditComprobante, editComprobanteBatch, editComprobanteForm, loadPaidBatches, showToast]);

  // Export
  const openExportModal = useCallback(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setExportFilter({
      startDate: formatDateIso(thirtyDaysAgo),
      endDate: getLocalDateString(),
      preset: '30days',
    });
    setShowExportModal(true);
  }, []);

  const closeExportModal = useCallback(() => setShowExportModal(false), []);

  const setExportPreset = useCallback((preset) => {
    const now = new Date();
    const startDate = new Date(now);
    switch (preset) {
      case '7days':  startDate.setDate(now.getDate() - 7);  break;
      case '30days': startDate.setDate(now.getDate() - 30); break;
      case '90days': startDate.setDate(now.getDate() - 90); break;
      case 'custom': setExportFilter((prev) => ({ ...prev, preset: 'custom' })); return;
    }
    setExportFilter({
      startDate: formatDateIso(startDate),
      endDate: getLocalDateString(),
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

  return {
    // Filters
    paidFilterStartDate, setPaidFilterStartDate,
    paidFilterEndDate, setPaidFilterEndDate,
    expandedPaidBatches,
    // Derived
    filteredPaidBatches, totalPaidAmount,
    // Comprobante
    showEditComprobanteModal, editComprobanteBatch,
    editComprobanteForm, setEditComprobanteForm,
    savingComprobante,
    openEditComprobante, closeEditComprobante,
    onEditComprobanteFileChange, saveComprobante,
    // Export
    showExportModal, exportFilter, setExportFilter,
    openExportModal, closeExportModal,
    setExportPreset, exportPaidExcelWithFilter,
    // Batch expand
    resetPaidFilter, togglePaidBatchExpanded,
  };
}
