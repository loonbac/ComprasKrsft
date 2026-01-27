<template>
  <div class="compras-layout">
    <div class="compras-bg"></div>
    
    <div class="compras-container">
      <!-- Header fixed at top -->
      <header class="module-header">
        <div class="header-left">
          <button @click="goBack" class="btn-back">
            <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Volver
          </button>
          <h1>
            <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            GESTIÓN DE COMPRAS
          </h1>
        </div>
        <div class="header-right">
          <button @click="toggleDarkMode" class="theme-toggle" title="Cambiar tema">
            <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- Scrollable content area -->
      <main class="module-content">
        <!-- Main Tabs -->
        <div class="main-tabs">
          <button @click="activeTab = 'pending'" :class="{ active: activeTab === 'pending' }" class="main-tab">
            En Espera
            <span class="tab-badge pending-badge">{{ orders.length }}</span>
          </button>
          <button @click="activeTab = 'unpaid'; loadApprovedUnpaid()" :class="{ active: activeTab === 'unpaid' }" class="main-tab">
            Aprobados
            <span class="tab-badge approved-badge">{{ batches.length }}</span>
          </button>
          <button @click="activeTab = 'inprogress'; loadInProgress()" :class="{ active: activeTab === 'inprogress' }" class="main-tab">
            En Progreso
            <span class="tab-badge inprogress-badge">{{ inProgressOrders.length }}</span>
          </button>
          <button @click="activeTab = 'delivered'; loadDelivered()" :class="{ active: activeTab === 'delivered' }" class="main-tab">
            Entregados
            <span class="tab-badge delivered-badge">{{ deliveredOrders.length }}</span>
          </button>
          <button @click="activeTab = 'stored'; loadStored()" :class="{ active: activeTab === 'stored' }" class="main-tab">
            Almacenados
            <span class="tab-badge stored-badge">{{ storedOrders.length }}</span>
          </button>
        </div>

        <!-- TAB: Por Aprobar - Table View -->
        <template v-if="activeTab === 'pending'">
          <!-- Filters -->
          <div class="filters-bar">
            <div class="filter-group">
              <label>Proyecto:</label>
              <select v-model="filterProject" class="filter-select">
                <option value="">Todos</option>
                <option v-for="p in projectList" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Tipo:</label>
              <select v-model="filterType" class="filter-select">
                <option value="">Todos</option>
                <option value="material">Material</option>
                <option value="service">Servicio</option>
              </select>
            </div>
            <div class="selection-info" v-if="selectedOrders.length > 0">
              <span>{{ selectedOrders.length }} seleccionados</span>
              <button @click="openBulkApproveModal" class="btn-approve-selected">
                Aprobar Seleccionados
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
            <span>Cargando órdenes...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredOrders.length === 0" class="empty-state">
            <h3>No hay órdenes pendientes</h3>
            <p>Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos</p>
          </div>

          <!-- Orders Table -->
          <div v-else class="table-container">
            <table class="orders-table">
              <thead>
                <tr>
                  <th class="col-check">
                    <input type="checkbox" @change="toggleSelectAll" :checked="allSelected" />
                  </th>
                  <th class="col-item">ITEM</th>
                  <th class="col-project">PROYECTO</th>
                  <th class="col-type">TIPO</th>
                  <th class="col-description">DESCRIPCIÓN</th>
                  <th class="col-qty">CANT</th>
                  <th class="col-und">UND</th>
                  <th class="col-diam">DIÁMETRO</th>
                  <th class="col-serie">SERIE</th>
                  <th class="col-mat">MATERIAL</th>
                  <th class="col-date">FECHA</th>
                  <th class="col-actions">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="order in paginatedOrders" 
                  :key="order.id"
                  :class="{ selected: selectedOrders.includes(order.id) }"
                >
                  <td class="col-check">
                    <input type="checkbox" :checked="selectedOrders.includes(order.id)" @change="toggleSelect(order.id)" />
                  </td>
                  <td class="col-item">{{ order.item_number || '-' }}</td>
                  <td class="col-project">{{ order.project_name }}</td>
                  <td class="col-type">
                    <span class="type-badge" :class="order.type">
                      {{ order.type === 'service' ? 'Servicio' : 'Material' }}
                    </span>
                  </td>
                  <td class="col-description">{{ getOrderTitle(order) }}</td>
                  <td class="col-qty">{{ getOrderQty(order) }}</td>
                  <td class="col-und">{{ order.unit || 'UND' }}</td>
                  <td class="col-diam">{{ order.diameter || '-' }}</td>
                  <td class="col-serie">{{ order.series || '-' }}</td>
                  <td class="col-mat">{{ order.material_type || '-' }}</td>
                  <td class="col-date">{{ formatDate(order.created_at) }}</td>
                  <td class="col-actions">
                    <div class="action-buttons">
                      <button @click="openSingleApproveModal(order)" class="btn-sm btn-approve">Aprobar</button>
                      <button @click="rejectOrder(order.id)" class="btn-sm btn-reject">Rechazar</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination -->
            <div class="pagination">
              <button @click="currentPage--" :disabled="currentPage <= 1" class="btn-page">← Anterior</button>
              <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
              <button @click="currentPage++" :disabled="currentPage >= totalPages" class="btn-page">Siguiente →</button>
            </div>
          </div>
        </template>

        <!-- TAB: Por Pagar - Batch Cards -->
        <template v-if="activeTab === 'unpaid'">
          <div v-if="batches.length === 0" class="empty-state">
            <h3>No hay compras pendientes de pago</h3>
            <p>Las compras aprobadas aparecerán aquí agrupadas por lote</p>
          </div>

          <div v-else class="batches-list">
            <div v-for="batch in batches" :key="batch.batch_id" class="batch-card">
              <div class="batch-header">
                <div class="batch-info">
                  <span class="batch-id">{{ batch.batch_id }}</span>
                  <span class="batch-seller">{{ batch.seller_name }}</span>
                </div>
                <div class="batch-meta">
                  <span>{{ batch.orders.length }} {{ batch.orders.length === 1 ? 'item' : 'items' }}</span>
                  <span class="batch-date">{{ formatDate(batch.approved_at) }}</span>
                </div>
              </div>
              
              <div class="batch-items">
                <div v-for="order in batch.orders" :key="order.id" class="batch-item">
                  <span class="item-project">{{ order.project_name }}</span>
                  <span class="item-desc">{{ getOrderTitle(order) }}</span>
                  <span class="item-amount">{{ order.currency }} {{ formatNumber(order.amount) }}</span>
                </div>
              </div>

              <div class="batch-footer">
                <div class="batch-totals">
                  <span v-if="batch.igv_enabled" class="total-row">Subtotal: {{ batch.currency }} {{ formatNumber(batch.subtotal) }}</span>
                  <span v-if="batch.igv_enabled" class="total-row">IGV ({{ batch.igv_rate }}%): {{ batch.currency }} {{ formatNumber(batch.igv_amount) }}</span>
                  <span class="total-row total-final">Total: {{ batch.currency }} {{ formatNumber(batch.total) }}</span>
                </div>
                <button @click="openPaymentModal(batch)" class="btn-confirm-payment">Confirmar Pago</button>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB: Pagadas -->
        <template v-if="activeTab === 'paid'">
          <!-- Export Button -->
          <div v-if="paidBatches.length > 0" class="export-bar">
            <button @click="exportPaidExcel" class="btn-export">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar Registro de Compras
            </button>
          </div>

          <div v-if="paidBatches.length === 0" class="empty-state">
            <h3>No hay compras pagadas</h3>
            <p>Las compras con pago confirmado aparecerán aquí</p>
          </div>

          <div v-else class="batches-list">
            <div v-for="batch in paidBatches" :key="batch.batch_id" class="batch-card paid">
              <div class="batch-header">
                <div class="batch-info">
                  <span class="batch-id">{{ batch.batch_id }}</span>
                  <span class="batch-seller">{{ batch.seller_name }}</span>
                  <span class="paid-badge">✓ Pagado</span>
                </div>
                <div class="batch-meta">
                  <span>{{ batch.orders.length }} items</span>
                  <span class="batch-date">Pagado {{ formatDate(batch.payment_confirmed_at) }}</span>
                </div>
              </div>
              
              <div class="batch-items">
                <div v-for="order in batch.orders" :key="order.id" class="batch-item">
                  <span class="item-project">{{ order.project_name }}</span>
                  <span class="item-desc">{{ getOrderTitle(order) }}</span>
                  <span class="item-amount">{{ order.currency }} {{ formatNumber(order.amount) }}</span>
                </div>
              </div>

              <div class="batch-footer">
                <div class="batch-totals">
                  <span class="total-row total-final">Total: {{ batch.currency }} {{ formatNumber(batch.total) }}</span>
                </div>
                <div v-if="batch.cdp_serie" class="batch-cdp">
                  Comprobante: {{ batch.cdp_serie }}-{{ batch.cdp_number }}
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB: En Progreso -->
        <template v-if="activeTab === 'inprogress'">
          <div v-if="inProgressOrders.length === 0" class="empty-state">
            <h3>No hay órdenes en progreso</h3>
            <p>Las órdenes pagadas aparecerán aquí</p>
          </div>

          <div v-else class="orders-grid">
            <div v-for="order in inProgressOrders" :key="order.id" class="order-card inprogress">
              <div class="order-header">
                <span class="order-project">{{ order.project_name }}</span>
                <span class="status-badge inprogress-badge">En Progreso</span>
              </div>
              <div class="order-body">
                <p class="order-desc">{{ order.description }}</p>
                <div class="order-meta">
                  <span>Proveedor: {{ order.seller_name }}</span>
                  <span>Pagado: {{ formatDate(order.payment_confirmed_at) }}</span>
                </div>
                <div class="order-amount">
                  {{ order.currency }} {{ formatNumber(order.total_with_igv || order.amount) }}
                </div>
              </div>
              <div class="order-actions">
                <button @click="markDelivered(order.id)" class="btn-sm btn-delivered">
                  ✓ Marcar Entregado
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB: Entregados -->
        <template v-if="activeTab === 'delivered'">
          <div v-if="deliveredOrders.length === 0" class="empty-state">
            <h3>No hay órdenes entregadas</h3>
            <p>Las órdenes entregadas aparecerán aquí</p>
          </div>

          <div v-else class="orders-grid">
            <div v-for="order in deliveredOrders" :key="order.id" class="order-card delivered">
              <div class="order-header">
                <span class="order-project">{{ order.project_name }}</span>
                <span class="status-badge delivered-badge">Entregado</span>
              </div>
              <div class="order-body">
                <p class="order-desc">{{ order.description }}</p>
                <div class="order-meta">
                  <span>Proveedor: {{ order.seller_name }}</span>
                  <span>Entregado: {{ formatDate(order.delivered_at) }}</span>
                </div>
                <div class="order-amount">
                  {{ order.currency }} {{ formatNumber(order.total_with_igv || order.amount) }}
                </div>
              </div>
              <div class="order-actions">
                <button @click="markStored(order.id)" class="btn-sm btn-stored">
                  📦 Marcar Almacenado
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB: Almacenados -->
        <template v-if="activeTab === 'stored'">
          <div v-if="storedOrders.length === 0" class="empty-state">
            <h3>No hay órdenes almacenadas</h3>
            <p>Las órdenes almacenadas aparecerán aquí</p>
          </div>

          <div v-else class="orders-grid">
            <div v-for="order in storedOrders" :key="order.id" class="order-card stored">
              <div class="order-header">
                <span class="order-project">{{ order.project_name }}</span>
                <span class="status-badge stored-badge">Almacenado</span>
              </div>
              <div class="order-body">
                <p class="order-desc">{{ order.description }}</p>
                <div class="order-meta">
                  <span>Proveedor: {{ order.seller_name }}</span>
                  <span>Almacenado: {{ formatDate(order.stored_at) }}</span>
                </div>
                <div class="order-amount">
                  {{ order.currency }} {{ formatNumber(order.total_with_igv || order.amount) }}
                </div>
              </div>
              <div class="order-completed">
                <span>✓ Proceso completado</span>
              </div>
            </div>
          </div>
        </template>
      </main>

      <!-- Bulk Approve Modal -->
      <Teleport to="body">
        <div v-if="showBulkModal" class="modal-overlay" @click.self="closeBulkModal">
          <div class="modal-content modal-lg">
            <div class="modal-header">
              <h2>Aprobar {{ selectedOrdersData.length }} Órdenes</h2>
              <button @click="closeBulkModal" class="btn-close">×</button>
            </div>
            
            <div class="modal-body">
              <!-- Seller & Billing Info -->
              <div class="form-section">
                <h4>Datos de Facturación</h4>
                <div class="form-row">
                  <div class="form-group flex-2">
                    <label>Proveedor *</label>
                    <input v-model="bulkForm.seller_name" type="text" class="input-field" placeholder="Nombre o Razón Social" />
                  </div>
                  <div class="form-group flex-1">
                    <label>RUC/DNI</label>
                    <input v-model="bulkForm.seller_document" type="text" class="input-field" placeholder="20123456789" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>Moneda</label>
                    <select v-model="bulkForm.currency" class="input-field" @change="onCurrencyChange">
                      <option value="PEN">PEN - Soles</option>
                      <option value="USD">USD - Dólares</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>Fecha Emisión</label>
                    <input v-model="bulkForm.issue_date" type="date" class="input-field" />
                  </div>
                  <div class="form-group flex-1">
                    <label>Tipo Pago</label>
                    <select v-model="bulkForm.payment_type" class="input-field">
                      <option value="cash">Contado</option>
                      <option value="loan">Crédito</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>{{ bulkForm.payment_type === 'cash' ? 'F. Pago' : 'F. Vencimiento' }}</label>
                    <input v-model="bulkForm.date_value" type="date" class="input-field" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="bulkForm.igv_enabled" />
                      Aplicar IGV
                    </label>
                  </div>
                  <div v-if="bulkForm.igv_enabled" class="form-group flex-1">
                    <label>Tasa IGV (%)</label>
                    <input v-model.number="bulkForm.igv_rate" type="number" step="0.01" class="input-field" />
                  </div>
                </div>
              </div>

              <!-- Exchange Rate Info -->
              <div v-if="bulkForm.currency === 'USD'" class="exchange-info">
                <span v-if="loadingRate">Obteniendo tipo de cambio...</span>
                <span v-else-if="currentExchangeRate > 0">T.C: 1 USD = S/ {{ currentExchangeRate.toFixed(4) }}</span>
                <span v-else class="error">No se pudo obtener tipo de cambio</span>
              </div>

              <!-- Materials Pricing -->
              <div class="form-section">
                <h4>Precios por Material</h4>
                <div class="pricing-list">
                  <div v-for="order in selectedOrdersData" :key="order.id" class="pricing-row">
                    <div class="pricing-info">
                      <span class="pricing-project">{{ order.project_name }}</span>
                      <span class="pricing-material">{{ getOrderTitle(order) }}</span>
                      <span class="pricing-qty">{{ getOrderQty(order) }}</span>
                    </div>
                    <div class="pricing-input">
                      <span class="currency-prefix">{{ bulkForm.currency === 'USD' ? '$' : 'S/' }}</span>
                      <input 
                        v-model.number="prices[order.id]" 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        class="input-field price-input" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Totals -->
              <div class="totals-section">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>{{ bulkForm.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(bulkSubtotal) }}</span>
                </div>
                <div v-if="bulkForm.igv_enabled" class="total-row">
                  <span>IGV ({{ bulkForm.igv_rate }}%):</span>
                  <span>{{ bulkForm.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(bulkIgv) }}</span>
                </div>
                <div class="total-row total-final">
                  <span>TOTAL:</span>
                  <span>{{ bulkForm.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(bulkTotal) }}</span>
                </div>
                <div v-if="bulkForm.currency === 'USD' && currentExchangeRate > 0" class="total-row pen-equivalent">
                  <span>Equivalente en Soles:</span>
                  <span>S/ {{ formatNumber(bulkTotalPen) }}</span>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="closeBulkModal" class="btn-cancel">Cancelar</button>
              <button @click="submitBulkApprove" :disabled="!canSubmitBulk || approving" class="btn-submit">
                {{ approving ? 'Aprobando...' : `Aprobar ${selectedOrdersData.length} Órdenes` }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Payment Modal -->
      <Teleport to="body">
        <div v-if="showPaymentModal" class="modal-overlay" @click.self="closePaymentModal">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Confirmar Pago</h2>
              <button @click="closePaymentModal" class="btn-close">×</button>
            </div>
            
            <div class="modal-body" v-if="paymentBatch">
              <!-- Batch Summary Card -->
              <div class="payment-summary-card">
                <div class="summary-row">
                  <span class="summary-label">Lote:</span>
                  <span class="summary-value">{{ paymentBatch.batch_id }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Proveedor:</span>
                  <span class="summary-value">{{ paymentBatch.seller_name }}</span>
                </div>
                <div class="summary-row total-row">
                  <span class="summary-label">Total:</span>
                  <span class="summary-value total-amount">{{ paymentBatch.currency }} {{ formatNumber(paymentBatch.total) }}</span>
                </div>
              </div>

              <form @submit.prevent="confirmPayment" class="payment-form">
                <div class="form-section">
                  <h4>Datos del Comprobante</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label>Tipo CP *</label>
                      <input v-model="paymentForm.cdp_type" type="text" required placeholder="01, 03" class="input-field" />
                    </div>
                    <div class="form-group">
                      <label>Serie *</label>
                      <input v-model="paymentForm.cdp_serie" type="text" required placeholder="F001" class="input-field" />
                    </div>
                    <div class="form-group">
                      <label>Número *</label>
                      <input v-model="paymentForm.cdp_number" type="text" required placeholder="00001234" class="input-field" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Comprobante (opcional)</label>
                    <input type="file" @change="onPaymentProofChange" accept="image/*,.pdf" class="input-file" />
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" @click="closePaymentModal" class="btn-cancel">Cancelar</button>
                  <button type="submit" :disabled="confirmingPayment" class="btn-submit">
                    {{ confirmingPayment ? 'Confirmando...' : 'Confirmar Pago' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Toast -->
      <Teleport to="body">
        <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// State
const loading = ref(false);
const approving = ref(false);
const loadingRate = ref(false);
const currentExchangeRate = ref(0);
const orders = ref([]);
const batches = ref([]);
const paidBatches = ref([]);
const inProgressOrders = ref([]);
const deliveredOrders = ref([]);
const storedOrders = ref([]);
const projectList = ref([]);
const selectedOrders = ref([]);
const prices = ref({});
const activeTab = ref('pending');
const toast = ref({ show: false, message: '', type: 'success' });

// Filters & Pagination
const filterProject = ref('');
const filterType = ref('');
const currentPage = ref(1);
const perPage = 20;

// Modals
const showBulkModal = ref(false);
const showPaymentModal = ref(false);
const paymentBatch = ref(null);
const confirmingPayment = ref(false);

const bulkForm = ref({
  seller_name: '',
  seller_document: '',
  currency: 'PEN',
  issue_date: new Date().toISOString().split('T')[0],
  payment_type: 'cash',
  date_value: '',
  igv_enabled: false,
  igv_rate: 18.00,
  notes: ''
});

const paymentForm = ref({
  cdp_type: '',
  cdp_serie: '',
  cdp_number: '',
  payment_proof: null
});

// API Base
const getModuleName = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : 'compraskrsft';
};
const apiBase = computed(() => `/api/${getModuleName()}`);

// Computed
const filteredOrders = computed(() => {
  let result = orders.value.filter(o => o.status === 'pending');
  if (filterProject.value) result = result.filter(o => o.project_id == filterProject.value);
  if (filterType.value) result = result.filter(o => o.type === filterType.value);
  return result;
});

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / perPage) || 1);

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return filteredOrders.value.slice(start, start + perPage);
});

