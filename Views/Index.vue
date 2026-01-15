<template>
  <div class="compras-layout" :class="{ 'dark-mode': isDarkMode }">
    <div class="animated-background"></div>
    
    <div class="compras-container">
      <!-- Header -->
      <header class="module-header">
        <div class="header-left">
          <button @click="goBack" class="btn-back">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Volver
          </button>
          <h1>
            <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            GESTIÓN DE COMPRAS
          </h1>
        </div>
        <div class="header-right">
          <label class="theme-switch">
            <input type="checkbox" v-model="isDarkMode">
            <span class="slider"></span>
          </label>
        </div>
      </header>

      <main class="module-content">
        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card stat-pending" @click="filterStatus = 'pending'">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="stat-content">
              <h3>PENDIENTES</h3>
              <p class="stat-number">{{ stats.pending }}</p>
            </div>
          </div>

          <div class="stat-card stat-approved" @click="filterStatus = 'approved'">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="stat-content">
              <h3>APROBADAS</h3>
              <p class="stat-number">{{ stats.approved }}</p>
              <p class="stat-amount">S/ {{ formatNumber(stats.total_approved_amount) }}</p>
            </div>
          </div>

          <div class="stat-card stat-projects">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div class="stat-content">
              <h3>PROYECTOS</h3>
              <p class="stat-number">{{ projectsWithOrders.length }}</p>
            </div>
          </div>
        </div>

        <!-- Filter Buttons -->
        <div class="filter-bar">
          <button @click="filterStatus = 'all'" :class="{ active: filterStatus === 'all' }" class="filter-btn">
            Todas
          </button>
          <button @click="filterStatus = 'pending'" :class="{ active: filterStatus === 'pending' }" class="filter-btn pending">
            🕐 Pendientes ({{ stats.pending }})
          </button>
          <button @click="filterStatus = 'approved'" :class="{ active: filterStatus === 'approved' }" class="filter-btn approved">
            ✓ Aprobadas
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>Cargando órdenes...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="projectsWithOrders.length === 0" class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
          </svg>
          <h3>No hay órdenes</h3>
          <p>Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos</p>
        </div>

        <!-- Projects List with Orders -->
        <div v-else class="projects-list">
          <div 
            v-for="project in filteredProjects" 
            :key="project.id" 
            class="project-section"
            :class="{ expanded: expandedProjects.includes(project.id) }"
          >
            <!-- Project Header -->
            <div class="project-header" @click="toggleProject(project.id)">
              <div class="project-info">
                <span class="expand-icon">{{ expandedProjects.includes(project.id) ? '▼' : '▶' }}</span>
                <h2>{{ project.name }}</h2>
                <span class="order-count">{{ project.orders.length }} órdenes</span>
                <span class="pending-badge" v-if="getProjectPendingCount(project) > 0">
                  {{ getProjectPendingCount(project) }} pendientes
                </span>
              </div>
              <div class="project-totals">
                <span class="total-approved" v-if="getProjectApprovedTotal(project) > 0">
                  S/ {{ formatNumber(getProjectApprovedTotal(project)) }} aprobado
                </span>
              </div>
            </div>

            <!-- Orders List (Expanded) -->
            <div v-if="expandedProjects.includes(project.id)" class="orders-container">
              <div
                v-for="order in getFilteredProjectOrders(project)"
                :key="order.id"
                class="order-card"
                :class="'status-' + order.status"
              >
                <div class="order-header">
                  <div class="order-type-badge" :class="order.type">
                    {{ order.type === 'service' ? '🔧 Servicio' : '📦 Materiales' }}
                  </div>
                  <div class="order-status-badge" :class="order.status">
                    {{ getStatusText(order.status) }}
                  </div>
                </div>

                <div class="order-description">
                  <h3>{{ order.description }}</h3>
                  <p class="order-date">{{ formatDate(order.created_at) }}</p>
                </div>

                <!-- Materials List -->
                <div v-if="order.type === 'material' && order.materials?.length" class="materials-list">
                  <h4>Materiales:</h4>
                  <ul>
                    <li v-for="(mat, idx) in order.materials" :key="idx">
                      <template v-if="typeof mat === 'object'">{{ mat.name }} ({{ mat.qty }})</template>
                      <template v-else>{{ mat }}</template>
                    </li>
                  </ul>
                </div>

                <!-- Amount -->
                <div class="order-amount">
                  <div v-if="order.status === 'approved'" class="amount-approved-wrap">
                    <span class="currency-badge" :class="order.currency">{{ order.currency }}</span>
                    <span class="amount-approved">
                      {{ order.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(order.amount) }}
                    </span>
                    <div v-if="order.currency === 'USD' && order.exchange_rate" class="exchange-info">
                      <span>T.C: {{ parseFloat(order.exchange_rate).toFixed(4) }}</span>
                      <span>= S/ {{ formatNumber(order.amount_pen) }}</span>
                    </div>
                  </div>
                  <span v-else-if="order.status === 'pending'" class="amount-pending">
                    Pendiente de precio
                  </span>
                  <span v-else class="amount-rejected">Rechazada</span>
                </div>

                <!-- Approval Details (for approved orders) -->
                <div v-if="order.status === 'approved'" class="approval-details">
                  <div class="detail-grid">
                    <div v-if="order.seller_name" class="detail-item">
                      <span class="detail-label">👤 Proveedor</span>
                      <span class="detail-value">{{ order.seller_name }}</span>
                      <span v-if="order.seller_document" class="detail-sub">{{ order.seller_document }}</span>
                    </div>
                    <div v-if="order.issue_date" class="detail-item">
                      <span class="detail-label">📅 Fecha Emisión</span>
                      <span class="detail-value">{{ formatDate(order.issue_date) }}</span>
                    </div>
                    <div v-if="order.payment_type" class="detail-item">
                      <span class="detail-label">💳 Tipo Pago</span>
                      <span class="detail-value">{{ order.payment_type === 'cash' ? '💵 Al Contado' : '📆 A Crédito' }}</span>
                    </div>
                    <div v-if="order.payment_type === 'cash' && order.payment_date" class="detail-item">
                      <span class="detail-label">📅 Fecha Pago</span>
                      <span class="detail-value">{{ formatDate(order.payment_date) }}</span>
                    </div>
                    <div v-if="order.payment_type === 'loan' && order.due_date" class="detail-item">
                      <span class="detail-label">⏰ Vencimiento</span>
                      <span class="detail-value due-date">{{ formatDate(order.due_date) }}</span>
                    </div>
                  </div>
                  <div v-if="order.notes" class="order-notes">
                    <span class="notes-label">📝 Notas:</span>
                    <p>{{ order.notes }}</p>
                  </div>
                  <div class="approval-stamp">
                    ✓ Aprobado el {{ formatDate(order.approved_at) }}
                  </div>
                </div>

                <!-- Actions -->
                <div v-if="order.status === 'pending'" class="order-actions">
                  <button @click="openApproveModal(order)" class="btn-approve">✓ Aprobar</button>
                  <button @click="rejectOrder(order.id)" class="btn-reject">✗ Rechazar</button>
                </div>
              </div>

              <div v-if="getFilteredProjectOrders(project).length === 0" class="no-orders-msg">
                No hay órdenes {{ filterStatus !== 'all' ? getStatusText(filterStatus).toLowerCase() + 's' : '' }} en este proyecto
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Approve Modal -->
      <Teleport to="body">
        <div v-if="showApproveModal" class="modal-overlay" @click.self="closeApproveModal">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Aprobar Orden de Compra</h2>
              <button @click="closeApproveModal" class="btn-close">×</button>
            </div>
            
            <div class="modal-body" v-if="selectedOrder">
              <div class="order-summary">
                <p><strong>Proyecto:</strong> {{ selectedOrder.project_name }}</p>
                <p><strong>Descripción:</strong> {{ selectedOrder.description }}</p>
                
                <div v-if="selectedOrder.materials?.length" class="materials-preview">
                  <p><strong>Materiales:</strong></p>
                  <ul>
                    <li v-for="(mat, idx) in selectedOrder.materials" :key="idx">
                      <template v-if="typeof mat === 'object'">{{ mat.name }} ({{ mat.qty }})</template>
                      <template v-else>{{ mat }}</template>
                    </li>
                  </ul>
                </div>
              </div>

              <form @submit.prevent="approveOrder" class="approve-form">
                <!-- Seller Info with Autocomplete -->
                <div class="form-section">
                  <h4>👤 Proveedor</h4>
                  <div class="form-group autocomplete-wrapper">
                    <label>Nombre / Razón Social *</label>
                    <input 
                      v-model="approveForm.seller_name" 
                      type="text" 
                      required 
                      placeholder="Escriba para buscar..." 
                      class="input-field"
                      @input="filterSellers"
                      @focus="showSuggestions = true"
                      @blur="hideSuggestions"
                    />
                    <ul v-if="showSuggestions && filteredSellers.length > 0" class="suggestions-list">
                      <li 
                        v-for="seller in filteredSellers" 
                        :key="seller.seller_name"
                        @mousedown.prevent="selectSeller(seller)"
                      >
                        <span class="seller-name">{{ seller.seller_name }}</span>
                        <span v-if="seller.seller_document" class="seller-doc">{{ seller.seller_document }}</span>
                      </li>
                    </ul>
                  </div>
                  <div class="form-group">
                    <label>DNI / RUC (opcional)</label>
                    <input v-model="approveForm.seller_document" type="text" placeholder="Ej: 12345678 / 20123456789" class="input-field" />
                  </div>
                </div>

                <!-- Amount -->
                <div class="form-section">
                  <h4>💰 Monto</h4>
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Moneda</label>
                      <select v-model="approveForm.currency" class="input-field" @change="onCurrencyChange">
                        <option value="PEN">🇵🇪 Soles (PEN)</option>
                        <option value="USD">🇺🇸 Dólares (USD)</option>
                      </select>
                    </div>
                    <div class="form-group flex-1">
                      <label>{{ approveForm.currency === 'USD' ? 'Monto en USD' : 'Monto en S/' }} *</label>
                      <input v-model.number="approveForm.amount" type="number" step="0.01" min="0.01" required class="input-field" />
                    </div>
                  </div>

                  <div v-if="approveForm.currency === 'USD'" class="exchange-rate-info">
                    <div v-if="loadingRate" class="loading-rate">
                      <span class="spinner-small"></span> Obteniendo tipo de cambio...
                    </div>
                    <div v-else-if="currentExchangeRate > 0">
                      <p class="rate-value">📊 T.C: <strong>1 USD = S/ {{ currentExchangeRate.toFixed(4) }}</strong></p>
                      <p class="converted-value" v-if="approveForm.amount > 0">
                        💰 Total en soles: <strong>S/ {{ formatNumber(approveForm.amount * currentExchangeRate) }}</strong>
                      </p>
                    </div>
                    <div v-else class="rate-error">⚠️ No se pudo obtener el tipo de cambio</div>
                  </div>
                </div>

                <!-- Dates and Payment -->
                <div class="form-section">
                  <h4>📅 Fechas y Pago</h4>
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Fecha de Emisión *</label>
                      <input v-model="approveForm.issue_date" type="date" required class="input-field" />
                    </div>
                    <div class="form-group flex-1">
                      <label>Tipo de Pago *</label>
                      <select v-model="approveForm.payment_type" required class="input-field">
                        <option value="">Seleccionar...</option>
                        <option value="cash">💵 Al Contado</option>
                        <option value="loan">📆 A Crédito (Préstamo)</option>
                      </select>
                    </div>
                  </div>

                  <div v-if="approveForm.payment_type === 'cash'" class="form-group">
                    <label>Fecha de Pago *</label>
                    <input v-model="approveForm.payment_date" type="date" required class="input-field" />
                  </div>

                  <div v-if="approveForm.payment_type === 'loan'" class="form-group">
                    <label>Fecha de Vencimiento *</label>
                    <input v-model="approveForm.due_date" type="date" required class="input-field" />
                  </div>
                </div>

                <div class="form-group">
                  <label>Notas (opcional)</label>
                  <textarea v-model="approveForm.notes" rows="2" class="input-field"></textarea>
                </div>

                <div class="modal-footer">
                  <button type="button" @click="closeApproveModal" class="btn-cancel">Cancelar</button>
                  <button type="submit" :disabled="approving || !canApprove" class="btn-submit">
                    {{ approving ? 'Aprobando...' : 'Aprobar Compra' }}
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
const isDarkMode = ref(false);
const loading = ref(false);
const approving = ref(false);
const loadingRate = ref(false);
const currentExchangeRate = ref(0);
const orders = ref([]);
const filterStatus = ref('all');
const showApproveModal = ref(false);
const selectedOrder = ref(null);
const toast = ref({ show: false, message: '', type: 'success' });
const expandedProjects = ref([]);

