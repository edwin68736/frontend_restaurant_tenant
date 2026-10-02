import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ImageIcon } from 'lucide-react'
import {
  LOGO_PRINT_SIZE_OPTIONS,
  TICKET_LOGO_BOX_MM,
  readLogoPrintSize,
  saveLogoPrintSize,
  ticketLogoBoxMm,
  type LogoPrintSize,
} from '@/services/printers/logoPrintSize'
import { clearEscPosImageRasterCache } from '@/utils/escposRasterImage'
import { ensureCompanyLogoForPrint } from '@/lib/companyLogo'

/** Escala de la vista previa: 3 px por mm (80 mm = 240 px, 58 mm = 174 px). */
const PREVIEW_PX_PER_MM = 3
const PREVIEW_PAPERS: { mm: 58 | 80; label: string }[] = [
  { mm: 80, label: 'Ticket 80 mm' },
  { mm: 58, label: 'Ticket 58 mm' },
]

/**
 * Logo sobre papel de 80 mm y de 58 mm a la misma escala. Ambos usan el mismo cuadro en mm, así
 * que el logo mide lo mismo en los dos y solo cambia el papel que lo rodea.
 */
function LogoPaperPreview({ size, logo }: { size: LogoPrintSize; logo: string | null }) {
  const box = ticketLogoBoxMm(size)
  const boxW = box.w * PREVIEW_PX_PER_MM
  const boxH = box.h * PREVIEW_PX_PER_MM
  return (
    <div className="flex flex-wrap items-start gap-4">
      {PREVIEW_PAPERS.map((p) => (
        <div key={p.mm} className="flex flex-col items-center gap-1.5">
          <div
            className="flex justify-center bg-white px-0 py-3 shadow ring-1 ring-black/10"
            style={{ width: p.mm * PREVIEW_PX_PER_MM }}
          >
            <div
              className="flex items-center justify-center rounded-sm border border-dashed border-stone-300"
              style={{ width: boxW, height: boxH }}
            >
              {logo ? (
                <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="px-1 text-center text-[10px] text-stone-400">Sin logo cargado</span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-medium text-stone-600">{p.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Tamaño del logo en comprobantes: aplica al PDF y a la impresión térmica. */
export function LogoPrintSizeSettings() {
  const [size, setSize] = useState<LogoPrintSize>(() => readLogoPrintSize())
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ensureCompanyLogoForPrint()
      .then((l) => alive && setLogo(l))
      .catch(() => alive && setLogo(null))
    return () => {
      alive = false
    }
  }, [])

  const change = (value: LogoPrintSize) => {
    setSize(value)
    saveLogoPrintSize(value)
    // El raster del logo se cachea por tamaño: al cambiarlo hay que rehacerlo.
    clearEscPosImageRasterCache()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-stone-100 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rest-50 text-rest-700">
          <ImageIcon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-stone-900">Tamaño del logo</h2>
          <p className="mt-1 text-xs text-stone-500">
            Aplica al comprobante en PDF y a la impresión térmica, con la misma medida en ticket de
            80 mm y de 58 mm. Si el logo se ve borroso en «Grande», suba una imagen de mayor
            resolución.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-5 py-4">
        {LOGO_PRINT_SIZE_OPTIONS.map((opt) => {
          const active = size === opt.value
          const b = TICKET_LOGO_BOX_MM[opt.value]
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => change(opt.value)}
              className={clsx(
                'rounded-lg border-2 px-3 py-2 text-left transition',
                active
                  ? 'border-rest-500 bg-rest-500 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-rest-300',
              )}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className={clsx('block text-[11px]', active ? 'text-rest-50' : 'text-stone-500')}>
                {opt.hint}
              </span>
              <span className={clsx('block text-[11px] font-mono', active ? 'text-rest-50' : 'text-stone-400')}>
                hasta {b.w}×{b.h} mm
              </span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-stone-100 bg-stone-50 px-5 py-4">
        <p className="mb-3 text-xs font-medium text-stone-600">
          Vista previa a escala (el recuadro punteado es el máximo; el logo conserva su proporción)
        </p>
        <LogoPaperPreview size={size} logo={logo} />
      </div>
    </section>
  )
}
