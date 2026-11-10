import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
} from '@/lib/searchCache'
import { clearAllCaches, resetBranchCaches, __registeredCacheNames } from '@/lib/cacheRegistry'
import { __resetEpochForTests, setActiveBranchIdForCache } from '@/lib/branch/epoch'
import { idempotencyKeyFor, releaseIdempotencyKey } from '@/utils/idempotencyKey'
import { authService } from '@/services/auth.service'
import { primeCompanyLogo, ensureCompanyLogoForPrint } from '@/lib/companyLogo'
import { dedupePromise } from '@/utils/dedupePromise'
import { __tableSessionOwnersForTests } from '@/hooks/useTableSessionBranchGuard'
import { readTenantScoped, writeTenantScoped } from '@/lib/tenantStorage'

vi.mock('@/lib/tenantBinding/store', () => ({
  getTenantBinding: () => ({ slug: 'acme' }),
  getResolvedTenantApiUrl: () => 'http://x',
}))
vi.mock('@/services/company.service', () => ({
  companyService: { getConfig: vi.fn(async () => ({ logo_url: '' })) },
}))

beforeEach(() => {
  __resetEpochForTests()
  localStorage.clear()
  clearAllCaches()
})

describe('searchCache separa por sucursal', () => {
  it('la misma búsqueda en sucursal 1 y 2 usa claves distintas y no se mezcla', () => {
    setActiveBranchIdForCache(1)
    const k1 = buildSearchCacheKey('ventas', 'pollo', '[]')
    setSearchCache(k1, ['venta de sucursal 1'])

    setActiveBranchIdForCache(2)
    const k2 = buildSearchCacheKey('ventas', 'pollo', '[]')
    expect(k2).not.toBe(k1)
    expect(getSearchCache(k2)).toBeUndefined()

    setActiveBranchIdForCache(1)
    expect(getSearchCache(buildSearchCacheKey('ventas', 'pollo', '[]'))).toEqual(['venta de sucursal 1'])
  })

  it('resetBranchCaches() vacía la caché al cambiar de sucursal', () => {
    setActiveBranchIdForCache(1)
    const k = buildSearchCacheKey('ventas', 'x', '[]')
    setSearchCache(k, 1)
    resetBranchCaches()
    expect(getSearchCache(k)).toBeUndefined()
  })
})

describe('clave de idempotencia incluye sucursal', () => {
  it('el mismo cobro en otra sucursal NO reutiliza la clave', () => {
    const payload = { items: [1, 2], total: 10 }
    setActiveBranchIdForCache(1)
    const a1 = idempotencyKeyFor('pos-checkout', payload)
    expect(idempotencyKeyFor('pos-checkout', payload)).toBe(a1) // reintento: misma clave
    setActiveBranchIdForCache(2)
    const b = idempotencyKeyFor('pos-checkout', payload)
    expect(b).not.toBe(a1)
    releaseIdempotencyKey('pos-checkout')
  })

  it('resetBranchCaches() olvida las claves pendientes', () => {
    setActiveBranchIdForCache(1)
    const k = idempotencyKeyFor('pos-checkout', { a: 1 })
    resetBranchCaches()
    expect(idempotencyKeyFor('pos-checkout', { a: 1 })).not.toBe(k)
  })
})

describe('limpieza de cachés en logout', () => {
  it('authService.logout() ejecuta clearAllCaches(): búsquedas, idempotencia, logo y promesas en vuelo', async () => {
    expect(__registeredCacheNames()).toEqual(
      expect.arrayContaining(['searchCache', 'idempotency', 'companyLogo', 'dedupePromise', 'tableSessionOwners']),
    )
    setActiveBranchIdForCache(1)
    const sk = buildSearchCacheKey('ventas', 'q', '[]')
    setSearchCache(sk, 'datos del usuario anterior')
    const ik = idempotencyKeyFor('pos-checkout', { a: 1 })
    primeCompanyLogo({ logo_data_url: 'data:image/png;base64,AAAA' })
    expect(await ensureCompanyLogoForPrint()).toBe('data:image/png;base64,AAAA')
    void dedupePromise('k', () => new Promise(() => {}))
    __tableSessionOwnersForTests().set(77, 1)

    localStorage.setItem('token', 't')
    localStorage.setItem('refresh_token', 'r')
    authService.logout()

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(getSearchCache(sk)).toBeUndefined()
    expect(__tableSessionOwnersForTests().size).toBe(0)
    expect(idempotencyKeyFor('pos-checkout', { a: 1 })).not.toBe(ik)
    // la promesa colgada de dedupe ya no bloquea una petición nueva con la misma clave
    expect(await dedupePromise('k', async () => 'fresca')).toBe('fresca')
  })
})

describe('almacenamiento por empresa', () => {
  it('la clave lleva el slug y adopta una sola vez la clave antigua sin slug', () => {
    localStorage.setItem('tukichef_logo_print_size_v1', 'grande') // formato antiguo
    expect(readTenantScoped('tukichef_logo_print_size_v1', 'acme')).toBe('grande')
    expect(localStorage.getItem('tukichef_logo_print_size_v1')).toBeNull() // migrada
    // otra empresa en el mismo dispositivo no ve la configuración de acme
    expect(readTenantScoped('tukichef_logo_print_size_v1', 'otra')).toBeNull()
    writeTenantScoped('tukichef_logo_print_size_v1', 'pequeno', 'otra')
    expect(readTenantScoped('tukichef_logo_print_size_v1', 'acme')).toBe('grande')
  })
})
