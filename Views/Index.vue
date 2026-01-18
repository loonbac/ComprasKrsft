<template>
  <div class="compras-layout">
    <!-- Background -->
    <div class="compras-bg"></div>
    
    <!-- Main Container -->
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

      <main class="module-content">
        <!-- Stats/Signalizations will be added here later -->

        <!-- Main Tabs -->
        <div class="main-tabs">
          <button @click="activeTab = 'pending'" :class="{ active: activeTab === 'pending' }" class="main-tab">
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Por Aprobar
            <span class="tab-badge pending-badge">{{ stats.pending }}</span>
          </button>
          <button @click="activeTab = 'unpaid'" :class="{ active: activeTab === 'unpaid' }" class="main-tab">
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Por Pagar
            <span class="tab-badge unpaid-badge">{{ approvedUnpaidOrders.length }}</span>
          </button>
          <button @click="activeTab = 'paid'" :class="{ active: activeTab === 'paid' }" class="main-tab">
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Pagadas
          </button>
        </div>

        <!-- TAB: Por Aprobar -->
        <template v-if="activeTab === 'pending'">
          <!-- Loading -->
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
            <span>Cargando órdenes...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="projectsWithOrders.length === 0" class="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
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
                <span class="expand-icon">
                  <svg v-if="expandedProjects.includes(project.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <h2>{{ project.name }}</h2>
                <span class="order-count">
                  <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  {{ project.orders.length }} órdenes
                </span>
                <span class="pending-badge" v-if="getProjectPendingCount(project) > 0">
                  <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                    <svg v-if="order.type === 'service'" class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <svg v-else class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    {{ order.type === 'service' ? 'Servicio' : 'Materiales' }}
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
                      {{ order.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(order.total_with_igv || order.amount) }}
                    </span>
                    <span v-if="order.igv_enabled" class="igv-badge">+IGV</span>
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
                      <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Proveedor</span>
                      <span class="detail-value">{{ order.seller_name }}</span>
                      <span v-if="order.seller_document" class="detail-sub">{{ order.seller_document }}</span>
                    </div>
                    <div v-if="order.issue_date" class="detail-item">
                      <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Fecha Emisión</span>
                      <span class="detail-value">{{ formatDate(order.issue_date) }}</span>
                    </div>
                    <div v-if="order.payment_type" class="detail-item">
                      <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Tipo Pago</span>
                      <span class="detail-value">{{ order.payment_type === 'cash' ? 'Al Contado' : 'A Crédito' }}</span>
                    </div>
                    <div v-if="order.payment_type === 'cash' && order.payment_date" class="detail-item">
                      <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Fecha Pago</span>
                      <span class="detail-value">{{ formatDate(order.payment_date) }}</span>
                    </div>
                    <div v-if="order.payment_type === 'loan' && order.due_date" class="detail-item">
                      <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Vencimiento</span>
                      <span class="detail-value due-date">{{ formatDate(order.due_date) }}</span>
                    </div>
                  </div>
                  <div v-if="order.notes" class="order-notes">
                    <span class="notes-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Notas:</span>
                    <p>{{ order.notes }}</p>
                  </div>
                  <div class="approval-stamp">
                    <svg class="stamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Aprobado el {{ formatDate(order.approved_at) }}
                  </div>
                </div>

                <!-- Actions -->
                <div v-if="order.status === 'pending'" class="order-actions">
                  <button @click="openApproveModal(order)" class="btn-approve"><svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Aprobar</button>
                  <button @click="rejectOrder(order.id)" class="btn-reject"><svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Rechazar</button>
                </div>
              </div>

              <div v-if="getFilteredProjectOrders(project).length === 0" class="no-orders-msg">
                No hay órdenes {{ filterStatus !== 'all' ? getStatusText(filterStatus).toLowerCase() + 's' : '' }} en este proyecto
              </div>
            </div>
          </div>
        </div>
        </template>

        <!-- TAB: Por Pagar -->
        <template v-if="activeTab === 'unpaid'">
          <div v-if="unpaidProjectsWithOrders.length === 0" class="empty-state">
            <h3>No hay compras pendientes de pago</h3>
            <p>Las compras aprobadas aparecerán aquí para confirmar su pago</p>
          </div>

          <div v-else class="projects-list">
            <div 
              v-for="project in unpaidProjectsWithOrders" 
              :key="'unpaid-' + project.id" 
              class="project-section"
              :class="{ expanded: expandedUnpaidProjects.includes(project.id) }"
            >
              <div class="project-header" @click="toggleUnpaidProject(project.id)">
                <div class="project-info">
                  <span class="expand-icon">
                    <svg v-if="expandedUnpaidProjects.includes(project.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                  <h2>{{ project.name }}</h2>
                  <span class="order-count unpaid-count">{{ project.orders.length }} por pagar</span>
                </div>
              </div>

              <div v-if="expandedUnpaidProjects.includes(project.id)" class="orders-container">
                <div
                  v-for="order in project.orders"
                  :key="order.id"
                  class="order-card status-approved-unpaid"
                >
                  <div class="order-header">
                    <div class="badges-row">
                      <div class="order-type-badge" :class="order.type">
                        <svg v-if="order.type === 'service'" class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        <svg v-else class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        {{ order.type === 'service' ? 'Servicio' : 'Materiales' }}
                      </div>
                      <div class="order-status-badge approved-unpaid">
                        <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        Por Pagar
                      </div>
                    </div>
                    <div class="expiration-pill" :class="{ 'urgent': getDaysRemaining(order.approved_at) <= 5 }">
                      <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {{ getDaysRemaining(order.approved_at) }} días para vencer
                    </div>
                  </div>

                  <div class="order-description">
                    <h3>{{ order.description }}</h3>
                    <p class="order-date">Aprobado {{ formatDate(order.approved_at) }}</p>
                  </div>

                  <div class="order-amount">
                    <div class="amount-approved-wrap">
                      <span class="currency-badge" :class="order.currency">{{ order.currency }}</span>
                      <span class="amount-approved">
                        {{ order.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(order.total_with_igv || order.amount) }}
                      </span>
                      <span v-if="order.igv_enabled" class="pill-badge igv">+IGV</span>
                    </div>
                  </div>

                  <div class="order-actions">
                    <button @click="openPaymentModal(order)" class="btn-confirm-payment">
                      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Confirmar Pago
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB: Pagadas -->
        <template v-if="activeTab === 'paid'">
          <!-- Empty State -->
          <div v-if="paidOrders.length === 0" class="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3>No hay compras pagadas</h3>
            <p>Las órdenes con pago confirmado aparecerán aquí</p>
          </div>

          <!-- Paid Projects List -->
          <div v-else class="projects-list">
            <div 
              v-for="project in paidProjectsWithOrders" 
              :key="'paid-' + project.id" 
              class="project-section"
              :class="{ expanded: expandedPaidProjects.includes(project.id) }"
            >
              <div class="project-header" @click="togglePaidProject(project.id)">
                <div class="project-info">
                  <span class="expand-icon">
                    <svg v-if="expandedPaidProjects.includes(project.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                  <h2>{{ project.name }}</h2>
                  <span class="order-count paid-count">
                    <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ project.orders.length }} pagadas
                  </span>
                </div>
              </div>

              <div v-if="expandedPaidProjects.includes(project.id)" class="orders-container">
                <div
                  v-for="order in project.orders"
                  :key="order.id"
                  class="order-card status-paid"
                >
                  <div class="order-header">
                    <div class="order-type-badge" :class="order.type">
                      <svg v-if="order.type === 'service'" class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                      <svg v-else class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                      {{ order.type === 'service' ? 'Servicio' : 'Materiales' }}
                    </div>
                    <div class="order-status-badge paid">
                      <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Pagado
                    </div>
                  </div>

                  <div class="order-description">
                    <h3>{{ order.description }}</h3>
                    <p class="order-date">Pagado {{ formatDate(order.payment_confirmed_at) }}</p>
                  </div>

                  <div class="order-amount">
                    <div class="amount-approved-wrap">
                      <span class="currency-badge" :class="order.currency">{{ order.currency }}</span>
                      <span class="amount-approved">
                        {{ order.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(order.total_with_igv || order.amount) }}
                      </span>
                      <span v-if="order.igv_enabled" class="pill-badge igv">+IGV</span>
                    </div>
                  </div>

                  <div class="supplier-box" v-if="order.seller_name || order.cdp_number || order.cdp_serie">
                    <div class="supplier-group" v-if="order.cdp_number || order.cdp_serie">
                        <div class="supplier-label">
                            <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> 
                            COMPROBANTE
                        </div>
                        <div class="supplier-value">{{ order.cdp_serie ? order.cdp_serie + '-' : '' }}{{ order.cdp_number }}</div>
                    </div>
                    <div class="supplier-group" v-if="order.seller_name">
                        <div class="supplier-label">
                            <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> 
                            PROVEEDOR
                        </div>
                        <div class="supplier-value">{{ order.seller_name }}</div>
                        <div class="supplier-sub" v-if="order.seller_document">{{ order.seller_document }}</div>
                    </div>
                  </div>

                  <div class="approval-details">
                    <div class="detail-grid">
                      <div class="detail-item">
                        <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Comprobante</span>
                        <span class="detail-value">{{ order.cdp_type }} {{ order.cdp_serie }}-{{ order.cdp_number }}</span>
                      </div>
                      <div v-if="order.seller_name" class="detail-item">
                        <span class="detail-label"><svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Proveedor</span>
                        <span class="detail-value">{{ order.seller_name }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
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
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Proveedor</h4>
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
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Monto</h4>
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Moneda</label>
                      <select v-model="approveForm.currency" class="input-field" @change="onCurrencyChange">
                        <option value="PEN">PEN - Soles</option>
                        <option value="USD">USD - Dólares</option>
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
                      <p class="rate-value"><svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> T.C: <strong>1 USD = S/ {{ currentExchangeRate.toFixed(4) }}</strong></p>
                      <p class="converted-value" v-if="approveForm.amount > 0">
                        <svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Total en soles: <strong>S/ {{ formatNumber(approveForm.amount * currentExchangeRate) }}</strong>
                      </p>
                    </div>
                    <div v-else class="rate-error"><svg class="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> No se pudo obtener el tipo de cambio</div>
                  </div>
                </div>

                <!-- IGV -->
                <div class="form-section">
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> IGV</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="checkbox-label">
                        <input type="checkbox" v-model="approveForm.igv_enabled" />
                        Aplicar IGV
                      </label>
                    </div>
                    <div v-if="approveForm.igv_enabled" class="form-group flex-1">
                      <label>Tasa IGV (%)</label>
                      <input v-model.number="approveForm.igv_rate" type="number" step="0.01" min="0" class="input-field" />
                    </div>
                  </div>
                  <div v-if="approveForm.igv_enabled && approveForm.amount > 0" class="igv-preview">
                    <p>Subtotal: S/ {{ formatNumber(getSubtotal) }}</p>
                    <p>IGV ({{ approveForm.igv_rate }}%): S/ {{ formatNumber(getIgvAmount) }}</p>
                    <p class="total-igv"><strong>Total: S/ {{ formatNumber(getTotalWithIgv) }}</strong></p>
                  </div>
                </div>
                <div class="form-section">
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Fechas y Pago</h4>
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Fecha de Emisión *</label>
                      <input v-model="approveForm.issue_date" type="date" required class="input-field" />
                    </div>
                    <div class="form-group flex-1">
                      <label>Tipo de Pago *</label>
                      <select v-model="approveForm.payment_type" required class="input-field">
                        <option value="">Seleccionar...</option>
                        <option value="cash">Al Contado</option>
                        <option value="loan">A Crédito (Préstamo)</option>
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

      <!-- Payment Confirmation Modal -->
      <Teleport to="body">
        <div v-if="showPaymentModal" class="modal-overlay" @click.self="closePaymentModal">
          <div class="modal-content">
            <div class="modal-header">
              <h2><svg class="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Confirmar Pago</h2>
              <button @click="closePaymentModal" class="btn-close">×</button>
            </div>
            
            <div class="modal-body" v-if="paymentOrder">
              <div class="order-summary">
                <p><strong>Proyecto:</strong> {{ paymentOrder.project_name }}</p>
                <p><strong>Descripción:</strong> {{ paymentOrder.description }}</p>
                <p><strong>Monto:</strong> 
                  {{ paymentOrder.currency === 'USD' ? '$' : 'S/' }} 
                  {{ formatNumber(paymentOrder.total_with_igv || paymentOrder.amount) }}
                </p>
              </div>

              <form @submit.prevent="confirmPayment" class="payment-form">
                <div class="form-section">
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Datos del Comprobante</h4>
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Tipo CP/DOC *</label>
                      <input 
                        v-model="paymentForm.cdp_type" 
                        type="text" 
                        required 
                        placeholder="Ej: 01, 03"
                        pattern="[0-9]+"
                        class="input-field" 
                      />
                    </div>
                    <div class="form-group flex-1">
                      <label>Serie CDP *</label>
                      <input 
                        v-model="paymentForm.cdp_serie" 
                        type="text" 
                        required 
                        placeholder="Ej: F001"
                        class="input-field" 
                      />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Nro CP/DOC *</label>
                    <input 
                      v-model="paymentForm.cdp_number" 
                      type="text" 
                      required 
                      placeholder="Ej: 00001234"
                      pattern="[0-9]+"
                      class="input-field" 
                    />
                  </div>
                </div>

                <div class="form-section">
                  <h4><svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Comprobante de Pago (opcional)</h4>
                  <div class="form-group">
                    <input 
                      type="file" 
                      @change="onPaymentProofChange"
                      accept="image/*,.pdf"
                      class="input-file"
                    />
                    <p class="hint">Foto o documento del comprobante</p>
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" @click="closePaymentModal" class="btn-cancel">Cancelar</button>
                  <button type="submit" :disabled="confirmingPayment" class="btn-submit btn-confirm">
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
import './compras_theme.css';
import './compras.css';

// State
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
  seller_document: '',
  igv_enabled: false,
  igv_rate: 18.00
});

