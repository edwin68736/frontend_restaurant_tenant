import type { PrintData } from '@/types/printData'
import { generateReceiptPdf, type ReceiptPdfOptions } from '@/utils/receiptPdf'
import { configuredTicketPaperMm, normalizeTicketPaperWidth } from '@/utils/receiptTicketPaper'

/**
 * Ancho realmente imprimible del rollo: las térmicas no imprimen el papel de borde a borde
 * (80 mm → ~72 mm, 58 mm → ~50 mm). Dibujar a 100% del papel hacía que la impresora recortara el
 * lado derecho (TOTAL, importes) y obligaba a bajar la escala a 90% a mano.
 */
const PRINTABLE_MM: Record<number, number> = { 80: 72, 58: 50 }

/**
 * Imprime el ticket con una hoja del tamaño EXACTO del rollo (58 u 80 mm de ancho y el alto del
 * contenido), en vez de dejar que el visor de PDF lo escale a la hoja que tenga la impresora (A4
 * por defecto, con el ticket diminuto arriba). El PDF se rasteriza a ~300 dpi y se imprime como
 * imagen con `@page { size: <ancho>mm <alto>mm; margin: 0 }`, que Chromium (navegador, WebView2 de
 * Tauri) respeta como tamaño de papel.
 */
export async function printTicketAsPage(data: PrintData, options?: ReceiptPdfOptions): Promise<void> {
  const paperMm = normalizeTicketPaperWidth(options?.paperWidthMm ?? configuredTicketPaperMm())
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const doc = await generateReceiptPdf(data, 'ticket', { ...options, paperWidthMm: paperMm })
  const pdfData = new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
  const pdf = await pdfjs.getDocument({ data: pdfData }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = ((paperMm / 25.4) * 300) / base.width // ~300 dpi
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el ticket para imprimir')
  await page.render({ canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen del ticket'))), 'image/png')
  })
  const imgUrl = URL.createObjectURL(blob)
  // Un pelo menos de alto evita que el redondeo genere una segunda hoja casi en blanco.
  const printMm = PRINTABLE_MM[paperMm] ?? paperMm
  const heightMm = Math.floor((canvas.height / canvas.width) * printMm * 10) / 10

  try {
    await new Promise<void>((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
      iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>
@page { size: ${paperMm}mm ${heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; width: ${paperMm}mm; background: #fff; overflow: hidden; }
img { display: block; width: ${printMm}mm; height: ${heightMm}mm; }
</style></head><body><img src="${imgUrl}" alt=""></body></html>`

      let settled = false
      const finish = (err?: Error) => {
        if (settled) return
        settled = true
        window.setTimeout(() => iframe.remove(), 2_000)
        if (err) reject(err)
        else resolve()
      }

      iframe.onload = () => {
        void (async () => {
          try {
            const win = iframe.contentWindow
            if (!win) {
              finish(new Error('No se pudo abrir el visor de impresión'))
              return
            }
            const image = win.document.querySelector('img')
            if (image && !image.complete) {
              await new Promise<void>((r) => {
                image.onload = () => r()
                image.onerror = () => r()
              })
            }
            win.focus()
            win.print()
            // Se espera a que el usuario cierre el diálogo (o a un tope) antes de limpiar.
            await new Promise<void>((r) => {
              const done = () => r()
              win.addEventListener('afterprint', done, { once: true })
              window.setTimeout(done, 90_000)
              window.setTimeout(done, 4_000)
            })
            finish()
          } catch (e) {
            finish(e instanceof Error ? e : new Error(String(e)))
          }
        })()
      }
      iframe.onerror = () => finish(new Error('No se pudo cargar el ticket para imprimir'))
      document.body.appendChild(iframe)
    })
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(imgUrl), 5_000)
  }
}
