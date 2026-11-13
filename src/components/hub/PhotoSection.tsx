'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { longDate, isoAdd } from '@/lib/hub/timetable'
import type { PhotoDay } from '@/lib/hub/photos-data'

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

/** Client page → Completion photos (or Exit photos): one block per clean, a full-screen viewer with Previous / Next,
 *  arrow keys, Esc and ×, and Save a copy. Mock-up words. */
export function PhotoSection({ days, keep, today, title, failed }: { days: PhotoDay[]; keep: number; today: string; title: string; failed?: boolean }) {
  const [open, setOpen] = useState<{ di: number; pi: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLElement | null>(null)
  const day = open ? days[open.di] : null
  const ph = day && open ? day.photos[open.pi] : null

  const close = useCallback(() => { setOpen(null); setTimeout(() => back.current?.focus(), 0) }, [])
  const step = useCallback((n: number) => setOpen(o => (o && days[o.di] && o.pi + n >= 0 && o.pi + n < days[o.di].photos.length ? { ...o, pi: o.pi + n } : o)), [days])
  useEffect(() => {
    if (!open) return
    box.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <section className="addcard cpcard" aria-label={title} data-testid="photo-section">
      <div className="cpcardh"><h2 className="nch">{title}</h2></div>
      <p className="phkeep">Photos are kept for {keep} days after each clean, then deleted automatically. Use Save a copy on any you want to keep.</p>
      {failed && <p className="err" role="alert">The photos couldn’t load just now. Refresh the page to try again.</p>}
      {!failed && !days.length && <p className="cpnone">No completion photos yet. They appear here under the date of each clean once the cleaner finishes the clean.</p>}
      {days.map((d, di) => {
        const gone = isoAdd(d.iso, keep), left = daysBetween(today, gone), first = d.cleaner.split(/[ ,]/)[0] || 'the cleaner'
        const flag = d.ack && d.photos.length + d.pending < d.need
          ? `${first} ticked that all ${d.need}+ exit photos are saved in their phone’s library because some wouldn’t upload. ${d.photos.length} arrived here. Ask ${first} to send the rest if the agent or tenant needs them.`
          : d.pending > 0 ? `${d.pending} ${d.pending === 1 ? 'photo is' : 'photos are'} still on ${first}’s phone. They send by themselves next time the phone has signal, nothing for either of you to do.` : ''
        return (
          <div className="phday" key={d.jobId} data-testid="photo-day">
            <h3 className="phdh">{longDate(d.iso) + (d.iso === today ? ' (today)' : '')}</h3>
            <p className="phsub">{[d.cleaner, d.photos.length + (d.photos.length === 1 ? ' photo' : ' photos'), d.finished ? 'finished ' + d.finished : ''].filter(Boolean).join(' · ')}</p>
            <p className="phexp">Deleted automatically on {longDate(gone)}{left <= 1 ? ' (tomorrow)' : ` (in ${left} days)`}</p>
            {flag && <p className="agstatus wait phflag" data-testid="photo-flag">{flag}</p>}
            {d.photos.length > 0 && (
              <div className="phgrid">
                {d.photos.map((p, pi) => (
                  <button type="button" key={p.id} className="phthumb" aria-label={`Open photo: ${p.label}, ${longDate(d.iso)}`}
                    onClick={e => { back.current = e.currentTarget; setOpen({ di, pi }) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" /><span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {day && ph && open && (
        <div className="phlb" role="dialog" aria-modal="true" aria-label="Photo" tabIndex={-1} ref={box} data-testid="lightbox"
          onKeyDown={e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1) }}>
          <div className="phlbtop">
            <span><strong>{ph.label}</strong><span>{longDate(day.iso) + (day.cleaner ? ' · ' + day.cleaner : '')} · {open.pi + 1} of {day.photos.length}</span></span>
            <button type="button" className="phlbx" onClick={close} aria-label="Close photo">×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="phlbimg" src={ph.url} alt={ph.label} />
          <div className="phlbnav">
            <a className="phlbsave" href={ph.save} download>Save a copy</a>
            {open.pi > 0 && <button type="button" className="btn log" onClick={() => step(-1)}>Previous</button>}
            {open.pi < day.photos.length - 1 && <button type="button" className="btn log" onClick={() => step(1)}>Next</button>}
          </div>
        </div>
      )}
    </section>
  )
}
