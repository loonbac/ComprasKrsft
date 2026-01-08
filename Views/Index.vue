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
          <button @click="exportExcel" class="btn-export" :disabled="exporting">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ exporting ? 'Exportando...' : 'Exportar Excel' }}
          </button>
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
              <p class="stat-amount">Por aprobar</p>
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

          <div class="stat-card stat-rejected" @click="filterStatus = 'rejected'">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="stat-content">
              <h3>RECHAZADAS</h3>
              <p class="stat-number">{{ stats.rejected }}</p>
            </div>
          </div>
        </div>

        <!-- Filter Buttons -->
        <div class="filter-bar">
          <button 
            @click="filterStatus = 'all'" 
            :class="{ active: filterStatus === 'all' }"
            class="filter-btn"
          >
            Todas
          </button>
          <button 
            @click="filterStatus = 'pending'" 
            :class="{ active: filterStatus === 'pending' }"
            class="filter-btn pending"
          >
            🕐 Pendientes ({{ stats.pending }})
          </button>
          <button 
            @click="filterStatus = 'approved'" 
            :class="{ active: filterStatus === 'approved' }"
            class="filter-btn approved"
          >
            ✓ Aprobadas
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>Cargando órdenes...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredOrders.length === 0" class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
          </svg>
          <h3>No hay órdenes</h3>
          <p>Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos</p>
        </div>

        <!-- Orders List -->
        <div v-else class="orders-grid">
          <div
            v-for="order in filteredOrders"
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

            <div class="order-project">
              <span class="project-label">Proyecto:</span>
              <span class="project-name">{{ order.project_name }}</span>
            </div>

            <div class="order-description">
              <h3>{{ order.description }}</h3>
              <p class="order-date">{{ formatDate(order.created_at) }}</p>
            </div>

            <!-- Materials List -->
            <div v-if="order.type === 'material' && order.materials?.length" class="materials-list">
              <h4>Materiales solicitados:</h4>
              <ul>
                <li v-for="(mat, idx) in order.materials" :key="idx">{{ mat }}</li>
              </ul>
            </div>

            <!-- Amount -->
            <div class="order-amount">
              <div v-if="order.status === 'approved'" class="amount-approved-wrap">
                <span class="currency-badge" :class="order.currency">{{ order.currency }}</span>
                <span class="amount-approved">
                  {{ order.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(order.amount) }}
                </span>
                <div v-if="order.currency === 'USD' && order.exchange_rate" class="exchange-info-small">
                  <span>T.C: {{ parseFloat(order.exchange_rate).toFixed(4) }}</span>
                  <span>= S/ {{ formatNumber(order.amount_pen) }}</span>
                </div>
              </div>
              <span v-else-if="order.status === 'pending'" class="amount-pending">
                Pendiente de precio
              </span>
              <span v-else class="amount-rejected">
                Rechazada
              </span>
            </div>

            <!-- Actions -->
            <div v-if="order.status === 'pending'" class="order-actions">
              <button @click="openApproveModal(order)" class="btn-approve">
                ✓ Aprobar
              </button>
              <button @click="rejectOrder(order.id)" class="btn-reject">
                ✗ Rechazar
              </button>
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
                    <li v-for="(mat, idx) in selectedOrder.materials" :key="idx">{{ mat }}</li>
                  </ul>
                </div>
              </div>

              <form @submit.prevent="approveOrder" class="approve-form">
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>Moneda</label>
                    <select v-model="approveForm.currency" class="input-field" @change="onCurrencyChange">
                      <option value="PEN">🇵🇪 Soles (PEN)</option>
                      <option value="USD">🇺🇸 Dólares (USD)</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>{{ approveForm.currency === 'USD' ? 'Monto en USD' : 'Monto en S/' }}</label>
                    <input 
                      v-model.number="approveForm.amount" 
                      type="number" 
                      step="0.01" 
                      min="0.01" 
                      required
                      placeholder="0.00"
                      class="input-field"
                    />
                  </div>
                </div>

                <!-- Exchange Rate Info -->
                <div v-if="approveForm.currency === 'USD'" class="exchange-rate-info">
                  <div v-if="loadingRate" class="loading-rate">
                    <span class="spinner-small"></span> Obteniendo tipo de cambio...
                  </div>
                  <div v-else-if="currentExchangeRate > 0">
                    <p class="rate-value">
                      📊 Tipo de cambio: <strong>1 USD = S/ {{ currentExchangeRate.toFixed(4) }}</strong>
                    </p>
                    <p class="converted-value" v-if="approveForm.amount > 0">
                      💰 Monto en soles: <strong>S/ {{ formatNumber(approveForm.amount * currentExchangeRate) }}</strong>
                    </p>
                  </div>
                  <div v-else class="rate-error">
                    ⚠️ No se pudo obtener el tipo de cambio
                  </div>
                </div>

                <div class="form-group">
                  <label>Notas (opcional)</label>
                  <textarea 
                    v-model="approveForm.notes"
                    rows="2"
                    placeholder="Observaciones..."
                    class="input-field"
                  ></textarea>
                </div>

                <div class="modal-footer">
                  <button type="button" @click="closeApproveModal" class="btn-cancel">
                    Cancelar
                  </button>
                  <button type="submit" :disabled="approving || (approveForm.currency === 'USD' && currentExchangeRate <= 0)" class="btn-submit">
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
        <div v-if="toast.show" class="toast" :class="toast.type">
          <span>{{ toast.message }}</span>
        </div>
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
const exporting = ref(false);
const loadingRate = ref(false);
const currentExchangeRate = ref(0);
const orders = ref([]);
const filterStatus = ref('all');
const showApproveModal = ref(false);
const selectedOrder = ref(null);
const toast = ref({ show: false, message: '', type: 'success' });