// Sellers autocomplete
const allSellers = ref([]);
const filteredSellers = ref([]);
const showSuggestions = ref(false);

const stats = ref({ pending: 0, approved: 0, rejected: 0, total_approved_amount: 0 });
const approveForm = ref({ 
  amount: 0, 
  currency: 'PEN', 
  notes: '',
  issue_date: new Date().toISOString().split('T')[0],
  payment_type: '',
  payment_date: '',
  due_date: '',
  seller_name: '',
  seller_document: ''
});

// Computed
const canApprove = computed(() => {
  if (approveForm.value.amount <= 0) return false;
  if (!approveForm.value.seller_name) return false;
  if (!approveForm.value.issue_date) return false;
  if (!approveForm.value.payment_type) return false;
  if (approveForm.value.payment_type === 'cash' && !approveForm.value.payment_date) return false;
  if (approveForm.value.payment_type === 'loan' && !approveForm.value.due_date) return false;
  if (approveForm.value.currency === 'USD' && currentExchangeRate.value <= 0) return false;
  return true;
});

const getModuleName = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : 'compraskrsft';
};


const apiBase = computed(() => `/api/${getModuleName()}`);

// Group orders by project
const projectsWithOrders = computed(() => {
  const projectMap = {};
  
  orders.value.forEach(order => {
    const projectId = order.project_id;
    const projectName = order.project_name || 'Sin Proyecto';
    
    if (!projectMap[projectId]) {
      projectMap[projectId] = {
        id: projectId,
        name: projectName,
        orders: []
      };
    }
    projectMap[projectId].orders.push(order);
  });
  
  // Sort by project name
  return Object.values(projectMap).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredProjects = computed(() => {
  if (filterStatus.value === 'all') return projectsWithOrders.value;
  
  return projectsWithOrders.value.filter(project => 
    project.orders.some(o => o.status === filterStatus.value)
  );
});

// Methods
const goBack = () => window.location.href = '/';

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type };
  setTimeout(() => toast.value.show = false, 4000);
};

