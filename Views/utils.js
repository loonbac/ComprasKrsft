/**
 * @file Utilidades compartidas del módulo Compras
 * @module compraskrsft/utils
 */
import {
  formatDate as _fmtDate,
  getLocalDateString as _getLocalDateString,
} from '@/services/DateTimeService';
// ── Constantes ──────────────────────────────────────────────────────────────

/** Intervalo de polling en milisegundos */
export const POLLING_INTERVAL_MS = 3000;

/** Versión del caché */
export const CACHE_VERSION = 'v1';

/** Prefijo para claves de caché en localStorage */
export const CACHE_PREFIX = `compras_${CACHE_VERSION}_`;

/** Paleta de colores asignada a proyectos por índice */
export const PROJECT_COLORS = [
  '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#6366f1', '#84cc16',
];

// ── Caché ───────────────────────────────────────────────────────────────────

/**
 * Compara dos arrays por igualdad profunda (serialización JSON)
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
export const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Guarda datos en localStorage con timestamp
 * @param {string} key
 * @param {*} data
 */
export const saveToCache = (key, data) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn('Cache save error:', e);
  }
};

/**
 * Carga datos desde localStorage
 * @param {string} key
 * @returns {*|null}
 */
export const loadFromCache = (key) => {
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

// ── Formato ─────────────────────────────────────────────────────────────────


/**
 * Retorna la fecha local como string YYYY-MM-DD
 * Delega al DateTimeService centralizado.
 * @returns {string}
 */
export const getLocalDateString = () => _getLocalDateString();

/**
 * Formatea un número con 2 decimales en formato peruano (solo muestra decimales si son necesarios)
 * @param {number|string} num
 * @returns {string}
 */
export const formatNumber = (num) => {
  const value = parseFloat(num || 0);
  const isInteger = value % 1 === 0;
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Redondea un monto monetario a 2 decimales usando centavos como base.
 * Evita errores de punto flotante: roundMoney(5 * 35.7143) → 178.57
 * @param {number} amount
 * @returns {number}
 */
export const roundMoney = (amount) => Math.round((parseFloat(amount) || 0) * 100) / 100;

/**
 * Formatea una fecha como "DD mes" (formato corto)
 * Delega al DateTimeService centralizado.
 * @param {string|Date} dateValue
 * @returns {string}
 */
export const formatDate = (dateValue) => dateValue ? _fmtDate(dateValue, 'short') : '';

// ── API ─────────────────────────────────────────────────────────────────────

/**
 * Obtiene el token CSRF del meta tag
 * @returns {string}
 */
export const getCsrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content || '';

// ── Proyecto ────────────────────────────────────────────────────────────────

/**
 * Obtiene el color asignado a un proyecto por su ID
 * @param {number|string} projectId
 * @returns {string} Color hex
 */
export const getProjectColor = (projectId) => {
  const index = Number(projectId || 0) % PROJECT_COLORS.length;
  return PROJECT_COLORS[index];
};

/**
 * Formatea el nombre del proyecto para mostrar: abbreviation - ceco_codigo
 * Si no tiene abbreviation o ceco_codigo, retorna el project_name completo
 * @param {Object} item - Objeto que puede tener project_abbreviation, ceco_codigo y project_name
 * @returns {string} Nombre formateado del proyecto
 */
export const formatProjectDisplay = (item) => {
  if (item?.project_abbreviation && item?.ceco_codigo) {
    let code = item.ceco_codigo;
    // Append expense type suffix to CECO code
    const suffix = { mo: '01', direct: '02', indirect: '03' };
    if (item.expense_type && suffix[item.expense_type]) {
      code = code + suffix[item.expense_type];
    }
    return `${item.project_abbreviation} – ${code}`;
  }
  return item?.project_name || '-';
};

/**
 * Determina si un proyecto está en progreso (no finalizado)
 * @param {Object} project
 * @returns {boolean}
 */
export const isProjectInProgress = (project) => {
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

// ── Órdenes ─────────────────────────────────────────────────────────────────

/**
 * Obtiene el título legible de una orden
 * @param {Object} order
 * @returns {string}
 */
export const getOrderTitle = (order) => {
  if (order.type === 'service') return order.description;
  // For materials: prefer TIPO DE MATERIAL, fall back to ESPECIFICACION TECNICA
  if (order.material_type) return order.material_type;
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    return typeof mat === 'object' ? mat.name : mat;
  }
  return order.description;
};

/**
 * Obtiene la cantidad de una orden (display)
 * @param {Object} order
 * @returns {string|number}
 */
export const getOrderQty = (order) => {
  if (order.type === 'service') return '-';
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    if (typeof mat === 'object' && mat.qty && mat.qty > 0) return mat.qty;
  }
  return '-';
};

/**
 * Obtiene la cantidad numérica de una orden
 * @param {Object} order
 * @returns {number}
 */
export const getOrderQtyNum = (order) => {
  if (order.type === 'service') return 1;
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    if (typeof mat === 'object' && mat.qty) return parseInt(mat.qty, 10) || 1;
  }
  return 1;
};

// ── Alertas de pago ─────────────────────────────────────────────────────────

/**
 * Calcula los días restantes hasta la fecha de vencimiento
 * @param {string|null} dueDate
 * @returns {number|null}
 */
export const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Determina el estado de alerta de pago de un lote
 * @param {Object} batch
 * @returns {'overdue'|'today'|'urgent'|'warning'|'normal'|null}
 */
export const getPaymentAlertStatus = (batch) => {
  const daysRemaining = getDaysUntilDue(batch.due_date);
  if (daysRemaining === null) return null;
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return 'today';
  if (daysRemaining <= 3) return 'urgent';
  if (daysRemaining <= 7) return 'warning';
  return 'normal';
};

/**
 * Obtiene etiqueta legible del estado de vencimiento
 * @param {Object} batch
 * @returns {string}
 */
export const getAlertLabel = (batch) => {
  const daysRemaining = getDaysUntilDue(batch.due_date);
  if (daysRemaining === null) return '';
  if (daysRemaining < 0) return `Vencido hace ${Math.abs(daysRemaining)} días`;
  if (daysRemaining === 0) return 'Vence HOY';
  return `Vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`;
};

/**
 * Obtiene etiqueta del tipo de pago con info de vencimiento
 * @param {Object} batch
 * @returns {string}
 */
export const getPaymentTypeLabel = (batch) => {
  if (batch.payment_type === 'loan') {
    const dueLabel = getAlertLabel(batch);
    return dueLabel ? `Crédito · ${dueLabel}` : 'Crédito';
  }
  return 'Contado';
};

// ── Lotes ───────────────────────────────────────────────────────────────────

/**
 * Verifica si todos los items de un lote fueron entregados
 * @param {Object} batch
 * @returns {boolean}
 */
export const batchAllDelivered = (batch) =>
  batch.orders?.every((order) => order.delivery_confirmed) || false;

/**
 * Verifica si un lote tiene comprobante incompleto
 * @param {Object} batch
 * @returns {boolean}
 */
export const batchMissingComprobante = (batch) =>
  !batch.cdp_type || !batch.cdp_serie || !batch.cdp_number;