const stats = ref({
  pending: 0,
  approved: 0,
  rejected: 0,
  total_approved_amount: 0
});

const approveForm = ref({
  amount: 0,
  currency: 'PEN',
  notes: ''
});

// Computed
const getModuleName = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : 'ComprasKrsft';
};

const apiBase = computed(() => `/api/${getModuleName()}`);

const filteredOrders = computed(() => {
  if (filterStatus.value === 'all') return orders.value;
  return orders.value.filter(o => o.status === filterStatus.value);
});

// Methods
const goBack = () => {
  window.location.href = '/';
};

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type };
  setTimeout(() => toast.value.show = false, 4000);
};

const formatNumber = (num) => {
  return parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getStatusText = (status) => {
  const texts = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
  return texts[status] || status;
};

const getCsrfToken = () => {
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
};

const fetchWithCsrf = (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-TOKEN': getCsrfToken(),
    ...options.headers
  };
  return fetch(url, { ...options, headers });
};

const loadOrders = async () => {
  try {
    loading.value = true;
    const res = await fetch(`${apiBase.value}/list`);
    const data = await res.json();
    if (data.success) {
      orders.value = data.orders || [];
    }
  } catch (e) {
    console.error('Error loading orders:', e);
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const res = await fetch(`${apiBase.value}/stats`);
    const data = await res.json();
    if (data.success) {
      stats.value = data.stats;
    }
  } catch (e) {
    console.error('Error loading stats:', e);
  }
};

const openApproveModal = (order) => {
  selectedOrder.value = order;
  approveForm.value = { amount: 0, currency: 'PEN', notes: '' };
  currentExchangeRate.value = 0;
  showApproveModal.value = true;
};

const closeApproveModal = () => {
  showApproveModal.value = false;
  selectedOrder.value = null;
  currentExchangeRate.value = 0;
};

// Cargar tipo de cambio cuando se selecciona USD
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
      currentExchangeRate.value = 0;
      showToast('No se pudo obtener tipo de cambio', 'error');
    }
  } catch (e) {
    currentExchangeRate.value = 0;
    console.error('Error loading exchange rate:', e);
  } finally {
    loadingRate.value = false;
  }
};

// Exportar a Excel/CSV
const exportExcel = async () => {
  try {
    exporting.value = true;
    window.location.href = `${apiBase.value}/export`;
    showToast('Descargando archivo...', 'success');
  } catch (e) {
    showToast('Error al exportar', 'error');
  } finally {
    setTimeout(() => exporting.value = false, 2000);
  }
};