const formatNumber = (num) => parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const getStatusText = (status) => ({ pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[status] || status);

const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

const fetchWithCsrf = (url, options = {}) => {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), ...options.headers };
  return fetch(url, { ...options, headers });
};

const toggleProject = (projectId) => {
  const idx = expandedProjects.value.indexOf(projectId);
  if (idx >= 0) {
    expandedProjects.value.splice(idx, 1);
  } else {
    expandedProjects.value.push(projectId);
  }
};

const getFilteredProjectOrders = (project) => {
  if (filterStatus.value === 'all') return project.orders;
  return project.orders.filter(o => o.status === filterStatus.value);
};

const getProjectPendingCount = (project) => project.orders.filter(o => o.status === 'pending').length;

const getProjectApprovedTotal = (project) => {
  return project.orders
    .filter(o => o.status === 'approved')
    .reduce((sum, o) => sum + parseFloat(o.amount_pen || o.amount || 0), 0);
};

const loadOrders = async () => {
  try {
    loading.value = true;
    const res = await fetch(`${apiBase.value}/list`);
    const data = await res.json();
    if (data.success) {
      orders.value = data.orders || [];
      // Auto-expand projects with pending orders
      expandedProjects.value = projectsWithOrders.value
        .filter(p => p.orders.some(o => o.status === 'pending'))
        .map(p => p.id);
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const res = await fetch(`${apiBase.value}/stats`);
    const data = await res.json();
    if (data.success) stats.value = data.stats;
  } catch (e) {
    console.error('Error:', e);
  }
};

const openApproveModal = (order) => {
  selectedOrder.value = order;
  approveForm.value = { 
    amount: 0, 
    currency: 'PEN', 
    notes: '',
    issue_date: new Date().toISOString().split('T')[0],
    payment_type: '',
    payment_date: '',
    due_date: '',
    seller_name: '',
    seller_document: ''
  };
  currentExchangeRate.value = 0;
  showSuggestions.value = false;
  filteredSellers.value = [];
  showApproveModal.value = true;
  loadSellers();
};

const closeApproveModal = () => {
  showApproveModal.value = false;
  selectedOrder.value = null;
  showSuggestions.value = false;
};

// Sellers autocomplete
const loadSellers = async () => {
  try {
    const res = await fetch(`${apiBase.value}/sellers`);
    const data = await res.json();
    if (data.success) {
      allSellers.value = data.sellers || [];
    }
  } catch (e) {
    console.error('Error loading sellers:', e);
  }
};

const filterSellers = () => {
  const query = approveForm.value.seller_name.toLowerCase().trim();
  if (query.length < 1) {
    filteredSellers.value = allSellers.value.slice(0, 5);
  } else {
    filteredSellers.value = allSellers.value
      .filter(s => 
        s.seller_name.toLowerCase().includes(query) || 
        (s.seller_document && s.seller_document.includes(query))
      )
      .slice(0, 5);
  }
  showSuggestions.value = true;
};

const selectSeller = (seller) => {
  approveForm.value.seller_name = seller.seller_name;
  approveForm.value.seller_document = seller.seller_document || '';
  showSuggestions.value = false;
};

const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 150);
};

