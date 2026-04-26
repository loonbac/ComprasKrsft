/**
 * @file Hook de configuración de API y tipo de cambio
 * @module compraskrsft/hooks/useComprasApi
 */
import { useState, useCallback, useMemo } from 'react';

/**
 * Provee la URL base de la API del módulo y el tipo de cambio
 * @returns {{
 *   apiBase: string,
 *   loadingRate: boolean,
 *   currentExchangeRate: number,
 *   fetchExchangeRate: () => Promise<void>
 * }}
 */
export function useComprasApi() {
  const [loadingRate, setLoadingRate] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState(0);

  /** @type {string} URL base de la API del módulo */
  const apiBase = useMemo(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/([^/]+)/);
    const moduleName = match ? match[1] : 'compraskrsft';
    return `/api/${moduleName}`;
  }, []);

  /** Obtiene el tipo de cambio USD → PEN desde el backend */
  const fetchExchangeRate = useCallback(async () => {
    setLoadingRate(true);
    try {
      const res = await fetch(`${apiBase}/exchange-rate`);
      const data = await res.json();
      if (data.success) setCurrentExchangeRate(data.rate);
    } catch (e) {
      console.error(e);
    }
    setLoadingRate(false);
  }, [apiBase]);

  return { apiBase, loadingRate, currentExchangeRate, fetchExchangeRate };
}
