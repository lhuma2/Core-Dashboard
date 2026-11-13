'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Back } from './icons'
import { ShareSheet, useToast } from './ComplianceList'

const ShareIc = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" /></svg>

/** Back link and, from the compliance pack, a Share button for this one document. */
export function DocTop({ back, id }: { back: { href: string; label: string }; id: string | null }) {
  const [open, setOpen] = useState(false)
  const { setToast, el } = useToast()
  return (
    <>
      <div className="doctop">
        <Link className="back" href={back.href}><Back /> {back.label}</Link>
        {id && <button type="button" className="btn log" onClick={() => setOpen(true)}><ShareIc />Share</button>}
      </div>
      {open && id && <div className="docsheet"><ShareSheet ids={[id]} onClose={() => setOpen(false)} onToast={setToast} /></div>}
      {el}
    </>
  )
}
