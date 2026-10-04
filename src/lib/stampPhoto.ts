/**
 * Burns the current Brisbane date + time into the top-right corner of a photo
 * and returns it as a JPEG File. Runs in the browser (canvas). If the image
 * can't be decoded, the original file is returned unchanged so an upload is
 * never blocked by the stamp.
 */
export async function stampPhoto(file: File, at: Date = new Date()): Promise<File> {
  try {
    const blob = await drawStamp(file, at)
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function drawStamp(file: File, at: Date): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas context'))
      ctx.drawImage(img, 0, 0)

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

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not decode image'))
    }
    img.src = objectUrl
  })
}
