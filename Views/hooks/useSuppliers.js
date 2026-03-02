/**
 * @file Hook de gestión de proveedores
 * @module compraskrsft/hooks/useSuppliers
 */
import { useState, useCallback } from 'react';
import { getCsrfToken } from '../utils';

/**
 * Hook para gestionar proveedores:
 * - Autocompletado predictivo (búsqueda)
 * - Modal de gestión con lista completa + gastos
 * - Selección de proveedor desde sugerencias
 *
 * @param {{ apiBase: string }} params
 */
export function useSuppliers({ apiBase }) {
  // ── Autocompletado ────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Modal de gestión ──────────────────────────────────────────────────
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [suppliersWithSpending, setSuppliersWithSpending] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  // ── Edición de proveedor ──────────────────────────────────────────────
  const [editingSupplier, setEditingSupplier] = useState(null); // id del proveedor en edición
  const [editForm, setEditForm] = useState({});
  const [savingSupplier, setSavingSupplier] = useState(false);

  /**
   * Busca proveedores para autocompletado predictivo.
   * Se activa al escribir en los campos Proveedor/RUC.
   * @param {string} query
   */
  const searchSuppliers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${apiBase}/suppliers/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && data.suppliers.length > 0) {
        setSuggestions(data.suppliers);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setLoadingSuggestions(false);
  }, [apiBase]);

  /**
   * Cierra el panel de sugerencias
   */
  const hideSuggestions = useCallback(() => {
    // Delay para permitir que el click en sugerencia se registre
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  /**
   * Carga todos los proveedores con su gasto total en PEN para el modal
   */
  const loadSuppliersWithSpending = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const res = await fetch(`${apiBase}/suppliers/with-spending`);
      const data = await res.json();
      if (data.success) {
        setSuppliersWithSpending(data.suppliers || []);
      }
    } catch (e) {
      console.error('Error cargando proveedores:', e);
    }
    setLoadingSuppliers(false);
  }, [apiBase]);

  /**
   * Abre el modal de gestión de proveedores
   */
  const openSuppliersModal = useCallback(() => {
    setShowSuppliersModal(true);
    setExpandedSupplier(null);
    loadSuppliersWithSpending();
  }, [loadSuppliersWithSpending]);

  /**
   * Cierra el modal de gestión de proveedores
   */
  const closeSuppliersModal = useCallback(() => {
    setShowSuppliersModal(false);
    setExpandedSupplier(null);
  }, []);

  /**
   * Toggle del desplegable de un proveedor en el modal
   * @param {number} supplierId
   */
  const toggleSupplierExpanded = useCallback((supplierId) => {
    setExpandedSupplier((prev) => (prev === supplierId ? null : supplierId));
  }, []);

  /**
   * Desactivar un proveedor
   * @param {number} id
   */
  const deactivateSupplier = useCallback(async (id) => {
    try {
      const res = await fetch(`${apiBase}/suppliers/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
      });
      const data = await res.json();
      if (data.success) {
        await loadSuppliersWithSpending();
      }
    } catch (e) {
      console.error('Error desactivando proveedor:', e);
    }
  }, [apiBase, loadSuppliersWithSpending]);

  /**
   * Inicia la edición de un proveedor: carga sus datos en el formulario
   * @param {object} supplier
   */
  const startEditSupplier = useCallback((supplier) => {
    setEditingSupplier(supplier.id);
    setEditForm({
      name: supplier.name || '',
      document: supplier.document || '',
      document_type: supplier.document_type || 'RUC',
      contact_phone: supplier.contact_phone || '',
      contact_email: supplier.contact_email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
  }, []);

  /**
   * Cancela la edición
   */
  const cancelEditSupplier = useCallback(() => {
    setEditingSupplier(null);
    setEditForm({});
  }, []);

  /**
   * Guarda los cambios del proveedor editado
   */
  const saveSupplier = useCallback(async () => {
    if (!editingSupplier) return;
    setSavingSupplier(true);
    try {
      const res = await fetch(`${apiBase}/suppliers/${editingSupplier}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingSupplier(null);
        setEditForm({});
        await loadSuppliersWithSpending();
      }
    } catch (e) {
      console.error('Error guardando proveedor:', e);
    }
    setSavingSupplier(false);
  }, [apiBase, editingSupplier, editForm, loadSuppliersWithSpending]);

  return {
    // Autocompletado
    suggestions,
    loadingSuggestions,
    showSuggestions,
    searchSuppliers,
    hideSuggestions,
    // Modal
    showSuppliersModal,
    suppliersWithSpending,
    loadingSuppliers,
    expandedSupplier,
    openSuppliersModal,
    closeSuppliersModal,
    toggleSupplierExpanded,
    deactivateSupplier,
    // Edición
    editingSupplier,
    editForm,
    setEditForm,
    savingSupplier,
    startEditSupplier,
    cancelEditSupplier,
    saveSupplier,
  };
}