const allSelected = computed(() => {
  return paginatedOrders.value.length > 0 && paginatedOrders.value.every(o => selectedOrders.value.includes(o.id));
});

const selectedOrdersData = computed(() => {
  return orders.value.filter(o => selectedOrders.value.includes(o.id));
});

const bulkSubtotal = computed(() => {
  return selectedOrders.value.reduce((sum, id) => sum + (parseFloat(prices.value[id]) || 0), 0);
});

const bulkIgv = computed(() => {
  return bulkForm.value.igv_enabled ? bulkSubtotal.value * (bulkForm.value.igv_rate / 100) : 0;
});

const bulkTotal = computed(() => bulkSubtotal.value + bulkIgv.value);

const bulkTotalPen = computed(() => {
  return bulkForm.value.currency === 'USD' && currentExchangeRate.value > 0 
    ? bulkTotal.value * currentExchangeRate.value 
    : bulkTotal.value;
});

const canSubmitBulk = computed(() => {
  if (!bulkForm.value.seller_name) return false;
  if (bulkSubtotal.value <= 0) return false;
  if (bulkForm.value.currency === 'USD' && currentExchangeRate.value <= 0) return false;
  return true;
});

// Methods
const goBack = () => window.location.href = '/';

// Dark mode toggle (syncs with dashboard)
const toggleDarkMode = () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
};

