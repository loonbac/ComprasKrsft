/**
 * @file Orquestador principal del módulo Compras
 * @module compraskrsft/Index
 *
 * Estructura modular:
 *   utils.js           → Constantes y funciones puras
 *   hooks/             → Lógica de negocio (API, datos, tabs, quickPay)
 *   Components/        → Componentes presentacionales + Kit UI
 */
import Toast from './Components/ui/Toast';

// Hooks
import { useComprasApi } from './hooks/useComprasApi';
import { useComprasData } from './hooks/useComprasData';
import { usePendingTab } from './hooks/usePendingTab';
import { useQuotedTab } from './hooks/useQuotedTab';
import { useToPayTab } from './hooks/useToPayTab';
import { usePaidTab } from './hooks/usePaidTab';
import { useQuickPay } from './hooks/useQuickPay';
import { useSuppliers } from './hooks/useSuppliers';

// Layout
import ComprasHeader from './Components/ComprasHeader';
import ComprasStats from './Components/ComprasStats';
import ComprasTabBar from './Components/ComprasTabBar';

// Tabs
import PendingTab from './Components/PendingTab';
import QuotedTab from './Components/QuotedTab';
import ToPayTab from './Components/ToPayTab';
import PaidTab from './Components/PaidTab';
import RecopilacionTab from './Components/RecopilacionTab';
import ContasisTab from './Components/ContasisTab';

// Modals
import ApprovalOrderModal from './Components/modals/ApprovalOrderModal';
import BulkPayModal from './Components/modals/BulkPayModal';
import PaymentModal from './Components/modals/PaymentModal';
import EditComprobanteModal from './Components/modals/EditComprobanteModal';
import QuickPayModal from './Components/modals/QuickPayModal';

import EditCreditModal from './Components/modals/EditCreditModal';
import RejectModal from './Components/modals/RejectModal';
import SuppliersModal from './Components/modals/SuppliersModal';

// ─────────────────────────────────────────────────────────────────────────────

