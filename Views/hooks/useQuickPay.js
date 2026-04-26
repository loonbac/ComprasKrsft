/**
 * @file Hook de lógica del modal "Pago Rápido"
 * @module compraskrsft/hooks/useQuickPay
 */
import { useState, useCallback, useMemo } from 'react';
import { getCsrfToken, isProjectInProgress, getLocalDateString } from '../utils';

/**
 * @typedef {Object} UseQuickPayParams
 * @property {string} apiBase
 * @property {Function} showToast
 * @property {Function} loadPaidBatches
 * @property {Function} setActiveTab
 */

/**
 * Estado y lógica del flujo de Pago Rápido (wizard de 3 pasos)
 *
 * @param {UseQuickPayParams} ctx
 */
export function useQuickPay(ctx) {
  const { apiBase, showToast, loadPaidBatches, setActiveTab, fetchExchangeRate, currentExchangeRate, loadingRate, permissions = {} } = ctx;

  const [showQuickPayModal, setShowQuickPayModal] = useState(false);
  const [quickPayStep, setQuickPayStep] = useState(1);
  const [quickPaySelectedProject, setQuickPaySelectedProject] = useState(null);
  const [quickPayProjects, setQuickPayProjects] = useState([]);
  const [quickPayItems, setQuickPayItems] = useState([]);
  const [quickPayLoading, setQuickPayLoading] = useState(false);

  const [quickPayMaterialForm, setQuickPayMaterialForm] = useState({
    qty: 1,
    material_type: '',
    description: '',
    diameter: '',
    series: '',
    notes: '',
  });

  const [quickPayApprovalForm, setQuickPayApprovalForm] = useState({
    seller_name: '',
    seller_document: '',
    payment_type: 'cash',
    currency: 'PEN',
    expense_type: 'directo',
    issue_date: getLocalDateString(),
    due_date: '',
  });

  const [quickPayPaymentForm, setQuickPayPaymentForm] = useState({
    cdp_type: '',
    cdp_serie: '',
    cdp_number: '',
    payment_proof: null,
    payment_proof_link: '',
    payment_bank: '',
  });

  // ── Derived ───────────────────────────────────────────────────────────
  const quickPayAvailableProjects = useMemo(
    () => quickPayProjects.filter(isProjectInProgress),
    [quickPayProjects],
  );

  const quickPaySubtotal = useMemo(
    () => quickPayItems.reduce((sum, item) => sum + (item.subtotal || 0), 0),
    [quickPayItems],
  );

  // ── Callbacks ─────────────────────────────────────────────────────────
  const openQuickPayModal = useCallback(async () => {
    setShowQuickPayModal(true);
    setQuickPayStep(1);
    setQuickPaySelectedProject(null);
    setQuickPayItems([]);
    setQuickPayMaterialForm({ qty: 1, material_type: '', description: '', diameter: '', series: '', notes: '' });
    try {
      const res = await fetch(`${apiBase}/projects`);
      const data = await res.json();
      setQuickPayProjects(data.projects || []);
    } catch {
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
    if (!quickPayMaterialForm.material_type || !quickPayMaterialForm.qty) {
      showToast('Completa tipo de material y cantidad', 'error');
      return;
    }
    setQuickPayItems((prev) => [
      ...prev,
      {
        qty: quickPayMaterialForm.qty,
        material_type: quickPayMaterialForm.material_type.trim(),
        description: quickPayMaterialForm.description.trim() || '-',
        diameter: quickPayMaterialForm.diameter || '',
        series: quickPayMaterialForm.series || '',
        notes: quickPayMaterialForm.notes || '',
        price: 0,
        subtotal: 0,
      },
    ]);
    setQuickPayMaterialForm({ qty: 1, material_type: '', description: '', diameter: '', series: '', notes: '' });
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
          : item,
      ),
    );
  }, []);

  const onQuickPayProofChange = useCallback((e) => {
    setQuickPayPaymentForm((prev) => ({ ...prev, payment_proof: e.target.files[0] || null }));
  }, []);

  const onQuickPayApprovalCurrencyChange = useCallback((newCurrency) => {
    if (newCurrency === 'USD') {
      fetchExchangeRate();
      setQuickPayApprovalForm((prev) => ({
        ...prev,
        issue_date: prev.issue_date || getLocalDateString(),
      }));
    }
  }, [fetchExchangeRate]);

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
      formData.append('expense_type', quickPayApprovalForm.expense_type || 'directo');
      formData.append('issue_date', quickPayApprovalForm.issue_date);
      if (quickPayApprovalForm.payment_type === 'loan') {
        formData.append('due_date', quickPayApprovalForm.due_date);
      }
      formData.append('cdp_type', quickPayPaymentForm.cdp_type || '');
      formData.append('cdp_serie', quickPayPaymentForm.cdp_serie || '');
      formData.append('cdp_number', quickPayPaymentForm.cdp_number || '');
      if (quickPayPaymentForm.payment_proof_link) formData.append('payment_proof_link', quickPayPaymentForm.payment_proof_link);
      if (quickPayPaymentForm.payment_proof) formData.append('payment_proof', quickPayPaymentForm.payment_proof);
      formData.append('payment_bank', quickPayPaymentForm.payment_bank || '');
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
          })),
        ),
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
        if (permissions.paid_limited) {
          await loadPaidBatches();
          setActiveTab('paid');
        }
      } else {
        showToast(data.message || 'Error', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
    setQuickPayLoading(false);
  }, [apiBase, closeQuickPayModal, loadPaidBatches, quickPayApprovalForm, quickPayItems, quickPayPaymentForm, quickPaySelectedProject, setActiveTab, showToast]);

  return {
    showQuickPayModal,
    quickPayStep, setQuickPayStep,
    quickPaySelectedProject,
    quickPayAvailableProjects,
    quickPayItems,
    quickPayMaterialForm, setQuickPayMaterialForm,
    quickPayApprovalForm, setQuickPayApprovalForm,
    quickPayPaymentForm, setQuickPayPaymentForm,
    quickPayLoading,
    quickPaySubtotal,
    openQuickPayModal, closeQuickPayModal,
    selectProjectForQuickPay,
    addQuickPayItem, removeQuickPayItem,
    proceedToQuickPayReview,
    updateQuickPayItemPrice,
    onQuickPayProofChange,
    onQuickPayApprovalCurrencyChange,
    completeQuickPay,
    currentExchangeRate,
    loadingRate,
  };
}
