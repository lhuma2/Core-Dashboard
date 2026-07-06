// Regenerate iOS launch splash screens: Core Cleaning white logo centered on
// the brand forest green, at every device size referenced in app/layout.tsx.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'splash')
const LOGO = 'C:/Users/leohu/OneDrive/CORE/COMPANY DETAILS/Logo Light.png' // white text + green arrow
const BG = { r: 0, g: 51, b: 20, alpha: 1 } // #003314 forest green

const sizes = [
  [1320,2868],[1290,2796],[1206,2622],[1179,2556],[1284,2778],
  [1170,2532],[1125,2436],[1242,2688],[828,1792],[1242,2208],[750,1334],
]

// Pre-trim the logo once
const logoTrimmed = await sharp(LOGO).trim().png().toBuffer()
const meta = await sharp(logoTrimmed).metadata()
const aspect = meta.width / meta.height

for (const [w, h] of sizes) {
  const logoW = Math.round(w * 0.5)
  const logoH = Math.round(logoW / aspect)
  const logo = await sharp(logoTrimmed).resize(logoW, logoH, { fit: 'inside' }).png().toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(outDir, `apple-splash-${w}-${h}.png`))
  console.log(`splash ${w}x${h}`)
}
console.log('\n[OK] Regenerated all iOS splash screens with the Core Cleaning logo.')
