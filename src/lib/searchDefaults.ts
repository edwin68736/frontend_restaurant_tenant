/** Debounce por defecto: 900ms (rango recomendado 700–1200ms). */
export const SEARCH_DEBOUNCE_MS = 900

/** Mínimo de caracteres para disparar búsqueda con texto (vacío = listar todo). */
export const SEARCH_MIN_LENGTH = 2

/** TTL de caché temporal de resultados en frontend (segundos). */
export const SEARCH_CACHE_TTL_MS = 45_000

/** Intervalo mínimo entre peticiones consecutivas (anti-spam al pegar/borrar). */
export const SEARCH_MIN_REQUEST_INTERVAL_MS = 150
