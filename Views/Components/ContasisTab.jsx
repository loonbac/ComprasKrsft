/**
 * @file Contenido del tab "Contasis"
 * @module compraskrsft/components/ContasisTab
 *
 * Replica el formato del Excel Documento_Contasis.xlsx con headers
 * agrupados multi-fila tipo Excel (COMPROBANTE, PROVEEDOR, ADQUISICIONES, etc.)
 */
import { useState, useMemo, useCallback } from 'react';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import Button from './ui/Button';



// ── Columnas con campo directo del API (letra verde) ────────────────────────
// Solo las columnas que YA tienen campo confirmado se pintan verde
const MAPPED_KEYS = new Set([
  'A', 'B', 'C', 'D', 'F', 'G', 'H', 'I',
  'J', 'K', 'P', 'S', 'W', 'AB', 'AD', 'AE', 'AR', 'AS2'
]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatMonthKey(mk) {
  const [y, m] = mk.split('-');
  const ms = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${ms[parseInt(m,10)-1]} ${y}`;
}
function formatContasisDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const year = parts[0].substring(2, 4);
    const month = parts[1];
    const day = parts[2].substring(0, 2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  const value = parseFloat(num);
  if (isNaN(value)) return '';
  return value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const mapRecord = (src, prefix, glosaDesc = null) => {
  const isForeign = src.currency !== 'PEN' && src.currency !== 'SOLES';
  const exRate = (isForeign && parseFloat(src.exchange_rate) > 0) ? parseFloat(src.exchange_rate) : 1;

  // Montos convertidos a SOLES
  const rawBase = parseFloat(src.amount || 0);
  const rawIgv = parseFloat(src.igv_amount || 0);
  const rawTotal = parseFloat(src.total_with_igv || 0);

  const baseAmountPEN = rawBase * exRate;
  const igvAmountPEN = rawIgv * exRate;
  const totalPEN = rawTotal * exRate;
  const usdTotal = isForeign ? rawTotal : null;

  const igvEnabled = src.igv_enabled;
  const finalGlosa = glosaDesc || src.description || '';

  return {
    _id: `${prefix}-${src.batch_id ?? src.id}`,
    // ── Fechas──────────────────────
    A:  formatContasisDate(src.issue_date),
    B:  formatContasisDate(src.due_date),
    // ── Comprobante ─────────────────
    C:  src.cdp_type ?? '',
    D:  src.cdp_serie ?? '',
    E:  '', // Año Emisión DUA o DSI
    F:  src.cdp_number ?? '',
    // ── Proveedor ────────────────────
    G:  src.seller_document ? (src.seller_document.length === 11 ? '6' : '1') : '', // Deduce RUC=6, DNI=1
    H:  src.seller_document ?? '',
    I:  src.seller_name ?? '',
    // ── Montos (Siempre en SOLES) ────
    J:  igvEnabled ? formatNumber(baseAmountPEN) : '',
    K:  igvEnabled ? formatNumber(igvAmountPEN) : '',
    L:  '', M:  '',
    N:  '', O:  '',
    P:  (!igvEnabled && baseAmountPEN > 0) ? formatNumber(baseAmountPEN) : '',
    Q:  '', R:  '',
    S:  totalPEN ? formatNumber(totalPEN) : '',
    // ── Otros ────────────────────────
    T:  '', U:  '', V:  '',
    W:  !isForeign 
          ? '1.0000' 
          : (parseFloat(src.exchange_rate) > 0 ? parseFloat(src.exchange_rate).toFixed(4) : ''),
    X:  '', Y:  '', Z:  '', AA: '',
    AB: src.currency ?? 'PEN',
    // ── Columnas adicionales ─────────
    AC: usdTotal ? formatNumber(usdTotal) : '',
    AD: formatContasisDate(src.due_date),
    AE: 'CRE',
    AF: '', AG: '', AH: '',
    AI: src.ceco_codigo ?? '', AJ: '', AK: '', AL: '', AM: '', AN: '',
    AO: '', AP: '', AQ: '',
    AR: src.igv_enabled ? (src.igv_rate ? parseFloat(src.igv_rate).toFixed(2) : '18.00') : '',
    AS2: finalGlosa, // Glosa con items concatenados o descripción individual
    AT: '', AU: '', AV: '', AW: '', AX: '',
  };
};


// Extrae el título de un item de orden (idéntico a getOrderTitle en utils.js)
function getItemTitle(order) {
  if (order.type === 'service') return order.description || '';
  if (order.material_type) return order.material_type;
  if (order.materials && order.materials.length > 0) {
    const mat = order.materials[0];
    return typeof mat === 'object' ? (mat.name || mat.description || '') : (mat || '');
  }
  return order.description || '';
}

// Construye la Glosa de un batch uniendo los títulos de sus órdenes
function buildBatchGlosa(orders) {
  return orders.map(o => getItemTitle(o)).filter(Boolean).join(' - ');
}

// Determina el CECO del proyecto con mayor gasto dentro de un batch
// Replica la lógica de formatProjectDisplay: ceco_codigo + sufijo de expense_type
function getCecoMayorGasto(orders) {
  const expSuffix = { mo: '01', direct: '02', indirect: '03' };
  const cecoTotals = {};
  orders.forEach(o => {
    let ceco = o.ceco_codigo || '';
    if (!ceco) return;
    // Agregar sufijo de tipo de gasto (igual que en formatProjectDisplay)
    if (o.expense_type && expSuffix[o.expense_type]) {
      ceco = ceco + expSuffix[o.expense_type];
    }
    const amt = parseFloat(o.amount || 0);
    cecoTotals[ceco] = (cecoTotals[ceco] || 0) + amt;
  });
  let maxCeco = '';
  let maxAmt = -1;
  for (const [ceco, total] of Object.entries(cecoTotals)) {
    if (total > maxAmt) { maxAmt = total; maxCeco = ceco; }
  }
  return maxCeco;
}

// Agrega los montos de las órdenes del batch y construye UNA sola fila de Contasis
function buildBatchRow(batch, prefix, glosa) {
  const orders = batch.orders || [];
  const igvEnabled = batch.igv_enabled ?? (orders.length > 0 && !!orders[0].igv_enabled);
  const igvRate = batch.igv_rate ?? (orders.length > 0 ? orders[0].igv_rate : 18);
  const exchangeRate = batch.exchange_rate ?? (orders.length > 0 ? orders[0].exchange_rate : null);

  // Sumar base imponible e IGV de los ítems (Lógica calcada de RecopilacionTab)
  let totalBase = 0;
  let totalIgv = 0;
  orders.forEach(o => {
    const paidBase = parseFloat(o.amount || 0);
    const paidIgv = (o.igv_enabled || batch.igv_enabled) ? paidBase * (parseFloat(o.igv_rate ?? 18) / 100) : 0;
    totalBase += paidBase;
    totalIgv += paidIgv;
  });

  const totalWithIgv = totalBase + totalIgv;

  // CECO del proyecto con mayor gasto en este batch
  const cecoCodigo = getCecoMayorGasto(orders);

  const src = {
    amount:          totalBase,
    igv_amount:      totalIgv,
    total_with_igv:  totalWithIgv,
    igv_enabled:     igvEnabled,
    igv_rate:        igvRate,
    exchange_rate:   exchangeRate,
    currency:        batch.currency ?? 'PEN',
    issue_date:      batch.issue_date,
    due_date:        batch.due_date,
    cdp_type:        batch.cdp_type,
    cdp_serie:       batch.cdp_serie,
    cdp_number:      batch.cdp_number,
    seller_name:     batch.seller_name,
    seller_document: batch.seller_document,
    payment_type:    batch.payment_type,
    batch_id:        batch.batch_id,
    ceco_codigo:     cecoCodigo,
  };
  return mapRecord(src, prefix, glosa);
}

/**
 * Construye una fila de NEGACIÓN para una factura anulada.
 * - Columnas C/D/F → datos de la Nota de Crédito (nc_type=07, nc_serie, nc_number)
 * - Columnas Y/Z/AA → datos del comprobante original (cdp_type, cdp_serie, cdp_number)
 * - Montos J/K/S/P → multiplicados por -1 (negativo)
 */
function buildCancellationRow(batch, prefix) {
  const glosa = buildBatchGlosa(batch.orders || []) + ' [ANULACIÓN]';
  const baseRow = buildBatchRow(batch, prefix + '-NC', glosa);

  // Sobreescribir Comprobante con datos de la Nota de Crédito
  baseRow.C = batch.nc_type || '07';
  baseRow.D = batch.nc_serie || '';
  baseRow.F = batch.nc_number || '';

  // Columnas de referencia al documento original (X=fecha emisión, Y/Z/AA=tipo/serie/número)
  baseRow.X = formatContasisDate(batch.issue_date || '');
  baseRow.Y = batch.cdp_type || '';
  baseRow.Z = batch.cdp_serie || '';
  baseRow.AA = batch.cdp_number || '';

  // Negar todos los montos para que el asiento contable sume 0
  ['J', 'K', 'P', 'S', 'AC'].forEach(key => {
    if (baseRow[key] && baseRow[key] !== '' && baseRow[key] !== '—') {
      const num = parseFloat(String(baseRow[key]).replace(/,/g, ''));
      if (!isNaN(num) && num !== 0) {
        baseRow[key] = formatNumber(-num);
      }
    }
  });

  return baseRow;
}

function buildRows(pendingOrders, toPayBatches, paidBatches) {
  const rows = [];

  // Pendientes y Por Pagar: excluidos de Contasis (solo facturas realmente pagadas)

  // Pagados: 1 fila por lote/factura, montos sumados de todas las órdenes del lote
  // Excluir facturas ya verificadas (no deben aparecer en Contasis)
  paidBatches
    .filter(batch => !batch.contasis_verified)
    .forEach(batch => {
      const glosa = buildBatchGlosa(batch.orders || []);
      rows.push(buildBatchRow(batch, 'd', glosa));

      // Si la factura está anulada, generar una SEGUNDA fila de negación
      if (batch.cancellation_status === 'anulada') {
        rows.push(buildCancellationRow(batch, 'd'));
      }
    });

  return rows;
}

// ── Orden de columnas de datos ────────────────────────────────────────────────
const DATA_KEYS = [
  'A','B','C','D','E','F','G','H','I',
  'J','K','L','M','N','O','P','Q','R','S',
  'T','U','V','W','X','Y','Z','AA','AB',
  'AC','AD','AE','AF','AG','AH','AI','AJ',
  'AK','AL','AM','AN','AO','AP','AQ','AR',
  'AS2','AT','AU','AV','AW','AX'
];

// ── Definición de columnas agrupadas para el DataGrid ─────────────────────────
const COLUMN_GROUPS = [
  {
    label: 'FECHAS',
    color: 'bg-slate-100/80 text-slate-700 border-slate-200',
    cols: [
      { key: 'A', label: 'Emisión', w: 90 },
      { key: 'B', label: 'Vencimiento', w: 90 },
    ],
  },
  {
    label: 'COMPROBANTE DE PAGO',
    color: 'bg-indigo-50/80 text-indigo-700 border-indigo-200',
    cols: [
      { key: 'C', label: 'Tipo', w: 55 },
      { key: 'D', label: 'Serie', w: 80 },
      { key: 'E', label: 'Año DUA', w: 70 },
      { key: 'F', label: 'Nº Comp.', w: 100 },
    ],
  },
  {
    label: 'PROVEEDOR',
    color: 'bg-teal-50/80 text-teal-700 border-teal-200',
    cols: [
      { key: 'G', label: 'Tipo', w: 48 },
      { key: 'H', label: 'Nº Documento', w: 110 },
      { key: 'I', label: 'Razón Social', w: 200 },
    ],
  },
  {
    label: 'ADQ. GRAV. (EXPORT.)',
    color: 'bg-blue-50/80 text-blue-700 border-blue-200',
    cols: [
      { key: 'J', label: 'Base Imp.', w: 100 },
      { key: 'K', label: 'IGV', w: 90 },
    ],
  },
  {
    label: 'ADQ. GRAV. (MIXTA)',
    color: 'bg-violet-50/80 text-violet-700 border-violet-200',
    cols: [
      { key: 'L', label: 'Base Imp.', w: 100 },
      { key: 'M', label: 'IGV', w: 90 },
    ],
  },
  {
    label: 'ADQ. GRAV. (NO GRAV.)',
    color: 'bg-purple-50/80 text-purple-700 border-purple-200',
    cols: [
      { key: 'N', label: 'Base Imp.', w: 100 },
      { key: 'O', label: 'IGV', w: 90 },
    ],
  },
  {
    label: 'OTROS MONTOS',
    color: 'bg-emerald-50/80 text-emerald-700 border-emerald-200',
    cols: [
      { key: 'P', label: 'No Grav.', w: 90 },
      { key: 'Q', label: 'ISC', w: 70 },
      { key: 'R', label: 'Otros Trib.', w: 90 },
      { key: 'S', label: 'Total', w: 100 },
    ],
  },
  {
    label: 'SUJETO NO DOMIC. / DETRACCIÓN',
    color: 'bg-slate-50/80 text-slate-600 border-slate-200',
    cols: [
      { key: 'T', label: 'Nº Comp.', w: 90 },
      { key: 'U', label: 'Detrac. Nº', w: 90 },
      { key: 'V', label: 'Detrac. Fecha', w: 90 },
    ],
  },
  {
    label: 'T.C. / REF. DOC. ORIGINAL',
    color: 'bg-cyan-50/80 text-cyan-700 border-cyan-200',
    cols: [
      { key: 'W', label: 'T. Cambio', w: 80 },
      { key: 'X', label: 'Fecha', w: 85 },
      { key: 'Y', label: 'Tipo', w: 55 },
      { key: 'Z', label: 'Serie', w: 70 },
      { key: 'AA', label: 'Nº Comp.', w: 90 },
    ],
  },
  {
    label: 'MONEDA / CONDICIÓN',
    color: 'bg-amber-50/80 text-amber-700 border-amber-200',
    cols: [
      { key: 'AB', label: 'Moneda', w: 65 },
      { key: 'AC', label: 'Eq. USD', w: 90 },
      { key: 'AD', label: 'Vencimiento', w: 90 },
      { key: 'AE', label: 'Condición', w: 70 },
    ],
  },
  {
    label: 'CUENTAS CONTABLES',
    color: 'bg-rose-50/80 text-rose-700 border-rose-200',
    cols: [
      { key: 'AF', label: 'Cta. Base', w: 90 },
      { key: 'AG', label: 'Cta. Otros', w: 90 },
      { key: 'AH', label: 'Cta. Total', w: 90 },
    ],
  },
  {
    label: 'CECOS',
    color: 'bg-lime-50/80 text-lime-700 border-lime-200',
    cols: [
      { key: 'AI', label: 'CECO 1', w: 90 },
      { key: 'AJ', label: 'CECO 2', w: 90 },
    ],
  },
  {
    label: 'RÉGIMEN ESPECIAL',
    color: 'bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-200',
    cols: [
      { key: 'AK', label: 'Régimen', w: 80 },
      { key: 'AL', label: '%', w: 60 },
      { key: 'AM', label: 'Importe', w: 90 },
      { key: 'AN', label: 'Serie', w: 80 },
      { key: 'AO', label: 'Número', w: 80 },
      { key: 'AP', label: 'Fecha', w: 85 },
    ],
  },
  {
    label: 'OTROS CAMPOS',
    color: 'bg-gray-100/80 text-gray-700 border-gray-200',
    cols: [
      { key: 'AQ', label: 'Cód. Presup.', w: 85 },
      { key: 'AR', label: '% IGV', w: 60 },
      { key: 'AS2', label: 'Glosa', w: 220 },
      { key: 'AT', label: 'Cond. Perc.', w: 80 },
      { key: 'AU', label: 'Imp. Perc.', w: 90 },
      { key: 'AV', label: 'Clasif. B/S', w: 90 },
      { key: 'AW', label: 'Imp. Bolsas', w: 85 },
      { key: 'AX', label: 'Cta. ICBPER', w: 85 },
    ],
  },
];

// Flat list of all columns for rendering body cells
const ALL_COLS = COLUMN_GROUPS.flatMap(g => g.cols);

// ── Componente ────────────────────────────────────────────────────────────────
const CONTASIS_TEMPLATE_PATH = '/templates/contasis_template.xlsx';

// Style IDs de columna A..AX extraídos del EJE.xlsx (<cols> en sheet1.xml)
const COL_STYLE_IDS = [
  2, 2, 5, 5, 5, 5, 5, 5, 5, 8,
  8, 8, 8, 8, 8, 8, 8, 8, 8, 5,
  5, 2, 11, 2, 5, 5, 5, 5, 8, 2,
  5, 5, 5, 5, 5, 5, 13, 8, 8, 5,
  5, 2, 5, 8, 5, 5, 8, 5, 8, 5,
];

// Letras de columna Excel A..AX (50 columnas)
const COL_LETTERS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S',
  'T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ',
  'AK','AL','AM','AN','AO','AP','AQ','AR','AS','AT','AU','AV','AW','AX',
];

/**
 * Escapa un string para uso seguro en XML.
 */
function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Genera el XML de una fila de datos (<row>).
 * Cada celda usa el styleId de columna del template y tipo numérico o string inline.
 * Solo las columnas de montos se tratan como numéricas; el resto siempre como texto.
 */
// Columnas que contienen montos/valores numéricos (se escriben como <v>number</v>)
const NUMERIC_KEYS = new Set(['J','K','L','M','N','O','P','Q','R','S','AC','W','AR']);

function buildRowXml(rowNumber, record) {
  let cells = '';
  DATA_KEYS.forEach((key, col) => {
    const raw = record[key];
    if (raw === '' || raw === null || raw === undefined) return;
    const colLetter = COL_LETTERS[col];
    const cellRef = `${colLetter}${rowNumber}`;
    const s = COL_STYLE_IDS[col] ?? 0;

    if (NUMERIC_KEYS.has(key)) {
      const strVal = String(raw).trim();
      const num = parseFloat(strVal.replace(/,/g, ''));
      if (!isNaN(num)) {
        cells += `<c r="${cellRef}" s="${s}"><v>${num}</v></c>`;
        return;
      }
    }
    // Todo lo demás como string inline (documentos, códigos, fechas, nombres)
    cells += `<c r="${cellRef}" s="${s}" t="inlineStr"><is><t>${xmlEscape(raw)}</t></is></c>`;
  });
  return `<row r="${rowNumber}" spans="1:50" x14ac:dyDescent="0.3">${cells}</row>`;
}

/**
 * Exporta el Excel manipulando directamente el ZIP del template.
 * Solo modifica sheet1.xml (agrega filas de datos + actualiza dimension).
 * Todo lo demás (estilos, merges, comentarios, VML, anchos, alturas) queda intacto.
 */
async function exportContasisExcel(rows) {
  const response = await fetch(CONTASIS_TEMPLATE_PATH);
  if (!response.ok) throw new Error('No se pudo cargar la plantilla');

  const templateBytes = new Uint8Array(await response.arrayBuffer());
  const zip = unzipSync(templateBytes);

  // ── Modificar sheet1.xml: insertar filas de datos ──────────────────────
  const sheetKey = 'xl/worksheets/sheet1.xml';
  let sheetXml = new TextDecoder().decode(zip[sheetKey]);

  // Generar las filas de datos empezando en fila 14
  const dataRowsXml = rows.map((row, i) => buildRowXml(14 + i, row)).join('');

  // Insertar las filas justo antes de </sheetData>
  sheetXml = sheetXml.replace('</sheetData>', dataRowsXml + '</sheetData>');

  // Actualizar <dimension> para incluir las nuevas filas
  const lastRow = 13 + rows.length;
  sheetXml = sheetXml.replace(
    /(<dimension\s+ref=")A1:AX13(")/,
    `$1A1:AX${Math.max(13, lastRow)}$2`
  );

  zip[sheetKey] = strToU8(sheetXml);

  // ── Re-empaquetar y descargar ──────────────────────────────────────────
  const finalZip = zipSync(zip);
  const blob = new Blob([finalZip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `contasis_registro_compras_${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
export default function ContasisTab({ loading, pendingOrders, toPayBatches, paidBatches }) {
  const [selectedMonth, setSelectedMonth] = useState(null);

  const allRows = useMemo(() => buildRows(pendingOrders, toPayBatches, paidBatches), [pendingOrders, toPayBatches, paidBatches]);

  const availableMonths = useMemo(() => {
    const s = new Set();
    pendingOrders.forEach((o) => { const k = getMonthKey(o.created_at); if(k) s.add(k); });
    toPayBatches.forEach((b) => { const k = getMonthKey(b.issue_date||b.created_at); if(k) s.add(k); });
    paidBatches.forEach((b)  => { const k = getMonthKey(b.payment_confirmed_at||b.issue_date); if(k) s.add(k); });
    return Array.from(s).sort().reverse();
  }, [pendingOrders, toPayBatches, paidBatches]);

  const filteredRows = useMemo(() => {
    if (!selectedMonth) return allRows;
    return allRows;
  }, [allRows, selectedMonth]);

  const handleExportContasis = useCallback(async () => {
    try {
      await exportContasisExcel(filteredRows);
    } catch {
      window.alert('No se pudo generar el Excel con la plantilla de Contasis.');
    }
  }, [filteredRows]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {/* ── Filtro por meses ─────────────────────────────────────── */}
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button onClick={() => setSelectedMonth(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedMonth===null?'border-purple-500 bg-purple-500 text-white shadow-sm':'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
            Todos
          </button>
          {[...availableMonths].reverse().map((mk) => (
            <button key={mk} onClick={() => setSelectedMonth(mk)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedMonth===mk?'border-purple-500 bg-purple-500 text-white shadow-sm':'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
              {formatMonthKey(mk)}
            </button>
          ))}
        </div>
      )}

      {/* ── Barra de info + Exportar ─────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Registro de Compras — Formato Contasis</p>
          <p className="text-xs text-gray-500 mt-0.5">{filteredRows.length} registros pendientes de verificación</p>
        </div>
        <Button
          variant="success"
          size="sm"
          onClick={handleExportContasis}
          className="gap-2"
        >
          <ArrowDownTrayIcon className="size-4" />
          Exportar Excel
        </Button>
      </div>

      {/* ── DataGrid ─────────────────────────────────────────────── */}
      {filteredRows.length === 0 ? (
        <EmptyState title="Sin registros" subtitle="No hay compras disponibles para Contasis" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
            <table className="w-full border-collapse text-xs">
              {/* ── Colgroup para anchos fijos ───────────────────── */}
              <colgroup>
                {ALL_COLS.map(col => (
                  <col key={col.key} style={{ minWidth: col.w, width: col.w }} />
                ))}
              </colgroup>

              <thead className="sticky top-0 z-10">
                {/* ═══ Fila 1: Grupos ═══ */}
                <tr>
                  {COLUMN_GROUPS.map(group => (
                    <th
                      key={group.label}
                      colSpan={group.cols.length}
                      className={`${group.color} px-2 py-2 text-[10px] font-bold text-center uppercase tracking-wider whitespace-nowrap border-x`}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>

                {/* ═══ Fila 2: Columnas individuales ═══ */}
                <tr>
                  {COLUMN_GROUPS.map(group =>
                    group.cols.map((col, ci) => (
                      <th
                        key={col.key}
                        className={`bg-gray-50 px-2 py-2 text-[10px] font-semibold text-gray-600 text-center whitespace-nowrap ${
                          ci === 0 ? 'border-l border-gray-200' : ''
                        } ${ci === group.cols.length - 1 ? 'border-r border-gray-200' : ''}`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-block rounded px-1 py-px text-[9px] font-bold leading-none ${
                            MAPPED_KEYS.has(col.key)
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {col.key === 'AS2' ? 'AS' : col.key}
                          </span>
                          <span>{col.label}</span>
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row, ri) => {
                  const isEven = ri % 2 === 0;
                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors hover:bg-blue-50/60 ${isEven ? 'bg-white' : 'bg-gray-50/60'}`}
                    >
                      {COLUMN_GROUPS.map(group =>
                        group.cols.map((col, ci) => {
                          const val = row[col.key];
                          const hasData = val && val !== '—' && val !== '-' && val !== '';
                          const isGroupBoundary = ci === 0;
                          return (
                            <td
                              key={col.key}
                              className={`px-2 py-2 text-center whitespace-nowrap ${
                                isGroupBoundary ? 'border-l border-gray-200' : ''
                              } ${ci === group.cols.length - 1 ? 'border-r border-gray-200' : ''} ${
                                hasData ? 'text-gray-800 font-medium' : 'text-gray-300'
                              } ${col.key === 'I' ? 'text-left !whitespace-normal max-w-[200px] truncate' : ''} ${
                                col.key === 'S' && hasData ? 'font-bold text-gray-900' : ''
                              }`}
                            >
                              {hasData ? val : '—'}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* ── Footer del grid ────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-xs text-gray-500">
              {filteredRows.length} {filteredRows.length === 1 ? 'registro' : 'registros'}
            </span>
            <span className="text-[10px] text-gray-400">
              {ALL_COLS.length} columnas · Scroll horizontal para ver todas
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
