import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ canAccess: () => true, restaurantPermissions: [], employeeType: 'admin' }),
}))
vi.mock('@/hooks/useTenantDisplay', () => ({ useTenantDisplay: () => ({ title: 'Demo', ruc: '1' }) }))
vi.mock('@/utils/restaurantPermissions', () => ({ canAccessAppSettings: () => true }))
vi.mock('./SidebarTutorialsLink', () => ({ default: () => null }))
vi.mock('./SubscriptionSidebarCard', () => ({ default: () => null }))

import RestaurantSidebar from './RestaurantSidebar'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const renderMini = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <RestaurantSidebar onClose={() => {}} embedded collapsed />
    </MemoryRouter>,
  )

describe('RestaurantSidebar en modo mini', () => {
  it('al pasar el mouse por un icono muestra el nombre de la sección y sus accesos', () => {
    renderMini()
    const icons = screen.getAllByRole('link')
    // Ningún texto visible mientras no hay hover: es solo iconos.
    expect(document.body.textContent).not.toContain('Impresoras y ajustes')

    fireEvent.mouseEnter(icons[0])
    const card = document.body.querySelector('.fixed.z-50')
    expect(card).not.toBeNull()
    // El flotante lista accesos navegables (enlaces) con su nombre.
    expect(card!.querySelectorAll('a').length).toBeGreaterThan(0)
    expect(card!.textContent!.trim().length).toBeGreaterThan(0)
  })

  it('se cierra al sacar el mouse, pero con una espera para poder llegar al flotante', () => {
    vi.useFakeTimers()
    renderMini()
    const icon = screen.getAllByRole('link')[0]
    fireEvent.mouseEnter(icon)
    expect(document.body.querySelector('.fixed.z-50')).not.toBeNull()

    fireEvent.mouseLeave(icon)
    // Aún abierto justo después de salir (el mouse puede estar viajando hacia el flotante).
    expect(document.body.querySelector('.fixed.z-50')).not.toBeNull()

    // Entrar al flotante cancela el cierre.
    fireEvent.mouseEnter(document.body.querySelector('.fixed.z-50')!)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(document.body.querySelector('.fixed.z-50')).not.toBeNull()

    // Al salir del flotante sí se cierra.
    fireEvent.mouseLeave(document.body.querySelector('.fixed.z-50')!)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(document.body.querySelector('.fixed.z-50')).toBeNull()
  })

  it('el botón de ajustes también muestra su nombre', () => {
    renderMini()
    const settings = screen.getByLabelText('Impresoras y ajustes')
    fireEvent.mouseEnter(settings)
    expect(document.body.textContent).toContain('Impresoras y ajustes')
    expect(document.body.textContent).toContain('Equipo')
  })
})
