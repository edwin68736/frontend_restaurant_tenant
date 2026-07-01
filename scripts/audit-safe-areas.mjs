/**
 * Auditoría runtime de Safe Areas (simula Capacitor con insets).
 * Uso: node scripts/audit-safe-areas.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:5175'

const SAFE = { top: 47, bottom: 34, left: 0, right: 0 }

const ROUTES = [
  { path: '/#/ruc', name: 'RUC' },
  { path: '/#/home', name: 'Home' },
  { path: '/#/login', name: 'Login' },
]

const REQUIRED_CLASSES = [
  'fixed-overlay-safe',
  'fixed-overlay-sheet',
  'pt-safe',
  'pb-safe',
  'fab-cart-bottom',
  'max-h-modal-panel',
]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  const cssRes = await fetch(`${BASE}/src/index.css`)
  const cssText = await cssRes.text()
  const missingCss = REQUIRED_CLASSES.filter((c) => !cssText.includes(`.${c}`))
  if (missingCss.length) {
    console.error('CSS utilities missing:', missingCss)
    process.exitCode = 1
  } else {
    console.log('OK CSS utilities present:', REQUIRED_CLASSES.join(', '))
  }

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' })
    await page.evaluate((insets) => {
      const html = document.documentElement
      html.classList.add('platform-capacitor')
      html.style.setProperty('--safe-top', `${insets.top}px`)
      html.style.setProperty('--safe-bottom', `${insets.bottom}px`)
      html.style.setProperty('--safe-left', `${insets.left}px`)
      html.style.setProperty('--safe-right', `${insets.right}px`)
    }, SAFE)

    const rootBox = await page.locator('#root > *').first().boundingBox()
    if (rootBox && rootBox.y < SAFE.top - 2) {
      console.warn(`WARN ${route.name}: content may overlap status bar (y=${rootBox.y})`)
    } else {
      console.log(`OK ${route.name}: root respects top inset`)
    }
  }

  await browser.close()
  console.log('Audit complete.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
