// Regenerate all /public logo assets from the two brand source logos.
// Dark logo (dark text) → light-background slots. Light logo (white text) → dark-background slots.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = join(__dirname, '..', 'public')
const SRC = 'C:/Users/leohu/OneDrive/CORE/COMPANY DETAILS'
const DARK = join(SRC, 'Logo Dark.png')   // dark text — for LIGHT backgrounds
const LIGHT = join(SRC, 'Logo Light.png')  // white text — for DARK backgrounds

const p = (f) => join(pub, f)

// Tight wordmark = trim the surrounding transparent padding.
async function wordmark(src, out) {
  await sharp(src).trim().resize({ width: 1200, fit: 'inside', withoutEnlargement: false })
    .png().toFile(out)
}
// Full logo — keep square, just normalize size.
async function fullLogo(src, out, size = 1024) {
  await sharp(src).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(out)
}
// PWA/app icon — trim, then place on a white square with padding (readable on any home screen).
async function appIcon(src, out, size, bg = { r: 255, g: 255, b: 255, alpha: 1 }) {
  const logo = await sharp(src).trim().resize({ width: Math.round(size * 0.78), fit: 'inside' }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: 'center' }]).png().toFile(out)
}
// Transparent favicon from the dark mark.
async function favicon(src, out, size) {
  await sharp(src).trim().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(out)
}

// ── Light-background (dark) slots ──
await fullLogo(DARK, p('logo-black.png'))
await fullLogo(DARK, p('logo-icon-black.png'))
await fullLogo(DARK, p('logo-transparent.png'))
await wordmark(DARK, p('proposal-assets/wordmark-black.png'))
await wordmark(DARK, p('proposal-assets/mark-black.png'))

// ── Dark-background (white) slots ──
await fullLogo(LIGHT, p('logo-white.png'))
await fullLogo(LIGHT, p('logo-mark-white.png'))
await fullLogo(LIGHT, p('transparent white logo.png'))
await wordmark(LIGHT, p('proposal-assets/wordmark-white.png'))
await wordmark(LIGHT, p('proposal-assets/mark-white.png'))

// ── App / PWA icons (composited on white for reliable rendering) ──
await appIcon(DARK, p('icon-192.png'), 192)
await appIcon(DARK, p('icon-512.png'), 512)
await appIcon(DARK, p('apple-touch-icon.png'), 180)
await favicon(DARK, p('favicon.png'), 64)

console.log('[OK] Regenerated all /public logo assets from Core Cleaning source logos.')
