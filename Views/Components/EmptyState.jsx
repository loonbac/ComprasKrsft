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
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-white py-10 text-center shadow-sm">
      <span className="rounded-full bg-gray-100 p-3 text-gray-400">
        {icon || <DocumentTextIcon className="size-6" />}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