const approveOrder = async () => {
  if (approveForm.value.amount <= 0) {
    showToast('Ingrese un monto válido', 'error');
    return;
  }

  if (approveForm.value.currency === 'USD' && currentExchangeRate.value <= 0) {
    showToast('Debe obtener el tipo de cambio primero', 'error');
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
      showToast('Orden aprobada exitosamente', 'success');
      closeApproveModal();
      await loadOrders();
      await loadStats();
    } else {
      showToast(data.message || 'Error al aprobar', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  } finally {
    approving.value = false;
  }
};

const rejectOrder = async (orderId) => {
  if (!confirm('¿Rechazar esta orden de compra?')) return;

  try {
    const res = await fetchWithCsrf(`${apiBase.value}/${orderId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'Rechazada por el administrador' })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Orden rechazada', 'success');
      await loadOrders();
      await loadStats();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  }
};

// Lifecycle
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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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

.title-icon {
  width: 32px;
  height: 32px;
}

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
  transition: all 0.3s;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

/* Theme Switch */
.theme-switch {
  position: relative;
  width: 60px;
  height: 30px;
}

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
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background: #fff;
  border-radius: 50%;
  transition: 0.4s;
}

.theme-switch input:checked + .slider:before {
  transform: translateX(30px);
}

/* Stats Grid */
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
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.stat-pending .stat-icon { background: rgba(245, 158, 11, 0.2); }
.stat-pending .stat-icon svg { color: #f59e0b; }

.stat-approved .stat-icon { background: rgba(16, 185, 129, 0.2); }
.stat-approved .stat-icon svg { color: #10b981; }

.stat-rejected .stat-icon { background: rgba(239, 68, 68, 0.2); }
.stat-rejected .stat-icon svg { color: #ef4444; }

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 12px;
}

.stat-icon svg {
  width: 28px;
  height: 28px;
}

.stat-content h3 {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 4px 0;
  text-transform: uppercase;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.stat-amount {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 4px 0 0 0;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-btn:hover, .filter-btn.active {
  background: rgba(255, 255, 255, 0.25);
}

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
  width: 48px;
  height: 48px;
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

.empty-state svg {
  width: 64px;
  height: 64px;
  opacity: 0.5;
  margin-bottom: 16px;
}

/* Orders Grid */
.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.order-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}

.order-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.order-card.status-pending { border-left: 4px solid #f59e0b; }
.order-card.status-approved { border-left: 4px solid #10b981; }
.order-card.status-rejected { border-left: 4px solid #ef4444; }

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-type-badge, .order-status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.order-type-badge.service { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
.order-type-badge.material { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }

.order-status-badge.pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.order-status-badge.approved { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.order-status-badge.rejected { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.order-project {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.project-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.project-name {
  display: block;
  font-weight: 600;
  margin-top: 2px;
}

.order-description h3 {
  font-size: 1rem;
  margin: 0 0 4px 0;
}

.order-date {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.materials-list {
  margin: 16px 0;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 10px;
}

.materials-list h4 {
  font-size: 0.8rem;
  margin: 0 0 8px 0;
  color: rgba(255, 255, 255, 0.7);
}

.materials-list ul {
  margin: 0;
  padding-left: 20px;
}

.materials-list li {
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.order-amount {
  margin: 16px 0;
  text-align: center;
}

.amount-approved {
  font-size: 1.5rem;
  font-weight: 700;
  color: #10b981;
}

.amount-pending {
  font-size: 1rem;
  color: #f59e0b;
}

.amount-rejected {
  font-size: 1rem;
  color: #ef4444;
}

.order-actions {
  display: flex;
  gap: 10px;
}

.btn-approve, .btn-reject {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-approve {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}

.btn-reject {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.btn-approve:hover { opacity: 0.9; }
.btn-reject:hover { background: rgba(239, 68, 68, 0.3); }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: linear-gradient(135deg, #065f46 0%, #047857 100%);
  border-radius: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  opacity: 0.7;
}

.btn-close:hover { opacity: 1; }

.modal-body {
  padding: 24px;
}

.order-summary {
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.order-summary p {
  margin: 8px 0;
}

.materials-preview ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.approve-form .form-group {
  margin-bottom: 20px;
}

.approve-form label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.8);
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
}

.input-field::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

textarea.input-field {
  resize: vertical;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
}

.btn-submit {
  padding: 12px 24px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 16px 24px;
  border-radius: 12px;
  color: #fff;
  font-weight: 500;
  z-index: 1001;
  animation: slideIn 0.3s ease;
}

.toast.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.toast.error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; }
  .orders-grid { grid-template-columns: 1fr; }
}

/* Export Button */
.btn-export {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  margin-right: 12px;
}

.btn-export:hover { opacity: 0.9; }
.btn-export:disabled { opacity: 0.5; cursor: not-allowed; }

/* Currency Badge */
.currency-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-right: 8px;
}

.currency-badge.PEN { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.currency-badge.USD { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }

/* Amount Approved Wrap */
.amount-approved-wrap {
  text-align: center;
}

.exchange-info-small {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

/* Form Row */
.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.flex-1 { flex: 1; }

/* Exchange Rate Info */
.exchange-rate-info {
  background: rgba(59, 130, 246, 0.1);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.loading-rate {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}

.rate-value {
  margin: 0 0 8px 0;
  color: #60a5fa;
}

.converted-value {
  margin: 0;
  color: #10b981;
}

.rate-error {
  color: #f59e0b;
}
</style>
