'use client'
// Completion photos on the phone (v67). Each photo is shrunk to ~1600px JPEG and written to IndexedDB the moment it's
// picked, before anything else, so nothing is lost if the signal drops, the app closes or iOS reloads the page.
// A sender then sends one at a time: signed upload link → straight to storage → record the row → only then
// drop the full-size copy (a small thumbnail is kept so the tile can show "Sent ✓").
// Retries back off 2s, 4s, 8s… up to 5 minutes, and start again on `online`, app open and when the app comes back.

export type PhState = 'wait' | 'sent'
export interface QPhoto { id: string; job: string; iso: string; takenAt: string; added: number; state: PhState; buf?: ArrayBuffer; thumb: string; tries: number; nextAt: number }

const DB = 'core-cleaner-photos', STORE = 'photos', MAX_SIDE = 1600, THUMB = 360
let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('job', 'job') }
    r.onsuccess = () => res(r.result)
    r.onerror = () => { dbp = null; rej(r.error) }
  })
  return dbp
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE)
    const rq = fn(s)
    t.oncomplete = () => res(rq ? (rq as IDBRequest<T>).result : undefined)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  }))
}
export const allPhotos = async (): Promise<QPhoto[]> => ((await tx<QPhoto[]>('readonly', s => s.getAll())) || []).sort((a, b) => a.added - b.added)
const put = (p: QPhoto) => tx('readwrite', s => s.put(p))
const del = (id: string) => tx('readwrite', s => s.delete(id))

// ── listeners (the screens re-read on any change) ─────────────
const subs = new Set<() => void>()
export function onPhotos(fn: () => void): () => void { subs.add(fn); return () => { subs.delete(fn) } }
const changed = () => subs.forEach(f => { try { f() } catch { /* a screen that's gone */ } })

function uuid(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : null
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b: Uint8Array = c ? c.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
function loadImg(f: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f), im = new Image()
    im.onload = () => { URL.revokeObjectURL(url); res(im) }
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not an image')) }
    im.src = url
  })
}
function draw(im: HTMLImageElement, side: number, q: number): Promise<Blob | null> {
  const w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, side / Math.max(w, h))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q))
}
const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(''); r.readAsDataURL(b) })

/** Save picked photos for a job. `room` = how many more this clean can take (max 40). */
export async function addPhotos(job: string, iso: string, files: File[], room: number): Promise<{ added: number; skipped: number; over: number }> {
  let added = 0, skipped = 0, over = 0
  for (const f of files) {
    if (!f || (f.type && !f.type.startsWith('image/'))) { skipped++; continue }
    if (added >= room) { over++; continue }
    try {
      const im = await loadImg(f)
      const [big, small] = await Promise.all([draw(im, MAX_SIDE, 0.8), draw(im, THUMB, 0.7)])
      if (!big) { skipped++; continue }
      const p: QPhoto = { id: uuid(), job, iso, takenAt: new Date(f.lastModified || Date.now()).toISOString(), added: Date.now() + added, state: 'wait', buf: await big.arrayBuffer(), thumb: small ? await toDataUrl(small) : '', tries: 0, nextAt: 0 }
      await put(p)
      added++
    } catch { skipped++ }
  }
  if (added) { changed(); kick() }
  return { added, skipped, over }
}

async function post(body: object): Promise<{ status: number; json: any }> {
  const r = await fetch('/cleaner/app/photos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' })
  const ct = r.headers.get('content-type') || ''
  // signed out: the sign-in page comes back instead of JSON
  if (r.redirected || !ct.includes('json')) return { status: 401, json: {} }
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

/** Take a photo out (before Finish). A photo already on the hub is removed there too. */
export async function removePhoto(p: QPhoto): Promise<boolean> {
  if (p.state === 'sent') {
    try { const r = await post({ op: 'remove', key: p.job, id: p.id }); if (r.status !== 200) return false } catch { return false }
  }
  await del(p.id); changed(); return true
}

// ── the sender ────────────────────────────────────────────────
let running = false, timer: ReturnType<typeof setTimeout> | null = null, signedOut = false
export const isSignedOut = () => signedOut
function later(ms: number) { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void pump() }, ms) }
export function kick() { signedOut = false; later(50) }

async function sendOne(p: QPhoto): Promise<'sent' | 'retry' | 'drop' | 'signed_out'> {
  const s = await post({ op: 'sign', key: p.job, id: p.id })
  if (s.status === 401) return 'signed_out'
  if (s.status === 404) return 'drop'
  if (s.status !== 200) return 'retry'
  if (!s.json.already) {
    if (!p.buf) return 'drop'
    const up = await fetch(s.json.url, { method: 'PUT', body: new Blob([p.buf], { type: 'image/jpeg' }), headers: { 'content-type': 'image/jpeg', 'x-upsert': 'true' } })
    if (!up.ok) return 'retry'
  }
  const d = await post({ op: 'done', key: p.job, id: p.id, takenAt: p.takenAt })
  if (d.status === 401) return 'signed_out'
  if (d.status === 404) return 'drop'
  return d.status === 200 ? 'sent' : 'retry'
}

async function pump() {
  if (running) return
  running = true
  try {
    for (;;) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { later(15000); break }
      const list = await allPhotos()
      const now = Date.now()
      const waiting = list.filter(p => p.state === 'wait')
      if (!waiting.length) break
      const next = waiting.find(p => p.nextAt <= now)
      if (!next) { later(Math.max(500, Math.min(...waiting.map(p => p.nextAt)) - now)); break }
      let r: Awaited<ReturnType<typeof sendOne>>
      try { r = await sendOne(next) } catch { r = 'retry' }
      const cur = (await allPhotos()).find(p => p.id === next.id)
      if (!cur) continue // taken out while it was sending
      if (r === 'sent') { await put({ ...cur, state: 'sent', buf: undefined, tries: 0, nextAt: 0 }); changed() }
      else if (r === 'drop') { await del(cur.id); changed() }
      else if (r === 'signed_out') { signedOut = true; changed(); later(60000); break }
      else { const tries = cur.tries + 1; await put({ ...cur, tries, nextAt: Date.now() + Math.min(300000, 1000 * 2 ** tries) }); changed() }
    }
  } finally { running = false }
}

/** Start once per page load: send on open, when back online and when the app comes back to the front. */
let started = false
export function startSender(today: string) {
  if (started || typeof window === 'undefined' || !('indexedDB' in window)) return
  started = true
  try { (navigator as any).storage?.persist?.() } catch { /* not offered */ }
  window.addEventListener('online', () => { changed(); kick() })
  window.addEventListener('offline', () => changed())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick() })
  // tidy: sent photos from before yesterday don't need their thumbnail any more
  void allPhotos().then(async list => {
    const old = list.filter(p => p.state === 'sent' && p.iso < isoMinus(today, 1))
    for (const p of old) await del(p.id)
    if (old.length) changed()
    kick()
  }).catch(() => { /* IndexedDB unavailable (private mode) */ })
}
function isoMinus(iso: string, n: number) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }
