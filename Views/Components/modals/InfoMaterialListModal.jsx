import { memo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { 
  BuildingOfficeIcon, 
  TagIcon, 
  CalendarIcon, 
  UserIcon, 
  ClockIcon, 
  BriefcaseIcon,
  DocumentTextIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

/**
 * InfoMaterialList – Muestra metadata de una orden de compra con diseño premium.
 */
function InfoMaterialListModal({ open, onClose, order }) {
  if (!order) return null;

  const prioridadBadge = (valor) => {
    const cfg = {
      alta: { bg: 'bg-red-100', text: 'text-red-700', label: 'Alta' },
      media: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Media' },
      baja: { bg: 'bg-green-100', text: 'text-green-700', label: 'Baja' },
    }[valor?.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-700', label: valor || '—' };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      const parsed = new Date(String(val).includes('T') ? val : `${val}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toLocaleDateString('es-PE');
    } catch {
      return val;
    }
  };

  const hasAnyMetadata =
    order.area_solicitante ||
    order.proyecto_obra ||
    order.numero_solicitud ||
    order.fecha_solicitud ||
    order.fecha_requerida ||
    order.prioridad ||
    order.solicitado_por ||
    order.cargo;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Información de Importación"
      size="md"
      showCloseButton={false}
      footer={
        <Button variant="danger" onClick={onClose}>Cerrar</Button>
      }
    >
      <div className="space-y-4">
        {!hasAnyMetadata ? (
          <p className="text-sm text-gray-500 text-center py-4 italic">
            No se encontró metadata adicional para esta lista.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <BuildingOfficeIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ÁREA SOLICITANTE</p>
                <p className="text-sm font-semibold text-gray-900 uppercase truncate" title={order.area_solicitante}>{order.area_solicitante || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <TagIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">N° SOLICITUD</p>
                <p className="text-sm font-semibold text-gray-900 uppercase">{order.numero_solicitud || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CalendarIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">FECHA REQUERIDA</p>
                <p className="text-sm font-semibold text-gray-900 uppercase">{formatDate(order.fecha_requerida)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <UserIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">SOLICITADO POR</p>
                <p className="text-sm font-semibold text-gray-900 uppercase truncate" title={order.solicitado_por}>{order.solicitado_por || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <BuildingOfficeIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PROYECTO / OBRA</p>
                <p className="text-sm font-semibold text-gray-900 uppercase truncate" title={order.proyecto_obra}>{order.proyecto_obra || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <ClockIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">FECHA SOLICITUD</p>
                <p className="text-sm font-semibold text-gray-900 uppercase">{formatDate(order.fecha_solicitud)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <ExclamationCircleIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PRIORIDAD</p>
                <div className="mt-1">{prioridadBadge(order.prioridad)}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-white shadow-sm hover:shadow-md transition-shadow">
              <BriefcaseIcon className="size-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CARGO</p>
                <p className="text-sm font-semibold text-gray-900 uppercase truncate" title={order.cargo}>{order.cargo || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default memo(InfoMaterialListModal);