const onCurrencyChange = async () => {
  if (approveForm.value.currency === 'USD') {
    await loadExchangeRate();
  } else {
    currentExchangeRate.value = 0;
  }
};

const loadExchangeRate = async () => {
  try {
    loadingRate.value = true;
    const res = await fetch(`${apiBase.value}/exchange-rate`);
    const data = await res.json();
    if (data.success) {
      currentExchangeRate.value = parseFloat(data.rate);
    } else {
      showToast('No se pudo obtener tipo de cambio', 'error');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    loadingRate.value = false;
  }
};

const approveOrder = async () => {
  if (approveForm.value.amount <= 0) {
    showToast('Ingrese un monto válido', 'error');
    return;
  }

  try {
    approving.value = true;
    const res = await fetchWithCsrf(`${apiBase.value}/${selectedOrder.value.id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approveForm.value)
    });
    const data = await res.json();

    if (data.success) {
      showToast('Orden aprobada', 'success');
      closeApproveModal();
      await loadOrders();
      await loadStats();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  } finally {
    approving.value = false;
  }
};

const rejectOrder = async (orderId) => {
  if (!confirm('¿Rechazar esta orden?')) return;

  try {
    const res = await fetchWithCsrf(`${apiBase.value}/${orderId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'Rechazada' })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Orden rechazada', 'success');
      await loadOrders();
      await loadStats();
    }
  } catch (e) {
    showToast('Error', 'error');
  }
};

