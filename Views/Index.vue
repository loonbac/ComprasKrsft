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
          <button @click="activeTab = 'to_pay'; loadToPayOrders()" :class="{ active: activeTab === 'to_pay' }" class="main-tab">
            Por Pagar
            <span class="tab-badge unpaid-badge">{{ orders.length }}</span>
          </button>
          <button @click="activeTab = 'pending'; loadPendingOrders()" :class="{ active: activeTab === 'pending' }" class="main-tab">
            Por Aprobar
            <span class="tab-badge pending-badge">{{ pendingOrders.length }}</span>
          </button>
          <button @click="activeTab = 'paid'; loadPaidBatches()" :class="{ active: activeTab === 'paid' }" class="main-tab">
            Pagadas
          </button>

        </div>

        <!-- TAB: Por Aprobar - Proyectos agrupados -->
        <template v-if="activeTab === 'pending'">
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
            <span>Cargando órdenes...</span>
          </div>

          <div v-else-if="pendingOrders.length === 0" class="empty-state">
            <h3>No hay órdenes pendientes</h3>
            <p>Las órdenes de compra aparecerán aquí cuando se creen desde Proyectos</p>
          </div>

          <div v-else class="pending-approval">
            <div class="project-list">
              <div
                v-for="proj in pendingProjects"
                :key="proj.id"
                class="project-card"
                :class="{ active: selectedPendingProjectId === proj.id }"
                @click="selectPendingProject(proj.id)"
              >
                <div class="project-title">{{ proj.name }}</div>
                <div class="project-meta">{{ proj.count }} items</div>
              </div>
            </div>

            <!-- Lists View -->
            <div class="project-orders" v-if="selectedPendingProject">
              <h3>Listas de {{ selectedPendingProject.name }}</h3>
              
              <!-- Lists Grid -->
              <div v-if="pendingLists.length > 0" class="lists-grid">
                <div
                  v-for="list in pendingLists"
                  :key="list.filename"
                  class="list-card"
                  :class="{ active: selectedPendingListId === list.filename }"
                  @click="selectPendingList(list.filename)"
                >
                  <div class="list-name">{{ list.filename || 'Sin archivo' }}</div>
                  <div class="list-count">{{ list.count }} items</div>
                </div>
              </div>

              <!-- Items View -->
              <div v-if="selectedPendingList" class="items-section">
                <div class="selection-info">
                  <button @click="selectAllPendingList" class="btn-approve-selected">
                    {{ pendingListAllSelected ? 'Deseleccionar de lista' : 'Seleccionar todos de lista' }}
                  </button>
                  <span v-if="selectedPendingIds.length > 0" class="selection-count">{{ selectedPendingIds.length }} seleccionados</span>
                  <button v-if="selectedPendingIds.length > 0" @click="openApprovalModal" :disabled="approvingPending" class="btn-approve-selected">
                    {{ approvingPending ? 'Aprobando...' : 'Aprobar seleccionados' }}
                  </button>
                </div>
                
                <div class="table-container">
                  <table class="orders-table">
                    <thead>
                      <tr>
                        <th class="col-item">ITEM</th>
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
                        v-for="order in paginatedPendingOrders"
                        :key="order.id"
                        @click="togglePendingSelect(order.id)"
                        :class="{ selected: isPendingSelected(order.id) }"
                      >
                        <td class="col-item">{{ order.item_number || '-' }}</td>
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
                            <button @click.stop="markToPay(order.id)" class="btn-sm btn-approve">Aprobar</button>
                            <button @click.stop="rejectOrder(order.id)" class="btn-sm btn-reject">Rechazar</button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Pagination -->
                <div v-if="totalPagesPending > 1" class="pagination">
                  <button @click="currentPagePending--" :disabled="currentPagePending <= 1" class="btn-page">← Anterior</button>
                  <span class="page-info">Página {{ currentPagePending }} de {{ totalPagesPending }}</span>
                  <button @click="currentPagePending++" :disabled="currentPagePending >= totalPagesPending" class="btn-page">Siguiente →</button>
                </div>
              </div>

              <div v-else-if="pendingLists.length > 0" class="empty-state">
                <h3>Seleccione una lista</h3>
                <p>Elija una lista para ver sus items</p>
              </div>
            </div>

            <div v-else class="empty-state">
              <h3>Seleccione un proyecto</h3>
              <p>Elija un proyecto para ver sus listas de materiales</p>
            </div>
          </div>
        </template>

        <!-- TAB: Por Pagar - Table View -->
        <template v-if="activeTab === 'to_pay'">
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
                Pagar Seleccionados
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
            <h3>No hay órdenes por pagar</h3>
            <p>Las órdenes aprobadas aparecerán aquí para registrar el pago</p>
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
                      <button @click="openSingleApproveModal(order)" class="btn-sm btn-approve">Pagar</button>
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
                  <span v-if="batchAllDelivered(batch)" class="delivered-badge">✓ Entregado</span>
                  <span v-else class="paid-badge">✓ Pagado</span>
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
                  <span v-if="order.delivery_confirmed" class="item-delivered-badge">Entregado</span>
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


      </main>

      <!-- Approval Pricing Modal (Por Aprobar) -->
      <Teleport to="body">
        <div v-if="showApprovalModal" class="modal-overlay" @click.self="closeApprovalModal">
          <div class="modal-content modal-lg">
            <div class="modal-header">
              <h2>Enviar {{ selectedApprovalOrdersData.length }} Órdenes a Por Pagar</h2>
              <button @click="closeApprovalModal" class="btn-close">×</button>
            </div>
            
            <div class="modal-body">
              <!-- Seller & Billing Info -->
              <div class="form-section">
                <h4>Datos de Facturación</h4>
                <div class="form-row">
                  <div class="form-group flex-2">
                    <label>Proveedor *</label>
                    <input v-model="approvalForm.seller_name" type="text" class="input-field" placeholder="Nombre o Razón Social" />
                  </div>
                  <div class="form-group flex-1">
                    <label>RUC/DNI</label>
                    <input v-model="approvalForm.seller_document" type="text" class="input-field" placeholder="20123456789" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>Moneda</label>
                    <select v-model="approvalForm.currency" class="input-field" @change="onApprovalCurrencyChange">
                      <option value="PEN">PEN - Soles</option>
                      <option value="USD">USD - Dólares</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label>Fecha Emisión</label>
                    <input v-model="approvalForm.issue_date" type="date" class="input-field" />
                  </div>
                </div>
              </div>

              <!-- Exchange Rate Info -->
              <div v-if="approvalForm.currency === 'USD'" class="exchange-info">
                <span v-if="loadingRate">Obteniendo tipo de cambio...</span>
                <span v-else-if="currentExchangeRate > 0">T.C: 1 USD = S/ {{ currentExchangeRate.toFixed(4) }}</span>
                <span v-else class="error">No se pudo obtener tipo de cambio</span>
              </div>

              <!-- Materials Pricing -->
              <div class="form-section">
                <h4>Precios por Material</h4>
                <div class="pricing-list">
                  <div v-for="order in selectedApprovalOrdersData" :key="order.id" class="pricing-row">
                    <div class="pricing-info">
                      <span class="pricing-project">{{ order.project_name }}</span>
                      <span class="pricing-material">{{ getOrderTitle(order) }}</span>
                      <span class="pricing-qty">{{ getOrderQty(order) }}</span>
                    </div>
                    <div class="pricing-input">
                      <span class="currency-prefix">{{ approvalForm.currency === 'USD' ? '$' : 'S/' }}</span>
                      <input 
                        v-model.number="approvalPrices[order.id]" 
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
                  <span>{{ approvalForm.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(approvalSubtotal) }}</span>
                </div>
                <div class="total-row total-final">
                  <span>TOTAL:</span>
                  <span>{{ approvalForm.currency === 'USD' ? '$' : 'S/' }} {{ formatNumber(approvalSubtotal) }}</span>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="closeApprovalModal" class="btn-cancel">Cancelar</button>
              <button @click="submitApprovalPending" :disabled="!canSubmitApproval || approvingPending" class="btn-submit">
                {{ approvingPending ? 'Aprobando...' : `Enviar ${selectedApprovalOrdersData.length} a Por Pagar` }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Bulk Approve Modal -->
      <Teleport to="body">
        <div v-if="showBulkModal" class="modal-overlay" @click.self="closeBulkModal">
          <div class="modal-content modal-lg">
            <div class="modal-header">
              <h2>Pagar {{ selectedOrdersData.length }} Órdenes</h2>
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
                {{ approving ? 'Pagando...' : `Pagar ${selectedOrdersData.length} Órdenes` }}
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
const pendingOrders = ref([]);
const batches = ref([]);
const paidBatches = ref([]);

const projectList = ref([]);
const selectedOrders = ref([]);
const prices = ref({});
const activeTab = ref('pending');
const toast = ref({ show: false, message: '', type: 'success' });
const selectedPendingProjectId = ref(null);
const selectedPendingListId = ref(null);
const selectedPendingIds = ref([]);
const approvingPending = ref(false);
const showApprovalModal = ref(false);
const approvalPrices = ref({});
const selectedApprovalIds = ref([]);
const currentPagePending = ref(1);
const perPagePending = 20;

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

const approvalForm = ref({
  seller_name: '',
  seller_document: '',
  currency: 'PEN',
  issue_date: new Date().toISOString().split('T')[0]
});

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
  let result = orders.value;
  if (filterProject.value) result = result.filter(o => o.project_id == filterProject.value);
  if (filterType.value) result = result.filter(o => o.type === filterType.value);
  return result;
});

