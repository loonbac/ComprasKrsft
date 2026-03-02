/**
 * @file Cabecera del módulo Compras
 * @module compraskrsft/components/ComprasHeader
 */
import { ArrowLeftIcon, ShoppingCartIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';

/**
 * @param {{ onBack: () => void, onOpenSuppliers: () => void }} props
 */
export default function ComprasHeader({ onBack, onOpenSuppliers }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6">
      <div className="flex items-center gap-4">
        <Button variant="primary" size="md" onClick={onBack} className="gap-2">
          <ArrowLeftIcon className="size-4" />
          Volver
        </Button>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
          <span className="flex items-center justify-center rounded-xl bg-primary p-2.5">
            <ShoppingCartIcon className="size-6 text-white" />
          </span>
          <span>
            GESTIÓN DE COMPRAS
            <p className="text-sm font-normal text-gray-500">Administre las órdenes de compra y proveedores</p>
          </span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSuppliers}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:border-gray-400"
        >
          <BuildingStorefrontIcon className="size-4" />
          Gestión de Proveedores
        </button>
      </div>
    </header>
  );
}
