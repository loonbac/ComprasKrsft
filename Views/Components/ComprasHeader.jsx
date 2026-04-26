/**
 * @file Cabecera del módulo Compras
 * @module compraskrsft/components/ComprasHeader
 *
 * Synced with Proyectos PageHeader pattern:
 *   - Same Volver button (Button primary md + gap-2)
 *   - Same h1 with icon-in-rounded-xl pattern
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
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white">
            <ShoppingCartIcon className="size-6" />
          </span>
          <span className="flex flex-col">
            <span className="tracking-tight">GESTIÓN DE COMPRAS</span>
            <span className="text-sm font-normal text-gray-500">Administre las órdenes de compra y proveedores</span>
          </span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="md" onClick={onOpenSuppliers} className="gap-2">
          <BuildingStorefrontIcon className="size-4" />
          Gestión de Proveedores
        </Button>
      </div>
    </header>
  );
}
