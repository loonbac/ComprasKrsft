/**
 * @file Autocompletado predictivo de proveedores
 * @module compraskrsft/components/ui/SupplierAutocomplete
 *
 * HyperUI Input (4.1) + dropdown de sugerencias.
 * Se muestra debajo del campo de Proveedor al escribir.
 */
import { useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   onSelect: (supplier: { name: string, document: string }) => void,
 *   suggestions: Array<{ id: number, name: string, document: string }>,
 *   showSuggestions: boolean,
 *   onSearch: (query: string) => void,
 *   onBlur: () => void,
 *   placeholder?: string,
 *   className?: string,
 * }} props
 */
export default function SupplierAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  suggestions,
  showSuggestions,
  onSearch,
  onBlur,
  placeholder = 'Nombre o Razón Social',
  className = '',
}) {
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounce de búsqueda
  const handleChange = (e) => {
    onChange(e);
    const q = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(q), 250);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={clsx('relative', className)} ref={wrapperRef}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="off"
          className="mt-0.5 w-full rounded border-gray-300 shadow-sm sm:text-sm transition-colors focus:border-primary focus:ring-primary"
        />
      </label>

      {/* Dropdown de sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault(); // Evitar que el blur cierre antes del click
                onSelect({ name: supplier.name, document: supplier.document || '' });
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{supplier.name}</p>
                {supplier.document && (
                  <p className="text-xs text-gray-500">{supplier.document_type || 'RUC'}: {supplier.document}</p>
                )}
              </div>
              <svg className="size-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