onMounted(() => {
  loadOrders();
  loadStats();
});
</script>

<style scoped>
/* Layout */
.compras-layout {
  min-height: 100vh;
  background: linear-gradient(135deg, #065f46 0%, #047857 100%);
  color: #fff;
}

.dark-mode {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.animated-background {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: 
    radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(5, 150, 105, 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.compras-container {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.title-icon { width: 32px; height: 32px; }

.btn-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
}

.btn-back:hover { background: rgba(255, 255, 255, 0.2); }
.btn-back svg { width: 20px; height: 20px; }

/* Theme Switch */
.theme-switch { position: relative; width: 60px; height: 30px; }
.theme-switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 30px;
  transition: 0.4s;
}
.slider:before {
  content: "";
  position: absolute;
  height: 22px; width: 22px;
  left: 4px; bottom: 4px;
  background: #fff;
  border-radius: 50%;
  transition: 0.4s;
}
.theme-switch input:checked + .slider:before { transform: translateX(30px); }

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  cursor: pointer;
}

.stat-card:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.15); }

.stat-pending .stat-icon { background: rgba(245, 158, 11, 0.2); }
.stat-pending .stat-icon svg { color: #f59e0b; }
.stat-approved .stat-icon { background: rgba(16, 185, 129, 0.2); }
.stat-approved .stat-icon svg { color: #10b981; }
.stat-projects .stat-icon { background: rgba(59, 130, 246, 0.2); }
.stat-projects .stat-icon svg { color: #3b82f6; }

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px; height: 50px;
  border-radius: 12px;
}
.stat-icon svg { width: 28px; height: 28px; }

.stat-content h3 {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 4px 0;
}
.stat-number { font-size: 1.5rem; font-weight: 700; margin: 0; }
.stat-amount { font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); margin: 4px 0 0 0; }

/* Filter */
.filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
}
.filter-btn:hover, .filter-btn.active { background: rgba(255, 255, 255, 0.25); }
.filter-btn.pending.active { background: rgba(245, 158, 11, 0.3); }
.filter-btn.approved.active { background: rgba(16, 185, 129, 0.3); }

/* Loading & Empty */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 16px;
}

.loading-spinner {
  width: 48px; height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
}
.empty-state svg { width: 64px; height: 64px; opacity: 0.5; margin-bottom: 16px; }

/* Projects List */
.projects-list { display: flex; flex-direction: column; gap: 16px; }

.project-section {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  cursor: pointer;
  transition: background 0.2s;
}
.project-header:hover { background: rgba(255, 255, 255, 0.05); }

.project-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.expand-icon { font-size: 12px; opacity: 0.7; }

