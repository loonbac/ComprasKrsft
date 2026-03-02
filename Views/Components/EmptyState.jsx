/**
 * @file Estado vacío reutilizable
 * @module compraskrsft/components/EmptyState
 */
import { DocumentTextIcon } from '@heroicons/react/24/outline';

/**
 * @param {{ title: string, subtitle?: string, icon?: React.ReactNode }} props
 */
export default function EmptyState({ title, subtitle, icon }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-12 text-center">
      {icon || <DocumentTextIcon className="mx-auto size-16 text-gray-300" />}
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