export default function ComprasIndex({ auth }) {
  const api = useComprasApi();
  const data = useComprasData({ apiBase: api.apiBase, auth });

  const pending = usePendingTab({
    pendingOrders: data.pendingOrders,
    apiBase: api.apiBase,
    showToast: data.showToast,
    loadPendingOrders: data.loadPendingOrders,
    loadToPayOrders: data.loadQuotedOrders,
    currentExchangeRate: api.currentExchangeRate,
    loadingRate: api.loadingRate,
    fetchExchangeRate: api.fetchExchangeRate,
    permissions: data.permissions,
  });

  const quoted = useQuotedTab({
    quotedOrders: data.quotedOrders,
    apiBase: api.apiBase,
    showToast: data.showToast,
    loadQuotedOrders: data.loadQuotedOrders,
    loadToPayOrders: data.loadToPayOrders,
    loadPendingOrders: data.loadPendingOrders,
    permissions: data.permissions,
  });

  const toPay = useToPayTab({
    orders: data.orders,
    apiBase: api.apiBase,
    showToast: data.showToast,
    loadToPayOrders: data.loadToPayOrders,
    loadPaidBatches: data.loadPaidBatches,
    currentExchangeRate: api.currentExchangeRate,
    loadingRate: api.loadingRate,
    fetchExchangeRate: api.fetchExchangeRate,
    permissions: data.permissions,
  });

  const paid = usePaidTab({
    paidBatches: data.paidBatches,
    apiBase: api.apiBase,
    showToast: data.showToast,
    loadPaidBatches: data.loadPaidBatches,
  });

  const quickPay = useQuickPay({
    apiBase: api.apiBase,
    showToast: data.showToast,
    loadPaidBatches: data.loadPaidBatches,
    setActiveTab: data.setActiveTab,
    fetchExchangeRate: api.fetchExchangeRate,
    currentExchangeRate: api.currentExchangeRate,
    loadingRate: api.loadingRate,
    permissions: data.permissions,
  });

  const suppliers = useSuppliers({ apiBase: api.apiBase });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-12 py-4">
        <div className="space-y-6">
          <ComprasHeader onBack={data.goBack} onOpenSuppliers={suppliers.openSuppliersModal} />

          <ComprasStats
            pendingCount={data.pendingOrders.length}
            toPayCount={data.orders.length}
            totalToPay={toPay.totalToPayAmount}
            totalPaid={paid.totalPaidAmount}
            paidBatches={data.paidBatches}
          />

          <ComprasTabBar
            activeTab={data.activeTab}
            setActiveTab={data.setActiveTab}
            pendingCount={data.pendingOrders.length}
            quotedCount={data.quotedOrders.length}
            toPayCount={data.orders.length}
            paidCount={data.paidBatches.length}
            totalCount={data.pendingOrders.length + data.quotedOrders.length + data.orders.length + data.paidBatches.length}
            loadPendingOrders={data.loadPendingOrders}
            loadQuotedOrders={data.loadQuotedOrders}
            loadToPayOrders={data.loadToPayOrders}
            loadPaidBatches={data.loadPaidBatches}
            loadAllData={() => {
              data.loadPendingOrders();
              data.loadQuotedOrders();
              data.loadToPayOrders();
              data.loadPaidBatches();
            }}
            permissions={data.permissions}
          />

          {data.activeTab === 'pending' && data.permissions.view && <PendingTab loading={data.loading} {...pending} />}
          {data.activeTab === 'quoted' && data.permissions.approve && <QuotedTab loading={data.loading} {...quoted} />}
          {data.activeTab === 'to_pay' && data.permissions.pay && <ToPayTab loading={data.loading} {...toPay} onOpenQuickPay={quickPay.openQuickPayModal} onOpenEditCredit={toPay.openEditCreditModal} />}
          {data.activeTab === 'paid' && data.permissions.paid_limited && <PaidTab paidBatches={data.paidBatches} {...paid} apiBase={api.apiBase} permissions={data.permissions} />}
          {data.activeTab === 'recopilacion' && data.permissions.export && (
            <RecopilacionTab
              loading={data.loading}
              pendingOrders={data.pendingOrders}
              toPayBatches={toPay.filteredToPayBatches}
              paidBatches={data.paidBatches}
            />
          )}
          {data.activeTab === 'contasis' && data.permissions.finalize && (
            <ContasisTab
              loading={data.loading}
              pendingOrders={data.pendingOrders}
              toPayBatches={toPay.filteredToPayBatches}
              paidBatches={data.paidBatches}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ApprovalOrderModal
        open={pending.showApprovalModal}
        onClose={pending.closeApprovalModal}
        orders={pending.selectedApprovalOrdersData}
        approvalForm={pending.approvalForm}
        setApprovalForm={pending.setApprovalForm}
        onCurrencyChange={pending.onApprovalCurrencyChange}
        loadingRate={api.loadingRate}
        currentExchangeRate={api.currentExchangeRate}
        prices={pending.approvalPrices}
        setPrices={pending.setApprovalPrices}
        stockAssignments={pending.stockAssignments}
        setStockAssignments={pending.setStockAssignments}
        onSubmit={pending.submitApprovalPending}
        canSubmit={pending.canSubmitApproval}
        submitting={pending.approvingPending}
        suppliers={suppliers}
        onSearchInventory={pending.searchInventory}
        allFromInventory={pending.allFromInventory}
      />
      <RejectModal
        showRejectModal={pending.showRejectModal}
        closeRejectModal={pending.closeRejectModal}
        confirmReject={pending.confirmReject}
        rejecting={pending.rejecting}
        orderInfo={data.pendingOrders.find(o => o.id === pending.rejectingOrderId)}
      />
      <BulkPayModal {...toPay} loadingRate={api.loadingRate} currentExchangeRate={api.currentExchangeRate} suppliers={suppliers} />
      <PaymentModal {...toPay} />
      <EditComprobanteModal {...paid} />
      <QuickPayModal {...quickPay} suppliers={suppliers} />
      {toPay.showEditCreditModal && (
        <EditCreditModal
          batch={toPay.editCreditBatch}
          onClose={toPay.closeEditCreditModal}
          onConfirm={toPay.confirmExtendCredit}
          saving={toPay.savingCredit}
        />
      )}

      <SuppliersModal {...suppliers} />

      <Toast
        show={data.toast.show}
        message={data.toast.message}
        type={data.toast.type}
        onHide={() => data.setToast((p) => ({ ...p, show: false }))}
      />
    </div>
  );
}
