import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { canManageGlobalCatalog, tenantHasPermission } from '@/utils/catalogPermissions'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

const auth = vi.hoisted(() => ({ canManageGlobalCatalog: true }))
const branch = vi.hoisted(() => ({ isAllBranches: false }))
const inventory = vi.hoisted(() => ({ enabled: true }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ canAccess: () => true, canManageGlobalCatalog: auth.canManageGlobalCatalog }),
}))
vi.mock('@/contexts/BranchContext', () => ({
  useBranch: () => ({
    activeBranchId: 1,
    activeBranch: { id: 1, name: 'Sucursal 1' },
    allowedBranches: [],
    canSwitchBranch: false,
    isAllBranches: branch.isAllBranches,
    resetEpoch: 0,
  }),
  useOnBranchChange: () => {},
}))
vi.mock('@/hooks/useInventoryAccess', () => ({ useInventoryAccess: () => inventory.enabled }))

const product = {
  id: 10,
  name: 'Lomo saltado',
  code: 'P-10',
  sale_price: 25,
  active: true,
  manage_stock: true,
  has_modifiers: false,
  category_id: null,
}
vi.mock('@/services/products.service', async (orig) => {
  const actual = await orig<typeof import('@/services/products.service')>()
  return {
    ...actual,
    productsService: {
      ...actual.productsService,
      list: vi.fn(async () => ({ data: [product], total: 1 })),
      getStockSummary: vi.fn(async () => ({ 10: 5 })),
      listCategories: vi.fn(async () => []),
      listUnits: vi.fn(async () => []),
      listPreparationAreas: vi.fn(async () => []),
      listModifierGroups: vi.fn(async () => []),
      nextCode: vi.fn(async () => 'P-11'),
    },
  }
})
vi.mock('@/services/inventory.service', () => ({
  inventoryService: { getStock: vi.fn(async () => []), adjustment: vi.fn() },
}))

import ProductosPage from '@/pages/ProductosPage'

async function renderPage() {
  render(
    <MemoryRouter>
      <ProductosPage />
    </MemoryRouter>,
  )
  await screen.findByText('Lomo saltado')
}

describe('canManageGlobalCatalog (regla de permisos)', () => {
  it('products.manage_global lo concede; products.manage lo implica; products.edit solo NO', () => {
    expect(canManageGlobalCatalog(['products.manage_global'])).toBe(true)
    expect(canManageGlobalCatalog(['products.manage'])).toBe(true)
    expect(canManageGlobalCatalog(['products.edit', 'products.create', 'products.delete', 'inventory.adjust'])).toBe(false)
    expect(canManageGlobalCatalog([])).toBe(false)
    expect(canManageGlobalCatalog(undefined)).toBe(false)
  })
  it('el manage de otro módulo no cuenta', () => {
    expect(tenantHasPermission(['inventory.manage'], 'products.manage_global')).toBe(false)
  })
  it('el POS por PIN no lleva permisos de tenant: su flujo (puente restaurantperm) no se toca', () => {
    expect(canManageGlobalCatalog(undefined, 'pin')).toBe(true)
    expect(canManageGlobalCatalog([], 'pin')).toBe(true)
  })
})

describe('ProductosPage: acciones de catálogo global', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    auth.canManageGlobalCatalog = true
    branch.isAllBranches = false
    inventory.enabled = true
  })

  it('con products.manage_global: ve crear, importar, categorías, combos, editar y eliminar', async () => {
    await renderPage()
    expect(screen.getByText('Agregar producto')).toBeTruthy()
    expect(screen.getByText('Importar')).toBeTruthy()
    expect(screen.getByText('Categorías')).toBeTruthy()
    expect(screen.getByText('Combos')).toBeTruthy()
    expect(screen.getByTitle('Editar')).toBeTruthy()
    expect(screen.getByTitle('Eliminar')).toBeTruthy()
    expect(screen.getAllByTitle('Ajustar inventario').length).toBeGreaterThan(0)
  })

  it('sin products.manage_global: las acciones globales NO se renderizan, pero el ajuste de stock y las áreas siguen', async () => {
    auth.canManageGlobalCatalog = false
    await renderPage()
    expect(screen.queryByText('Agregar producto')).toBeNull()
    expect(screen.queryByText('Importar')).toBeNull()
    expect(screen.queryByText('Categorías')).toBeNull()
    expect(screen.queryByText('Combos')).toBeNull()
    expect(screen.queryByTitle('Editar')).toBeNull()
    expect(screen.queryByTitle('Eliminar')).toBeNull()
    expect(screen.queryByTitle('Desactivar producto')).toBeNull()
    expect(screen.queryByLabelText(/Seleccionar Lomo/)).toBeNull()
    // lo que NO es catálogo global se conserva
    expect(screen.getByText('Áreas')).toBeTruthy()
    expect(screen.getAllByTitle('Ajustar inventario').length).toBeGreaterThan(0)
  })

  it('modo consulta (todas las sucursales): aun con manage_global no hay acciones de escritura ni ajuste de stock', async () => {
    branch.isAllBranches = true
    await renderPage()
    await waitFor(() => expect(screen.queryByText('Agregar producto')).toBeNull())
    expect(screen.queryByText('Importar')).toBeNull()
    expect(screen.queryByText('Categorías')).toBeNull()
    expect(screen.queryByText('Áreas')).toBeNull()
    expect(screen.queryByText('Combos')).toBeNull()
    expect(screen.queryByTitle('Editar')).toBeNull()
    expect(screen.queryByTitle('Eliminar')).toBeNull()
    expect(screen.queryAllByTitle('Ajustar inventario')).toHaveLength(0)
    // la lista se sigue viendo
    expect(screen.getByText('Lomo saltado')).toBeTruthy()
  })
})