// Initialize dark mode from localStorage on mount
const initDarkMode = () => {
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') {
    document.body.classList.add('dark-mode');
  }
};
initDarkMode();
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type };
  setTimeout(() => toast.value.show = false, 4000);
};
const formatNumber = (num) => parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '';
const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

const getOrderTitle = (order) => {
  if (order.type === 'service') return order.description;
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    return typeof mat === 'object' ? mat.name : mat;
  }
  return order.description;
};

const getOrderQty = (order) => {
  if (order.type === 'service') return '-';
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    if (typeof mat === 'object' && mat.qty) return mat.qty;
  }
  return '-';
};

// Data Loading
const loadOrders = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${apiBase.value}/list?status=pending`);
    const data = await res.json();
    if (data.success) {
      orders.value = data.orders || [];
      // Extract unique projects
      const projects = {};
      orders.value.forEach(o => { projects[o.project_id] = { id: o.project_id, name: o.project_name }; });
      projectList.value = Object.values(projects).sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (e) { console.error(e); }
  loading.value = false;
};

// Export paid orders to Excel
const exportPaidExcel = () => {
  window.location.href = `${apiBase.value}/export-paid`;
};

const loadApprovedUnpaid = async () => {
  try {
    const res = await fetch(`${apiBase.value}/approved-unpaid`);
    const data = await res.json();
    if (data.success) {
      // Group by batch_id
      const batchMap = {};
      data.orders.forEach(order => {
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
            total: 0
          };
        }
        batchMap[batchId].orders.push(order);
        batchMap[batchId].subtotal += parseFloat(order.amount_pen || order.amount || 0);
        batchMap[batchId].igv_amount += parseFloat(order.igv_amount || 0);
        batchMap[batchId].total += parseFloat(order.total_with_igv || order.amount || 0);
      });
      batches.value = Object.values(batchMap).sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    }
  } catch (e) { console.error(e); }
};

const loadPaidBatches = async () => {
  try {
    const res = await fetch(`${apiBase.value}/paid-orders`);
    const data = await res.json();
    if (data.success) {
      // Group by batch_id
      const batchMap = {};
      data.orders.forEach(order => {
        const batchId = order.batch_id || `SINGLE-${order.id}`;
        if (!batchMap[batchId]) {
          batchMap[batchId] = {
            batch_id: batchId,
            seller_name: order.seller_name,
            currency: order.currency,
            payment_confirmed_at: order.payment_confirmed_at,
            cdp_serie: order.cdp_serie,
            cdp_number: order.cdp_number,
            orders: [],
            total: 0
          };
        }
        batchMap[batchId].orders.push(order);
        batchMap[batchId].total += parseFloat(order.total_with_igv || order.amount || 0);
      });
      paidBatches.value = Object.values(batchMap).sort((a, b) => new Date(b.payment_confirmed_at) - new Date(a.payment_confirmed_at));
    }
  } catch (e) { console.error(e); }
};

const loadInProgress = async () => {
  try {
    const res = await fetch(`${apiBase.value}/in-progress`);
    const data = await res.json();
    if (data.success) {
      inProgressOrders.value = data.orders || [];
    }
  } catch (e) { console.error(e); }
};

const loadDelivered = async () => {
  try {
    const res = await fetch(`${apiBase.value}/delivered`);
    const data = await res.json();
    if (data.success) {
      deliveredOrders.value = data.orders || [];
    }
  } catch (e) { console.error(e); }
};

const loadStored = async () => {
  try {
    const res = await fetch(`${apiBase.value}/stored`);
    const data = await res.json();
    if (data.success) {
      storedOrders.value = data.orders || [];
    }
  } catch (e) { console.error(e); }
};

const markDelivered = async (orderId) => {
  if (!confirm('¿Marcar esta orden como entregada?')) return;
  try {
    const res = await fetch(`${apiBase.value}/${orderId}/mark-delivered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Orden marcada como entregada', 'success');
      await loadInProgress();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error', 'error');
  }
};

