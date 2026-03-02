/**
 * @file Hook para gestionar selección mixta de materiales (Inventario + Compra Nueva).
 * @module compraskrsft/hooks/useMixedSource
 *
 * Funcionalidad:
 * - Buscar stock disponible en almacén
 * - Calcular vista previa de división de cantidades
 * - Procesar selección mixta con persistencia
 * - Gestionar estado de asignaciones por orden
 */
import { useState, useCallback, useMemo } from 'react';

const API_PREFIX = '/api/compraskrsft/cross-flow';

/**
 * @returns {{
 *   stockAssignments: Object,
 *   setStockAssignments: Function,
 *   searchAvailableStock: (search: string, projectId?: number) => Promise<Array>,
 *   previewMixed: (orderId: number, itemId: number, qty: number) => Promise<Object>,
 *   processMixed: (data: Object) => Promise<Object>,
 *   removeAssignment: (orderId: number) => void,
 *   getStockSummary: (orders: Array, prices: Object) => Object,
 *   loading: boolean,
 *   error: string|null,
 * }}
 */
export default function useMixedSource() {
  const [stockAssignments, setStockAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Buscar materiales disponibles en almacén.
   */
  const searchAvailableStock = useCallback(async (search, projectId = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ search });
      if (projectId) params.append('project_id', projectId);

      const res = await fetch(`${API_PREFIX}/available-stock?${params}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'No se pudo buscar stock');
        return [];
      }

      // Mapear al formato esperado por StockLotPanel
      return (data.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sku: item.sku,
        available: item.available,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        currency: item.currency,
        unit: item.unit,
        location: item.location,
        diameter: item.diameter,
        series: item.series,
        materialType: item.materialType,
      }));
    } catch (err) {
      setError('Error al buscar stock disponible');
      console.error('searchAvailableStock error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Vista previa de la división de cantidades (sin persistir).
   */
  const previewMixed = useCallback(async (orderId, inventoryItemId, qtyFromStock) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_PREFIX}/preview-mixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
        },
        body: JSON.stringify({
          order_id: orderId,
          inventory_item_id: inventoryItemId,
          qty_from_stock: qtyFromStock,
        }),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
      return data;
    } catch (err) {
      setError('Error al calcular vista previa');
      console.error('previewMixed error:', err);
      return { success: false, message: 'Error de conexión' };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Procesar selección mixta con persistencia.
   */
  const processMixed = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_PREFIX}/process-mixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
      return data;
    } catch (err) {
      setError('Error al procesar selección mixta');
      console.error('processMixed error:', err);
      return { success: false, message: 'Error de conexión' };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Eliminar asignación de stock para una orden.
   */
  const removeAssignment = useCallback((orderId) => {
    setStockAssignments((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

  /**
   * Calcular resumen de costos para todas las órdenes (stock + compra nueva).
   *
   * @param {Array} orders — lista de órdenes
   * @param {Object} prices — { orderId: priceForPurchasePortion }
   * @returns {{ totalStock: number, totalPurchase: number, grandTotal: number, details: Array }}
   */
  const getStockSummary = useMemo(
    () => (orders, prices) => {
      let totalStock = 0;
      let totalPurchase = 0;
      const details = [];

      for (const order of orders) {
        const assignment = stockAssignments[order.id];
        const purchasePrice = parseFloat(prices[order.id]) || 0;

        if (assignment) {
          const stockCost = (assignment.qty || 0) * (assignment.unitPrice || 0);
          totalStock += stockCost;
          totalPurchase += purchasePrice;

          // Calcular cantidad total requerida
          const materials = Array.isArray(order.materials)
            ? order.materials
            : typeof order.materials === 'string'
            ? JSON.parse(order.materials || '[]')
            : [];
          const totalQty = materials.reduce((s, m) => s + (m.qty || 1), 0) || 1;
          const purchaseQty = Math.max(0, totalQty - (assignment.qty || 0));

          details.push({
            orderId: order.id,
            totalQty,
            stockQty: assignment.qty || 0,
            purchaseQty,
            stockUnitPrice: assignment.unitPrice || 0,
            stockCost,
            purchaseCost: purchasePrice,
            purchaseUnitPrice: purchaseQty > 0 ? purchasePrice / purchaseQty : 0,
            totalCost: stockCost + purchasePrice,
            lotName: assignment.lotName,
            lotLocation: assignment.location,
          });
        } else {
          totalPurchase += purchasePrice;
          details.push({
            orderId: order.id,
            stockQty: 0,
            purchaseQty: null, // full purchase
            stockCost: 0,
            purchaseCost: purchasePrice,
            totalCost: purchasePrice,
          });
        }
      }

      return {
        totalStock,
        totalPurchase,
        grandTotal: totalStock + totalPurchase,
        details,
        hasStockAssignments: Object.keys(stockAssignments).length > 0,
      };
    },
    [stockAssignments],
  );

  return {
    stockAssignments,
    setStockAssignments,
    searchAvailableStock,
    previewMixed,
    processMixed,
    removeAssignment,
    getStockSummary,
    loading,
    error,
  };
}
