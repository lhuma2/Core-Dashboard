'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SV_Q, svMissing } from '@/lib/hub/surveys'
import { answerSurvey } from '@/actions/survey-answer'

const OFFLINE = 'That didn’t go through. Check your connection and try again.'

/** The survey the client fills in: five 1 to 10 ratings and a notes box (mock-up survey page). `token` sends it for
 *  real; `previewBack` is the hub's read-only preview, which saves nothing and goes back to that list. */
export function SurveyForm({ client, first, token, previewBack }: { client: string; first: string; token?: string; previewBack?: string }) {
  const router = useRouter()
  const [ans, setAns] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (done) return (
    <div className="addcard pubdone" role="status">
      <h1 className="nch">{first === 'there' ? 'Thank you' : `Thanks, ${first}`}</h1>
      <p className="nchint">We’ve got your answers. If anything needs sorting before your next clean, call Laith on 0407 026 360.</p>
    </div>
  )

  async function send() {
    if (busy) return
    const miss = svMissing(ans)
    if (miss.length) { setErr('Rate all 5 before sending. Still to do: ' + miss.join(', ') + '.'); return }
    if (previewBack) { router.push(previewBack); return }
    setBusy(true)
    try {
      const r = await answerSurvey(token || '', ans, notes)
      if (!r.ok) { setErr(r.error); return }
      setDone(true); window.scrollTo(0, 0)
    } catch { setErr(OFFLINE) } finally { setBusy(false) }
  }

  return (
    <article className="doc svdoc">
      <div className="dochead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
        <div><div className="doccode">Client survey</div><h1 className="doctitle">{client}</h1></div>
      </div>
      <h2 className="svhi">Hi {first}, how are we going?</h2>
      <p className="dp">It takes about 2 minutes. Rate each one from 1 (poor) to 10 (excellent), then add anything else you’d like us to know.</p>
      {SV_Q.map((q, qi) => {
        const v = ans[q.k] || 0
        return (
          <section className="svqcard" key={q.k}>
            <p className="svqlabel"><span className="svqn">{qi + 1}</span>{q.label} <span className="req" aria-hidden="true">*</span></p>
            <p className="svqtext">{q.q}</p>
            <div className="svbtns" role="radiogroup" aria-label={q.label + ', rate 1 to 10'}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                const on = v === n
                return <button key={n} type="button" role="radio" aria-checked={on} aria-label={`${q.label} ${n} out of 10`}
                  className={on ? 'svb on ' + (n <= 6 ? 'lo' : n <= 8 ? 'md' : 'hi') : 'svb'}
                  onClick={() => { setAns(a => ({ ...a, [q.k]: n })); setErr('') }}>{n}</button>
              })}
            </div>
            <div className="svends"><span>1 Poor</span><span>10 Excellent</span></div>
          </section>
        )
      })}
      <label className="fld svnotes"><span>Anything else you’d like us to know? (optional)</span>
        <textarea rows={4} maxLength={1000} placeholder="Something we could do better, or someone who did a great job." value={notes} onChange={e => setNotes(e.target.value.slice(0, 1000))} />
      </label>
      <p className="cpnote">{1000 - notes.length} characters left</p>
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="button" className="btn call svsend" disabled={busy} onClick={send}>{busy ? 'Sending…' : previewBack ? 'Send my answers (preview)' : 'Send my answers'}</button>
    </article>
  )
}
