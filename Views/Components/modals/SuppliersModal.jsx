/**
 * @file Modal de Gestión de Proveedores
 * @module compraskrsft/components/modals/SuppliersModal
 *
 * Lista todos los proveedores registrados con un desplegable por proveedor
 * que muestra el total de gastos en Soles (PEN), convirtiendo USD usando
 * el tipo de cambio exacto registrado en la transacción original.
 *
 * Incluye edición inline de datos del proveedor.
 *
 * Diseño: HyperUI Modal + Table/Divider patterns.
 */
import {
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingStorefrontIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { formatNumber } from '../../utils';

/**
 * Campo de información del proveedor (lectura)
 */
function InfoField({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm text-gray-700 break-all">{value}</p>
      </div>
    </div>
  );
}

/**
 * Formulario de edición inline
 */
function EditForm({ editForm, setEditForm, onSave, onCancel, saving }) {
  const handleChange = (field) => (e) => {
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <PencilSquareIcon className="size-4" />
        Editar Proveedor
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Nombre / Razón Social"
          value={editForm.name}
          onChange={handleChange('name')}
          required
        />
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Tipo Doc.</span>
              <select
                value={editForm.document_type}
                onChange={handleChange('document_type')}
                className="mt-0.5 w-full rounded border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              >
                <option value="RUC">RUC</option>
                <option value="DNI">DNI</option>
                <option value="CE">CE</option>
              </select>
            </label>
          </div>
          <div className="flex-1">
            <Input
              label="Nº Documento"
              value={editForm.document}
              onChange={handleChange('document')}
            />
          </div>
        </div>
        <Input
          label="Teléfono"
          value={editForm.contact_phone}
          onChange={handleChange('contact_phone')}
          placeholder="+51 999 999 999"
        />
        <Input
          label="Email"
          type="email"
          value={editForm.contact_email}
          onChange={handleChange('contact_email')}
          placeholder="correo@empresa.com"
        />
        <div className="sm:col-span-2">
          <Input
            label="Dirección"
            value={editForm.address}
            onChange={handleChange('address')}
            placeholder="Av. Ejemplo 123, Lima"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notas</span>
            <textarea
              value={editForm.notes}
              onChange={handleChange('notes')}
              rows={2}
              className="mt-0.5 w-full rounded border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              placeholder="Observaciones internas..."
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="danger" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !editForm.name?.trim()}>
          {saving ? (
            <div className="mr-1 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckIcon className="mr-1 size-4" />
          )}
          Guardar
        </Button>
      </div>
    </div>
  );
}

export default function SuppliersModal({
  showSuppliersModal,
  closeSuppliersModal,
  suppliersWithSpending,
  loadingSuppliers,
  expandedSupplier,
  toggleSupplierExpanded,
  deactivateSupplier,
  editingSupplier,
  editForm,
  setEditForm,
  savingSupplier,
  startEditSupplier,
  cancelEditSupplier,
  saveSupplier,
}) {
  return (
    <Modal
      open={showSuppliersModal}
      onClose={closeSuppliersModal}
      title="Gestión de Proveedores"
      titleIcon={<UsersIcon className="size-5 text-primary" />}
      size="lg"
      footer={
        <Button variant="danger" onClick={closeSuppliersModal}>
          Cerrar
        </Button>
      }
    >
      {loadingSuppliers ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          <span className="ml-3 text-sm text-gray-500">Cargando proveedores...</span>
        </div>
      ) : suppliersWithSpending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BuildingStorefrontIcon className="size-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No hay proveedores registrados</p>
          <p className="mt-1 text-xs text-gray-400">Los proveedores se registran automáticamente al aprobar compras</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Resumen global */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm font-medium text-gray-700">
              {suppliersWithSpending.length} proveedor{suppliersWithSpending.length !== 1 ? 'es' : ''} registrado{suppliersWithSpending.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Total: S/ {formatNumber(suppliersWithSpending.reduce((sum, s) => sum + (s.total_pen || 0), 0))}
            </span>
          </div>

          {/* Lista de proveedores */}
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {suppliersWithSpending.map((supplier) => {
              const isExpanded = expandedSupplier === supplier.id;
              const isEditing = editingSupplier === supplier.id;

              return (
                <div key={supplier.id}>
                  {/* Fila del proveedor */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    onClick={() => toggleSupplierExpanded(supplier.id)}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <BuildingStorefrontIcon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{supplier.name}</p>
                      <p className="text-xs text-gray-500">
                        {supplier.document_type || 'RUC'}: {supplier.document || '—'} · {supplier.order_count || 0} compra{(supplier.order_count || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">S/ {formatNumber(supplier.total_pen || 0)}</p>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUpIcon className="size-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="size-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Desplegable: detalle */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-3 pt-2 space-y-3">

                      {/* ── Modo edición ── */}
                      {isEditing ? (
                        <EditForm
                          editForm={editForm}
                          setEditForm={setEditForm}
                          onSave={saveSupplier}
                          onCancel={cancelEditSupplier}
                          saving={savingSupplier}
                        />
                      ) : (
                        <>
                          {/* Info del proveedor (siempre visible) */}
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del Proveedor</p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditSupplier(supplier);
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                              >
                                <PencilSquareIcon className="size-3.5" />
                                Editar
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <InfoField icon={IdentificationIcon} label="Nombre / Razón Social" value={supplier.name} />
                              <InfoField
                                icon={DocumentTextIcon}
                                label={`${supplier.document_type || 'RUC'}`}
                                value={supplier.document || '—'}
                              />
                              <InfoField icon={PhoneIcon} label="Teléfono" value={supplier.contact_phone} />
                              <InfoField icon={EnvelopeIcon} label="Email" value={supplier.contact_email} />
                              <InfoField icon={MapPinIcon} label="Dirección" value={supplier.address} />
                              {supplier.notes && (
                                <div className="sm:col-span-2">
                                  <InfoField icon={DocumentTextIcon} label="Notas" value={supplier.notes} />
                                </div>
                              )}
                            </div>
                            {!supplier.contact_phone && !supplier.contact_email && !supplier.address && !supplier.notes && (
                              <p className="mt-2 text-xs italic text-gray-400">
                                Sin información de contacto. Usa "Editar" para completar los datos.
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Acciones */}
                      {!isEditing && (
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`¿Desactivar al proveedor "${supplier.name}"?`)) {
                                deactivateSupplier(supplier.id);
                              }
                            }}
                          >
                            Desactivar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
