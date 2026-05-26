/** Ancho imprimible en puntos (58 mm ≈ 384, 80 mm ≈ 576). */
export function escposPrintWidthPx(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? 384 : 576
}

function escposLogoMaxWidthPx(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? 280 : 360
}

function escposLogoMaxHeightPx(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? 72 : 96
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

type Bounds = { left: number; top: number; right: number; bottom: number }

/** Recorta márgenes blancos o transparentes alrededor del contenido visible. */
function findContentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  whiteThreshold = 245,
): Bounds | null {
  let top = height
  let bottom = -1
  let left = width
  let right = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]!
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const transparent = a < 20
      const white = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold
      if (transparent || white) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }

  if (bottom < top || right < left) return null
  return { left, top, right, bottom }
}

function toGrayscaleWithLogoDither(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const threshold = 105
  const grayscale = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    grayscale[i / 4] = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const oldPixel = grayscale[idx]!
      const newPixel = oldPixel < threshold ? 0 : 255
      grayscale[idx] = newPixel
      const quantError = oldPixel - newPixel
      const errorFactor = 0.5
      if (x + 1 < width) grayscale[idx + 1]! += (quantError * 7) / 16 * errorFactor
      if (x - 1 >= 0 && y + 1 < height) grayscale[idx + width - 1]! += (quantError * 3) / 16 * errorFactor
      if (y + 1 < height) grayscale[idx + width]! += (quantError * 5) / 16 * errorFactor
      if (x + 1 < width && y + 1 < height) grayscale[idx + width + 1]! += (quantError * 1) / 16 * errorFactor
    }
  }
  return grayscale
}

function trimEmptyRows(grayscale: Uint8Array, width: number, height: number): { gray: Uint8Array; h: number } {
  let top = 0
  let bottom = height - 1
  const rowHasInk = (y: number) => {
    for (let x = 0; x < width; x++) {
      if (grayscale[y * width + x] === 0) return true
    }
    return false
  }
  while (top < height && !rowHasInk(top)) top++
  while (bottom > top && !rowHasInk(bottom)) bottom--
  const h = bottom - top + 1
  if (h <= 0) return { gray: grayscale, h: height }
  const trimmed = new Uint8Array(width * h)
  for (let y = 0; y < h; y++) {
    trimmed.set(grayscale.subarray((top + y) * width, (top + y + 1) * width), y * width)
  }
  return { gray: trimmed, h }
}

function grayscaleToEscPosRaster(grayscale: Uint8Array, width: number, height: number): Uint8Array {
  const bitmapWidthBytes = width / 8
  const xL = bitmapWidthBytes & 0xff
  const xH = (bitmapWidthBytes >> 8) & 0xff
  const yL = height & 0xff
  const yH = (height >> 8) & 0xff
  const headerLen = 8
  const dataLen = bitmapWidthBytes * height
  const out = new Uint8Array(headerLen + dataLen)
  out[0] = 0x1d
  out[1] = 0x76
  out[2] = 0x30
  out[3] = 0
  out[4] = xL
  out[5] = xH
  out[6] = yL
  out[7] = yH
  let offset = headerLen
  for (let i = 0; i < grayscale.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      if (i + j < grayscale.length && grayscale[i + j] === 0) {
        byte |= 1 << (7 - j)
      }
    }
    out[offset++] = byte
  }
  return out
}

/**
 * Logo recortado y centrado por alineación ESC/POS (sin lienzo blanco extra arriba).
 */
export async function buildEscPosLogoRaster(
  logoUrl: string,
  paperWidthMm: 58 | 80,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  const src = String(logoUrl ?? '').trim()
  if (!src) return null

  try {
    const img = await loadImageElement(src)
    const maxW = escposLogoMaxWidthPx(paperWidthMm)
    const maxH = escposLogoMaxHeightPx(paperWidthMm)
    const printW = escposPrintWidthPx(paperWidthMm)

    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height
    if (srcW < 1 || srcH < 1) return null

    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcW
    srcCanvas.height = srcH
    const srcCtx = srcCanvas.getContext('2d')
    if (!srcCtx) return null
    srcCtx.fillStyle = '#ffffff'
    srcCtx.fillRect(0, 0, srcW, srcH)
    srcCtx.drawImage(img, 0, 0)

    const srcData = srcCtx.getImageData(0, 0, srcW, srcH)
    const bounds = findContentBounds(srcData.data, srcW, srcH)
    if (!bounds) return null

    const cropW = bounds.right - bounds.left + 1
    const cropH = bounds.bottom - bounds.top + 1

    const scale = Math.min(maxW / cropW, maxH / cropH, printW / cropW, 1)
    let w = Math.max(8, Math.round(cropW * scale))
    let h = Math.max(8, Math.round(cropH * scale))
    w = Math.ceil(w / 8) * 8

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      srcCanvas,
      bounds.left,
      bounds.top,
      cropW,
      cropH,
      0,
      0,
      w,
      h,
    )

    const imageData = ctx.getImageData(0, 0, w, h)
    let gray = toGrayscaleWithLogoDither(imageData.data, w, h)
    const trimmed = trimEmptyRows(gray, w, h)
    gray = trimmed.gray
    h = trimmed.h
    if (h < 1) return null

    return grayscaleToEscPosRaster(gray, w, h)
  } catch {
    return null
  }
}