// Payment confirmation
const activeTab = ref('pending'); // 'pending', 'unpaid', 'paid'
const approvedUnpaidOrders = ref([]);
const paidOrders = ref([]);
const expandedUnpaidProjects = ref([]);
const expandedPaidProjects = ref([]);
const showPaymentModal = ref(false);
const paymentOrder = ref(null);
const confirmingPayment = ref(false);
const paymentForm = ref({
  cdp_type: '',
  cdp_serie: '',
  cdp_number: '',
  payment_proof: null
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

// IGV computed
const getSubtotal = computed(() => {
  const base = approveForm.value.amount;
  if (approveForm.value.currency === 'USD' && currentExchangeRate.value > 0) {
    return base * currentExchangeRate.value;
  }
  return base;
});

const getIgvAmount = computed(() => {
  return getSubtotal.value * (approveForm.value.igv_rate / 100);
});

const getTotalWithIgv = computed(() => {
  return getSubtotal.value + getIgvAmount.value;
});

// Group unpaid orders by project
const unpaidProjectsWithOrders = computed(() => {
  const projectMap = {};
  
  approvedUnpaidOrders.value.forEach(order => {
    const projectId = order.project_id;
    const projectName = order.project_name || 'Sin Proyecto';
    
    if (!projectMap[projectId]) {
      projectMap[projectId] = { id: projectId, name: projectName, orders: [] };
    }
    projectMap[projectId].orders.push(order);
  });
  
  return Object.values(projectMap).sort((a, b) => a.name.localeCompare(b.name));
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

const paidProjectsWithOrders = computed(() => {
  const projectMap = {};
  paidOrders.value.forEach(order => {
    const projectId = order.project_id;
    const projectName = order.project_name;
    if (!projectMap[projectId]) {
      projectMap[projectId] = {
        id: projectId,
        name: projectName,
        orders: []
      };
    }
    projectMap[projectId].orders.push(order);
  });
  return Object.values(projectMap).sort((a, b) => a.name.localeCompare(b.name));
});

// Methods
const goBack = () => window.location.href = '/';

const toggleDarkMode = () => {
  document.body.classList.toggle('dark-mode');
  // Guardar preferencia en localStorage
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('compras-dark-mode', isDark ? 'true' : 'false');
};

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type };
  setTimeout(() => toast.value.show = false, 4000);
};

const formatNumber = (num) => parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const getDueDate = (approvalDate, days = 30) => {
  if (!approvalDate) return null;
  const date = new Date(approvalDate);
  date.setDate(date.getDate() + days);
  return date;
};

const getDaysRemaining = (approvalDate) => {
  if (!approvalDate) return 0;
  const today = new Date();
  const dueDate = getDueDate(approvalDate);
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

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
    seller_document: '',
    igv_enabled: false,
    igv_rate: 18.00
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

// Load approved but unpaid orders
const loadApprovedUnpaid = async () => {
  try {
    const res = await fetch(`${apiBase.value}/approved-unpaid`);
    const data = await res.json();
    if (data.success) {
      approvedUnpaidOrders.value = data.orders || [];
      expandedUnpaidProjects.value = unpaidProjectsWithOrders.value.map(p => p.id);
    }
  } catch (e) {
    console.error('Error:', e);
  }
};

const loadPaidOrders = async () => {
  try {
    const res = await fetch(`${apiBase.value}/paid-orders`);
    const data = await res.json();
    if (data.success) {
      paidOrders.value = data.orders || [];
      // Auto-expand all paid projects after load
      setTimeout(() => {
        expandedPaidProjects.value = paidProjectsWithOrders.value.map(p => p.id);
      }, 100);
    }
  } catch (e) {
    console.error('Error loading paid orders:', e);
  }
};

// Payment confirmation
const openPaymentModal = (order) => {
  paymentOrder.value = order;
  paymentForm.value = { cdp_type: '', cdp_serie: '', cdp_number: '', payment_proof: null };
  showPaymentModal.value = true;
};

const closePaymentModal = () => {
  showPaymentModal.value = false;
  paymentOrder.value = null;
};

const onPaymentProofChange = (e) => {
  paymentForm.value.payment_proof = e.target.files[0] || null;
};

const confirmPayment = async () => {
  if (!paymentForm.value.cdp_type || !paymentForm.value.cdp_serie || !paymentForm.value.cdp_number) {
    showToast('Complete todos los campos', 'error');
    return;
  }

  try {
    confirmingPayment.value = true;
    
    const formData = new FormData();
    formData.append('cdp_type', paymentForm.value.cdp_type);
    formData.append('cdp_serie', paymentForm.value.cdp_serie);
    formData.append('cdp_number', paymentForm.value.cdp_number);
    if (paymentForm.value.payment_proof) {
      formData.append('payment_proof', paymentForm.value.payment_proof);
    }

    const res = await fetch(`${apiBase.value}/${paymentOrder.value.id}/confirm-payment`, {
      method: 'POST',
      headers: { 'X-CSRF-TOKEN': getCsrfToken() },
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast('Pago confirmado', 'success');
      closePaymentModal();
      await loadApprovedUnpaid();
      await loadOrders();
      await loadStats();
    } else {
      showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  } finally {
    confirmingPayment.value = false;
  }
};

const toggleUnpaidProject = (projectId) => {
  const idx = expandedUnpaidProjects.value.indexOf(projectId);
  if (idx >= 0) {
    expandedUnpaidProjects.value.splice(idx, 1);
  } else {
    expandedUnpaidProjects.value.push(projectId);
  }
};

const togglePaidProject = (projectId) => {
  const idx = expandedPaidProjects.value.indexOf(projectId);
  if (idx >= 0) {
    expandedPaidProjects.value.splice(idx, 1);
  } else {
    expandedPaidProjects.value.push(projectId);
  }
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
  // Restaurar preferencia de modo oscuro
  if (localStorage.getItem('compras-dark-mode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  loadOrders();
  loadStats();
  loadApprovedUnpaid();
  loadPaidOrders();
});
</script>

<!-- Styles are now in compras_theme.css and compras.css -->

