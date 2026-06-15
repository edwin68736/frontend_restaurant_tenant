import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { isCapacitorAndroid } from '@/lib/platform/detect'
import { pdfEmbedSrc } from '@/utils/pdfEmbedSrc'

type Props = {
  url: string
  title?: string
  className?: string
}

/**
 * WebView de Android no muestra PDF en iframe con blob: — se rasteriza con pdf.js.
 * En escritorio/navegador se usa el visor nativo del iframe.
 */
export function PdfBlobViewer({ url, title = 'Comprobante PDF', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const useCanvas = isCapacitorAndroid()
  const [loading, setLoading] = useState(useCanvas)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!useCanvas || !url) return

    let cancelled = false
    setLoading(true)
    setError(false)

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        const response = await fetch(url)
        const buffer = await response.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
        const container = containerRef.current
        if (!container || cancelled) return

        container.replaceChildren()

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum)
          const baseViewport = page.getViewport({ scale: 1 })
          const maxWidth = Math.min(container.clientWidth || 360, 480)
          const scale = Math.max(1.2, maxWidth / baseViewport.width)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.className = 'mx-auto mb-3 max-w-full h-auto bg-white shadow-sm rounded'

          await page.render({ canvasContext: ctx, viewport }).promise
          if (cancelled) return
          container.appendChild(canvas)
        }
      } catch (e) {
        console.error('[PdfBlobViewer]', e)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url, useCanvas])

  if (!useCanvas) {
    return (
      <iframe
        src={pdfEmbedSrc(url)}
        title={title}
        className={className ?? 'h-[min(70vh,520px)] min-h-[320px] w-full border-0 bg-white'}
      />
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 p-6 text-center md:min-h-[360px]">
        <p className="text-sm font-medium text-stone-700">No se pudo mostrar el PDF en Android.</p>
        <p className="text-xs text-stone-500">Use Descargar o Compartir para abrir el comprobante.</p>
      </div>
    )
  }

  return (
    <div className="relative bg-stone-100 p-2">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-100/90">
          <Loader2 className="h-8 w-8 animate-spin text-rest-600" />
        </div>
      )}
      <div
        ref={containerRef}
        className={`overflow-y-auto ${className ?? 'max-h-[min(70vh,520px)] min-h-[320px]'}`}
      />
    </div>
  )
}
