/**
 * @file Hook de lógica del tab "Pagadas"
 * @module compraskrsft/hooks/usePaidTab
 */
import { useState, useCallback, useMemo } from 'react';
import { getCsrfToken } from '../utils';

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
 *
 * @param {UsePaidTabParams} ctx
 */
export function usePaidTab(ctx) {
  const { paidBatches, apiBase, showToast, loadPaidBatches } = ctx;

  // ── Filters ───────────────────────────────────────────────────────────
  const [paidFilterStartDate, setPaidFilterStartDate] = useState('');
  const [paidFilterEndDate, setPaidFilterEndDate] = useState('');
  const [expandedPaidBatches, setExpandedPaidBatches] = useState({});
  // 'all' | 'verified' | 'unverified'
  const [verificationFilter, setVerificationFilter] = useState('all');
  // '' = todos, o el valor de cdp_type (p.ej. '104103 - BANCO DE CREDITO M.N. ...')
  const [bankFilter, setBankFilter] = useState('');

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

  // ── Derived ───────────────────────────────────────────────────────────
  /** Lista de bancos únicos disponibles en los lotes pagados */
  const uniqueBanks = useMemo(() => {
    const banks = new Set();
    (paidBatches || []).forEach((b) => {
      if (b.payment_bank) banks.add(b.payment_bank.trim());
    });
    return Array.from(banks).sort();
  }, [paidBatches]);

  const filteredPaidBatches = useMemo(() => {
    return (paidBatches || []).filter((batch) => {
      // Filtro por fecha
      if (paidFilterStartDate || paidFilterEndDate) {
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
      }
      // Filtro por verificación
      if (verificationFilter === 'verified' && !batch.contasis_verified) return false;
      if (verificationFilter === 'unverified' && batch.contasis_verified) return false;
      // Filtro por banco
      if (bankFilter && (batch.payment_bank || '').trim() !== bankFilter) return false;
      return true;
    });
  }, [paidBatches, paidFilterStartDate, paidFilterEndDate, verificationFilter, bankFilter]);

  /** Total consolidado de lotes pagados (en PEN para stats) */
  const totalPaidAmount = useMemo(
    () => paidBatches.reduce((sum, b) => sum + (b.total_pen || b.total || 0), 0),
    [paidBatches],
  );

  // ── Callbacks ─────────────────────────────────────────────────────────
  const resetPaidFilter = useCallback(() => {
    setPaidFilterStartDate('');
    setPaidFilterEndDate('');
    setVerificationFilter('all');
    setBankFilter('');
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

  // ── Verificar batch ─────────────────────────────────────────────────
  const [verifying, setVerifying] = useState(false);
  const verifyBatch = useCallback(async (batchId) => {
    setVerifying(true);
    try {
      const res = await fetch(`${apiBase}/verify-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Factura verificada correctamente', 'success');
        await loadPaidBatches();
      } else {
        showToast(data.message || 'Error al verificar', 'error');
      }
    } catch {
      showToast('Error al verificar factura', 'error');
    }
    setVerifying(false);
  }, [apiBase, loadPaidBatches, showToast]);

  return {
    // Filters
    paidFilterStartDate, setPaidFilterStartDate,
    paidFilterEndDate, setPaidFilterEndDate,
    verificationFilter, setVerificationFilter,
    bankFilter, setBankFilter,
    uniqueBanks,
    expandedPaidBatches,
    // Derived
    filteredPaidBatches, totalPaidAmount,
    // Comprobante
    showEditComprobanteModal, editComprobanteBatch,
    editComprobanteForm, setEditComprobanteForm,
    savingComprobante,
    openEditComprobante, closeEditComprobante,
    onEditComprobanteFileChange, saveComprobante,
    // Verificación
    verifyBatch, verifying,
    // Batch expand
    resetPaidFilter, togglePaidBatchExpanded,
    // Cancellation support (passthrough)
    showToast, loadPaidBatches,
  };
}
