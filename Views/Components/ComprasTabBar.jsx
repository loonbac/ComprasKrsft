/**
 * @file Barra de pestañas del módulo Compras
 * @module compraskrsft/components/ComprasTabBar
 */
import {
  ClockIcon,
  CurrencyDollarIcon,
  CheckBadgeIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

/**
 * @param {{
 *   activeTab: string,
 *   setActiveTab: (tab: string) => void,
 *   pendingCount: number,
 *   quotedCount: number,
 *   toPayCount: number,
 *   paidCount: number,
 *   totalCount: number,
 *   loadPendingOrders: Function,
 *   loadQuotedOrders: Function,
 *   loadToPayOrders: Function,
 *   loadPaidBatches: Function,
 *   loadAllData: Function,
 * }} props
 */
export default function ComprasTabBar({
  activeTab,
  setActiveTab,
  pendingCount,
  quotedCount,
  toPayCount,
  paidCount,
  totalCount,
  loadPendingOrders,
  loadQuotedOrders,
  loadToPayOrders,
  loadPaidBatches,
  loadAllData,
  permissions = {},
}) {
  const tabs = [
    {
      key: 'pending',
      permKey: 'view',
      label: 'POR COTIZAR',
      count: pendingCount,
      load: loadPendingOrders,
      icon: ClockIcon,
      activeColor: 'border-amber-500',
      textActiveColor: 'text-amber-600',
    },
    {
      key: 'quoted',
      permKey: 'approve',
      label: 'POR APROBAR',
      count: quotedCount,
      load: loadQuotedOrders,
      icon: ShieldCheckIcon,
      activeColor: 'border-violet-500',
      textActiveColor: 'text-violet-600',
    },
    {
      key: 'to_pay',
      permKey: 'pay',
      label: 'POR PAGAR',
      count: toPayCount,
      load: loadToPayOrders,
      icon: CurrencyDollarIcon,
      activeColor: 'border-red-500',
      textActiveColor: 'text-red-600',
    },
    {
      key: 'paid',
      permKey: 'paid_limited',
      label: 'PAGADAS',
      count: paidCount,
      load: loadPaidBatches,
      icon: CheckBadgeIcon,
      activeColor: 'border-emerald-500',
      textActiveColor: 'text-emerald-600',
    },
    {
      key: 'recopilacion',
      permKey: 'export',
      label: 'RECOPILACIÓN',
      count: totalCount,
      load: loadAllData,
      icon: TableCellsIcon,
      activeColor: 'border-blue-500',
      textActiveColor: 'text-blue-600',
    },
    {
      key: 'contasis',
      permKey: 'finalize',
      label: 'CONTASIS',
      count: 0,
      load: loadAllData,
      icon: DocumentTextIcon,
      activeColor: 'border-purple-500',
      textActiveColor: 'text-purple-600',
    },
  ].filter((tab) => permissions[tab.permKey]);

  return (
    <div className="flex gap-6 border-b border-gray-200" role="tablist" aria-label="Secciones de compras">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => { setActiveTab(tab.key); tab.load(); }}
            className={`inline-flex items-center gap-2 px-1 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-[1px] ${
              isActive
                ? `${tab.activeColor} ${tab.textActiveColor}`
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