const markStored = async (orderId) => {
  if (!confirm('¿Marcar esta orden como almacenada?')) return;
  try {
    const res = await fetch(`${apiBase.value}/${orderId}/mark-stored`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Orden marcada como almacenada', 'success');
      await loadDelivered();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error', 'error');
  }
};

const fetchExchangeRate = async () => {
  loadingRate.value = true;
  try {
    const res = await fetch(`${apiBase.value}/exchange-rate`);
    const data = await res.json();
    if (data.success) currentExchangeRate.value = data.rate;
  } catch (e) { console.error(e); }
  loadingRate.value = false;
};

// Selection
const toggleSelect = (id) => {
  const idx = selectedOrders.value.indexOf(id);
  if (idx >= 0) {
    selectedOrders.value.splice(idx, 1);
    delete prices.value[id];
  } else {
    selectedOrders.value.push(id);
    prices.value[id] = 0;
  }
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    paginatedOrders.value.forEach(o => {
      const idx = selectedOrders.value.indexOf(o.id);
      if (idx >= 0) selectedOrders.value.splice(idx, 1);
      delete prices.value[o.id];
    });
  } else {
    paginatedOrders.value.forEach(o => {
      if (!selectedOrders.value.includes(o.id)) {
        selectedOrders.value.push(o.id);
        prices.value[o.id] = 0;
      }
    });
  }
};

