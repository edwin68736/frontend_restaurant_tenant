/**
 * Sincroniza la versión de Tukichef desde tukichef.version.json hacia:
 * - package.json
 * - src-tauri/Cargo.toml
 * - src-tauri/tauri.conf.json (mainBinaryName → tukichef-{version})
 * - android/app/build.gradle (versionName, versionCode)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'tukichef.version.json')

function readManifest() {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const version = String(raw.version ?? '').trim()
  const slug = String(raw.slug ?? 'tukichef').trim() || 'tukichef'
  const versionCode = Number(raw.versionCode)
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`Versión inválida en tukichef.version.json: "${version}"`)
  }
  if (!Number.isFinite(versionCode) || versionCode < 1) {
    throw new Error(`versionCode inválido en tukichef.version.json: ${raw.versionCode}`)
  }
  return { ...raw, version, slug, versionCode }
}

function syncPackageJson(manifest) {
  const path = join(ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = manifest.version
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

function syncCargoToml(manifest) {
  const path = join(ROOT, 'src-tauri', 'Cargo.toml')
  let text = readFileSync(path, 'utf8')
  text = text.replace(/^version\s*=\s*".*"$/m, `version = "${manifest.version}"`)
  writeFileSync(path, text, 'utf8')
}

function syncTauriConf(manifest) {
  const path = join(ROOT, 'src-tauri', 'tauri.conf.json')
  const conf = JSON.parse(readFileSync(path, 'utf8'))
  conf.version = '../package.json'
  conf.mainBinaryName = `${manifest.slug}-${manifest.version}`
  writeFileSync(path, `${JSON.stringify(conf, null, 2)}\n`, 'utf8')
}

function syncAndroidGradle(manifest) {
  const path = join(ROOT, 'android', 'app', 'build.gradle')
  let text = readFileSync(path, 'utf8')
  text = text.replace(/versionCode\s+\d+/, `versionCode ${manifest.versionCode}`)
  text = text.replace(/versionName\s+"[^"]*"/, `versionName "${manifest.version}"`)
  writeFileSync(path, text, 'utf8')
}

const manifest = readManifest()
syncPackageJson(manifest)
syncCargoToml(manifest)
syncTauriConf(manifest)
syncAndroidGradle(manifest)

console.log(
  `[tukichef] Versión sincronizada: ${manifest.version} (code ${manifest.versionCode}) → exe ${manifest.slug}-${manifest.version}.exe`,
)
