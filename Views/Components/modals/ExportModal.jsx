/**
 * @file Modal de Exportación de Compras Pagadas
 * @module compraskrsft/components/modals/ExportModal
 */
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

/**
 * @param {{
 *   showExportModal: boolean,
 *   closeExportModal: Function,
 *   exportFilter: { startDate: string, endDate: string, preset: string },
 *   setExportFilter: Function,
 *   setExportPreset: Function,
 *   exportPaidExcelWithFilter: Function,
 * }} props
 */
export default function ExportModal({
  showExportModal,
  closeExportModal,
  exportFilter,
  setExportFilter,
  setExportPreset,
  exportPaidExcelWithFilter,
}) {
  return (
    <Modal
      open={showExportModal}
      onClose={closeExportModal}
      title="Exportar Registro de Compras"
      titleIcon={<ArrowDownTrayIcon className="size-5 text-primary" />}
      footer={
        <>
          <Button variant="danger" onClick={closeExportModal}>Cancelar</Button>
          <Button variant="primary" onClick={exportPaidExcelWithFilter}>Exportar Excel</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Período Predefinido:</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: '7days', label: 'Últimos 7 días' },
              { key: '30days', label: 'Últimos 30 días' },
              { key: '90days', label: 'Últimos 90 días' },
              { key: 'custom', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setExportPreset(p.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  exportFilter.preset === p.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {exportFilter.preset === 'custom' && (
          <div className="flex items-center gap-3">
            <Input label="Desde" type="date" value={exportFilter.startDate} onChange={(e) => setExportFilter((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="Hasta" type="date" value={exportFilter.endDate} onChange={(e) => setExportFilter((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
        )}
      </div>
    </Modal>
  );
}