// Bulk Approval Modal
const openBulkApproveModal = () => {
  if (selectedOrders.value.length === 0) return;
  bulkForm.value = {
    seller_name: '',
    seller_document: '',
    currency: 'PEN',
    issue_date: new Date().toISOString().split('T')[0],
    payment_type: 'cash',
    date_value: '',
    igv_enabled: false,
    igv_rate: 18.00,
    notes: ''
  };
  showBulkModal.value = true;
};

const openSingleApproveModal = (order) => {
  selectedOrders.value = [order.id];
  prices.value = { [order.id]: 0 };
  openBulkApproveModal();
};

const closeBulkModal = () => {
  showBulkModal.value = false;
};

const onCurrencyChange = () => {
  if (bulkForm.value.currency === 'USD') fetchExchangeRate();
};

const submitBulkApprove = async () => {
  if (!canSubmitBulk.value) return;
  
  approving.value = true;
  try {
    const payload = {
      order_ids: selectedOrders.value,
      prices: prices.value,
      currency: bulkForm.value.currency,
      seller_name: bulkForm.value.seller_name,
      seller_document: bulkForm.value.seller_document,
      issue_date: bulkForm.value.issue_date,
      payment_type: bulkForm.value.payment_type,
      payment_date: bulkForm.value.payment_type === 'cash' ? bulkForm.value.date_value : null,
      due_date: bulkForm.value.payment_type === 'loan' ? bulkForm.value.date_value : null,
      igv_enabled: bulkForm.value.igv_enabled,
      igv_rate: bulkForm.value.igv_rate,
      notes: bulkForm.value.notes
    };

    const res = await fetch(`${apiBase.value}/approve-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeBulkModal();
      selectedOrders.value = [];
      prices.value = {};
      await loadOrders();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  }
  approving.value = false;
};

// Reject
const rejectOrder = async (id) => {
  if (!confirm('¿Rechazar esta orden?')) return;
  try {
    const res = await fetch(`${apiBase.value}/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Orden rechazada', 'success');
      await loadOrders();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error', 'error');
  }
};

// Payment
const openPaymentModal = (batch) => {
  paymentBatch.value = batch;
  paymentForm.value = { cdp_type: '', cdp_serie: '', cdp_number: '', payment_proof: null };
  showPaymentModal.value = true;
};

const closePaymentModal = () => {
  showPaymentModal.value = false;
  paymentBatch.value = null;
};

const onPaymentProofChange = (e) => {
  paymentForm.value.payment_proof = e.target.files[0] || null;
};

const confirmPayment = async () => {
  if (!paymentForm.value.cdp_type || !paymentForm.value.cdp_serie || !paymentForm.value.cdp_number) {
    showToast('Complete todos los campos', 'error');
    return;
  }

  confirmingPayment.value = true;
  try {
    // Confirm payment for all orders in the batch
    for (const order of paymentBatch.value.orders) {
      const formData = new FormData();
      formData.append('cdp_type', paymentForm.value.cdp_type);
      formData.append('cdp_serie', paymentForm.value.cdp_serie);
      formData.append('cdp_number', paymentForm.value.cdp_number);
      if (paymentForm.value.payment_proof) {
        formData.append('payment_proof', paymentForm.value.payment_proof);
      }

      await fetch(`${apiBase.value}/${order.id}/confirm-payment`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getCsrfToken() },
        body: formData
      });
    }

    showToast('Pago confirmado', 'success');
    closePaymentModal();
    await loadApprovedUnpaid();
  } catch (e) {
    showToast('Error', 'error');
  }
  confirmingPayment.value = false;
};

onMounted(() => {
  loadOrders();
});
</script>

<style>
/* Theme variables - must be unscoped for :root to work */
@import './compras_theme.css';
</style>

<style scoped>
@import './compras.css';
</style>
