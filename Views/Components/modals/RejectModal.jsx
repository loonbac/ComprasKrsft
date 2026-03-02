/**
 * @file Modal de confirmación para rechazar orden
 * @module compraskrsft/components/modals/RejectModal
 */
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

/**
 * @param {{
 *   showRejectModal: boolean,
 *   closeRejectModal: Function,
 *   confirmReject: Function,
 *   rejecting: boolean,
 *   orderInfo: Object|null,
 * }} props
 */
export default function RejectModal({
  showRejectModal,
  closeRejectModal,
  confirmReject,
  rejecting,
  orderInfo,
}) {
  return (
    <Modal
      open={showRejectModal}
      onClose={closeRejectModal}
      title="Rechazar Orden"
      titleIcon={<ExclamationTriangleIcon className="size-5 text-red-500" />}
      size="sm"
      footer={
        <>
          <Button variant="danger" onClick={closeRejectModal} disabled={rejecting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmReject} disabled={rejecting} loading={rejecting}>
            {rejecting ? 'Rechazando...' : 'Rechazar Orden'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          ¿Estás seguro de que deseas rechazar esta orden?
        </p>
        {orderInfo && (
          <div className="rounded-lg bg-gray-50 p-4 space-y-2">
            <div className="text-sm">
              <span className="font-medium text-gray-900">Proyecto:</span>
              <span className="ml-2 text-gray-700">{orderInfo.project_name}</span>
            </div>
            {orderInfo.description && (
              <div className="text-sm">
                <span className="font-medium text-gray-900">Material:</span>
                <span className="ml-2 text-gray-700">{orderInfo.description}</span>
              </div>
            )}
          </div>
        )}
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-700">
            <strong>Advertencia:</strong> Esta acción no se puede deshacer. La orden será marcada como rechazada.
          </p>
        </div>
      </div>
    </Modal>
  );
}