const pendingProjects = computed(() => {
  const map = {};
  pendingOrders.value.forEach(o => {
    if (!map[o.project_id]) {
      map[o.project_id] = { id: o.project_id, name: o.project_name, count: 0 };
    }
    map[o.project_id].count += 1;
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
});

const selectedPendingProject = computed(() => {
  if (!selectedPendingProjectId.value) return null;
  return pendingProjects.value.find(p => p.id === selectedPendingProjectId.value) || null;
});

const pendingLists = computed(() => {
  if (!selectedPendingProjectId.value) return [];
  const lists = {};
  pendingOrders.value
    .filter(o => o.project_id === selectedPendingProjectId.value)
    .forEach(o => {
      const filename = o.source_filename || 'Manual';
      if (!lists[filename]) {
        lists[filename] = { filename, count: 0 };
      }
      lists[filename].count += 1;
    });
  return Object.values(lists).sort((a, b) => a.filename.localeCompare(b.filename));
});

const selectedPendingList = computed(() => {
  if (!selectedPendingListId.value) return null;
  return pendingLists.value.find(l => l.filename === selectedPendingListId.value) || null;
});

const selectedPendingOrders = computed(() => {
  if (!selectedPendingProjectId.value || !selectedPendingListId.value) return [];
  return pendingOrders.value.filter(o => 
    o.project_id === selectedPendingProjectId.value &&
    (o.source_filename || 'Manual') === selectedPendingListId.value
  );
});

const totalPagesPending = computed(() => Math.ceil(selectedPendingOrders.value.length / perPagePending) || 1);

const paginatedPendingOrders = computed(() => {
  const start = (currentPagePending.value - 1) * perPagePending;
  return selectedPendingOrders.value.slice(start, start + perPagePending);
});

const pendingListAllSelected = computed(() => {
  if (!selectedPendingListId.value) return false;
  const ids = selectedPendingOrders.value.map(o => o.id);
  return ids.length > 0 && ids.every(id => selectedPendingIds.value.includes(id));
});

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / perPage) || 1);

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return filteredOrders.value.slice(start, start + perPage);
});

