/**
 * Burns the current Brisbane date + time into the top-right corner of a photo
 * and returns it as a JPEG File, scaled down so its longest side is at most
 * MAX_EDGE px. Phone photos straight off the camera are 3–8 MB, which is over
 * what the upload accepts, and very large ones are too big for iOS to draw. Runs in the browser (canvas). If the image
 * can't be decoded, the original file is returned unchanged so an upload is
 * never blocked by the stamp.
 */
// 1600px keeps every detail and the stamp readable at roughly half the bytes
// of 2048px, which matters when a deep clean uploads 30-40 photos on 4G.
const MAX_EDGE = 1600
const THUMB_EDGE = 240
const SMALL_ENOUGH = 1.5 * 1024 * 1024

export async function stampPhoto(file: File, at: Date = new Date()): Promise<File> {
  return (await stampPhotoWithThumb(file, at)).file
}

/**
 * Same as stampPhoto, plus a small preview for the on-screen grid. Showing
 * 30-40 full-size photos as thumbnails can use enough memory for iOS Safari
 * to reload the page mid-job. `thumb` is null if no preview could be made;
 * fall back to the photo itself.
 */
export async function stampPhotoWithThumb(file: File, at: Date = new Date()): Promise<{ file: File; thumb: Blob | null }> {
  try {
    const { blob, thumb } = await drawStamp(file, at)
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return { file: new File([blob], name, { type: 'image/jpeg' }), thumb }
  } catch {
    return { file, thumb: null }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

// iOS caps the total memory all canvases can hold; shrinking a finished
// canvas to nothing releases its pixels straight away instead of at GC.
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function drawStamp(file: File, at: Date): Promise<{ blob: Blob; thumb: Blob | null }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width  = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas context'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const stamp = at.toLocaleString('en-AU', {
        timeZone: 'Australia/Brisbane',
        day:      '2-digit',
        month:    '2-digit',
        year:     'numeric',
        hour:     '2-digit',
        minute:   '2-digit',
        second:   '2-digit',
        hour12:   false,
      }) + ' AEST'

      const fontSize = Math.max(20, Math.round(Math.min(canvas.width, canvas.height) * 0.04))
      const padding  = Math.round(fontSize * 0.6)

      ctx.font         = `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'

      const textW = ctx.measureText(stamp).width
      const boxW  = textW + padding * 2
      const boxH  = fontSize + padding * 1.4
      const boxX  = canvas.width - boxW - padding
      const boxY  = padding

      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, fontSize * 0.35)
      else ctx.rect(boxX, boxY, boxW, boxH)
      ctx.fill()

      ctx.fillStyle   = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur  = 3
      ctx.fillText(stamp, boxX + boxW - padding, boxY + boxH / 2)

      ;(async () => {
        const blob = await toJpeg(canvas, 0.85)
        if (!blob) { release(canvas); return reject(new Error('Canvas toBlob failed')) }
        let thumb: Blob | null = null
        const t = document.createElement('canvas')
        const ts = Math.min(1, THUMB_EDGE / Math.max(canvas.width, canvas.height))
        t.width = Math.max(1, Math.round(canvas.width * ts))
        t.height = Math.max(1, Math.round(canvas.height * ts))
        const tctx = t.getContext('2d')
        if (tctx) {
          tctx.drawImage(canvas, 0, 0, t.width, t.height)
          thumb = await toJpeg(t, 0.7)
        }
        release(t)
        release(canvas)
        resolve({ blob, thumb })
      })().catch(reject)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not decode image'))
    }
    img.src = objectUrl
  })
}

/**
 * Re-encodes an already-stamped photo smaller (longest side MAX_EDGE px) without
 * stamping it again. Used for photos queued offline before photos were shrunk.
 * Returns the original if it's already small or can't be decoded.
 */
export async function shrinkPhoto(file: File | Blob, name = 'photo.jpg'): Promise<File> {
  const asFile = file instanceof File ? file : new File([file], name, { type: file.type || 'image/jpeg' })
  if (asFile.size <= SMALL_ENOUGH) return asFile
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const img = document.createElement('img')
      const url = URL.createObjectURL(asFile)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('No canvas context'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((b) => { release(canvas); b ? resolve(b) : reject(new Error('Canvas toBlob failed')) }, 'image/jpeg', 0.8)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')) }
      img.src = url
    })
    return new File([blob], asFile.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return asFile
  }
}
