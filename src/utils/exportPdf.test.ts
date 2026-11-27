import { describe, expect, it, vi } from 'vitest'
import type { jsPDF } from 'jspdf'
import { exportTableToPdf } from './exportPdf'

let pdf = ''
vi.mock('@/utils/downloadBlob', () => ({
  downloadJsPdf: async (doc: jsPDF) => {
    pdf = doc.output()
  },
}))

const rows = [{ name: 'Hamburguesa doble con queso' }]
const filler = Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }))

describe('exportTableToPdf', () => {
  it('con wrap el nombre largo sale completo', async () => {
    await exportTableToPdf('t', [{ key: 'name', label: 'Plato', wrap: true }, ...filler], rows)
    expect(pdf).toContain('queso')
  })

  it('sin wrap se sigue cortando a la primera línea', async () => {
    await exportTableToPdf('t', [{ key: 'name', label: 'Plato' }, ...filler], rows)
    expect(pdf).toContain('Hamburguesa')
    expect(pdf).not.toContain('queso')
  })
})
