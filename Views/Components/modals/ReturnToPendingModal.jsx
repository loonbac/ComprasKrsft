import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';

export default function ReturnToPendingModal({
  isOpen,
  onClose,
  onConfirm,
  orderTitle,
}) {
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!observation.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(observation);
      setObservation('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
                  <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 inline-flex items-center gap-2">
                    <ArrowUturnLeftIcon className="size-5 text-amber-500" />
                    Devolver a Por Cotizar
                  </Dialog.Title>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                  <div className="mb-4 text-sm text-gray-600">
                    Estás a punto de devolver el item <span className="font-bold text-gray-800">"{orderTitle}"</span> a la etapa inicial ("Por Cotizar"). Se borrarán sus precios actuales para que pueda ser recotizado.
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observación o Motivo <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-amber-500 focus:ring-amber-500"
                      rows="4"
                      placeholder="Ej. El proveedor canceló, precio incorrecto, se requiere cambio de proveedor..."
                      required
                    ></textarea>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button variant="danger" onClick={onClose} type="button">
                      CERRAR
                    </Button>
                    <Button 
                      variant="primary" 
                      type="submit" 
                      disabled={isSubmitting || observation.trim().length < 3}
                      className="bg-amber-500 hover:bg-amber-600 border-amber-600 text-white"
                    >
                      {isSubmitting ? 'Devolviendo...' : 'Confirmar Devolución'}
                    </Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