const allSelected = computed(() => {
  return paginatedOrders.value.length > 0 && paginatedOrders.value.every(o => selectedOrders.value.includes(o.id));
});

const selectedApprovalOrdersData = computed(() => {
  return pendingOrders.value.filter(o => selectedPendingIds.value.includes(o.id));
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

const approvalSubtotal = computed(() => {
  return selectedPendingIds.value.reduce((sum, id) => sum + (parseFloat(approvalPrices.value[id]) || 0), 0);
});

const canSubmitApproval = computed(() => {
  if (!approvalForm.value.seller_name) return false;
  if (approvalSubtotal.value <= 0) return false;
  if (approvalForm.value.currency === 'USD' && currentExchangeRate.value <= 0) return false;
  return true;
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

// Check if all orders in a batch are delivered
const batchAllDelivered = (batch) => {
  return batch.orders?.every(o => o.delivery_confirmed) || false;
};

const getOrderQty = (order) => {
  if (order.type === 'service') return '-';
  if (order.materials?.length > 0) {
    const mat = order.materials[0];
    if (typeof mat === 'object' && mat.qty) return mat.qty;
  }
  return '-';
};

const selectPendingProject = (projectId) => {
  selectedPendingProjectId.value = projectId;
  selectedPendingListId.value = null;
  currentPagePending.value = 1;
};

const selectPendingList = (filename) => {
  selectedPendingListId.value = filename;
  currentPagePending.value = 1;
};

const selectAllPendingList = () => {
  if (!selectedPendingListId.value) return;
  const ids = selectedPendingOrders.value.map(o => o.id);
  if (pendingListAllSelected.value) {
    selectedPendingIds.value = selectedPendingIds.value.filter(id => !ids.includes(id));
  } else {
    const set = new Set(selectedPendingIds.value);
    ids.forEach(id => set.add(id));
    selectedPendingIds.value = Array.from(set);
  }
};

const pendingProjectAllSelected = computed(() => {
  if (!selectedPendingProjectId.value) return false;
  const ids = pendingOrders.value
    .filter(o => o.project_id === selectedPendingProjectId.value)
    .map(o => o.id);
  return ids.length > 0 && ids.every(id => selectedPendingIds.value.includes(id));
});

const openApprovalModal = () => {
  selectedApprovalIds.value = [...selectedPendingIds.value];
  approvalPrices.value = {};
  selectedApprovalIds.value.forEach(id => {
    approvalPrices.value[id] = 0;
  });
  approvalForm.value = {
    seller_name: '',
    seller_document: '',
    currency: 'PEN',
    issue_date: new Date().toISOString().split('T')[0]
  };
  showApprovalModal.value = true;
};

const closeApprovalModal = () => {
  showApprovalModal.value = false;
};

const onApprovalCurrencyChange = () => {
  if (approvalForm.value.currency === 'USD') {
    fetchExchangeRate();
  }
};

const submitApprovalPending = async () => {
  if (!canSubmitApproval.value) return;
  approvingPending.value = true;
  
  const ids = [...selectedApprovalIds.value];
  for (const id of ids) {
    await markToPay(id, { silent: true });
  }
  
  await loadPendingOrders();
  await loadToPayOrders();
  selectedPendingIds.value = [];
  approvingPending.value = false;
  closeApprovalModal();
  showToast('Órdenes enviadas a Por Pagar', 'success');
};

const markToPay = async (id, options = {}) => {
  const { silent = false } = options;
  try {
    const res = await fetch(`${apiBase.value}/${id}/mark-to-pay`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() }
    });
    const data = await res.json();
    if (data.success) {
      if (!silent) {
        showToast(data.message || 'Orden enviada a Por Pagar', 'success');
        await loadPendingOrders();
        await loadToPayOrders();
      }
      selectedPendingIds.value = selectedPendingIds.value.filter((pid) => pid !== id);
    } else {
      if (!silent) showToast(data.message || 'Error', 'error');
    }
  } catch (e) {
    if (!silent) showToast('Error', 'error');
  }
};

const approveSelectedPending = async () => {
  if (selectedPendingIds.value.length === 0) return;
  openApprovalModal();
};

const isPendingSelected = (orderId) => selectedPendingIds.value.includes(orderId);

const togglePendingSelect = (orderId) => {
  const idx = selectedPendingIds.value.indexOf(orderId);
  if (idx >= 0) {
    selectedPendingIds.value.splice(idx, 1);
  } else {
    selectedPendingIds.value.push(orderId);
  }
};

// Data Loading
const loadPendingOrders = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${apiBase.value}/pending`);
    const data = await res.json();
    if (data.success) {
      pendingOrders.value = data.orders || [];
      if (!selectedPendingProjectId.value && pendingOrders.value.length > 0) {
        selectedPendingProjectId.value = pendingOrders.value[0].project_id;
      }
      if (selectedPendingProjectId.value && pendingOrders.value.length > 0) {
        const exists = pendingOrders.value.some(o => o.project_id === selectedPendingProjectId.value);
        if (!exists) {
          selectedPendingProjectId.value = pendingOrders.value[0].project_id;
          selectedPendingListId.value = null;
        }
      }
      const pendingIdSet = new Set(pendingOrders.value.map(o => o.id));
      selectedPendingIds.value = selectedPendingIds.value.filter(id => pendingIdSet.has(id));
      if (selectedPendingProjectId.value && !selectedPendingListId.value && pendingLists.value.length > 0) {
        selectedPendingListId.value = pendingLists.value[0].filename;
      }
    }
  } catch (e) { console.error(e); }
  loading.value = false;
};

const loadToPayOrders = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${apiBase.value}/to-pay`);
    const data = await res.json();
    if (data.success) {
      orders.value = data.orders || [];
      // Extract unique projects for filters
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

    const res = await fetch(`${apiBase.value}/pay-bulk`, {
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
      await loadToPayOrders();
      await loadPaidBatches();
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
      await loadPendingOrders();
      await loadToPayOrders();
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
  loadPendingOrders();
  loadToPayOrders();
});
</script>

<style>
/* Theme variables - must be unscoped for :root to work */
@import './compras_theme.css';
</style>

<style scoped>
@import './compras.css';
</style>