.project-info h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.order-count {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 0.8rem;
}

.pending-badge {
  padding: 4px 12px;
  background: rgba(245, 158, 11, 0.3);
  border-radius: 20px;
  font-size: 0.8rem;
  color: #fcd34d;
}

.total-approved {
  font-size: 0.9rem;
  color: #6ee7b7;
  font-weight: 600;
}

.orders-container { padding: 0 20px 20px 20px; }

.no-orders-msg {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.5);
}

/* Order Cards */
.order-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid transparent;
}

.order-card.status-pending { border-left-color: #f59e0b; }
.order-card.status-approved { border-left-color: #10b981; }
.order-card.status-rejected { border-left-color: #ef4444; }

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-type-badge, .order-status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.order-type-badge.material { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
.order-type-badge.service { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
.order-status-badge.pending { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
.order-status-badge.approved { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.order-status-badge.rejected { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

.order-description h3 { margin: 0 0 4px 0; font-size: 1rem; }
.order-date { margin: 0; font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); }

.materials-list { margin: 12px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; }
.materials-list h4 { margin: 0 0 8px 0; font-size: 0.85rem; }
.materials-list ul { margin: 0; padding-left: 20px; }
.materials-list li { font-size: 0.85rem; }

.order-amount { margin: 12px 0; }
.amount-approved-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.currency-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
.currency-badge.PEN { background: #dc2626; }
.currency-badge.USD { background: #2563eb; }
.amount-approved { font-size: 1.25rem; font-weight: 700; }
.exchange-info { font-size: 0.8rem; color: rgba(255,255,255,0.6); }
.amount-pending { color: #fcd34d; }
.amount-rejected { color: #fca5a5; }

/* Approval Details */
.approval-details {
  margin-top: 12px;
  padding: 12px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.6);
}

.detail-value {
  font-size: 0.85rem;
  font-weight: 600;
}

.detail-value.due-date {
  color: #fcd34d;
}

.detail-sub {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
}

.approval-stamp {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255,255,255,0.2);
  font-size: 0.8rem;
  color: #6ee7b7;
}

/* Form Sections */
.form-section {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.form-section h4 {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.8);
}

/* Autocomplete */
.autocomplete-wrapper {
  position: relative;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 4px;
  list-style: none;
  padding: 0;
}

.suggestions-list li {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.suggestions-list li:hover {
  background: rgba(16, 185, 129, 0.2);
}

.suggestions-list li:last-child {
  border-bottom: none;
}

.seller-name {
  font-weight: 500;
}

.seller-doc {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.5);
}

.order-actions { display: flex; gap: 10px; margin-top: 12px; }
.btn-approve, .btn-reject {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-approve { background: #10b981; color: #fff; }
.btn-approve:hover { background: #059669; }
.btn-reject { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.btn-reject:hover { background: rgba(239, 68, 68, 0.3); }

/* Notes and Approval Info */
.order-notes {
  margin-top: 12px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}
.notes-label { font-weight: 600; font-size: 0.85rem; }
.order-notes p { margin: 6px 0 0 0; font-size: 0.9rem; color: rgba(255,255,255,0.8); }

.approval-info {
  margin-top: 10px;
  font-size: 0.8rem;
  color: #6ee7b7;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.modal-header h2 { margin: 0; }
.btn-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }

.modal-body { padding: 20px; }

.order-summary { margin-bottom: 20px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 8px; }
.order-summary p { margin: 8px 0; }
.materials-preview ul { margin: 8px 0; padding-left: 20px; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: rgba(255,255,255,0.7); }
.form-group.flex-1 { flex: 1; }

.input-field {
  width: 100%;
  padding: 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}
.input-field:focus { outline: none; border-color: #10b981; }

.exchange-rate-info { margin: 16px 0; padding: 12px; background: rgba(59,130,246,0.1); border-radius: 8px; }
.rate-value { margin: 0 0 8px 0; }
.converted-value { margin: 0; color: #6ee7b7; }
.rate-error { color: #fca5a5; }
.loading-rate { display: flex; align-items: center; gap: 8px; }
.spinner-small {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.modal-footer { display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }
.btn-cancel { padding: 12px 24px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: #fff; cursor: pointer; }
.btn-submit { padding: 12px 24px; background: #10b981; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toast */
.toast {
  position: fixed;
  bottom: 20px; right: 20px;
  padding: 16px 24px;
  border-radius: 8px;
  color: #fff;
  z-index: 2000;
}
.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }
</style>
