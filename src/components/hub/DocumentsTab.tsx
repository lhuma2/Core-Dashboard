'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveRefresh } from '@/lib/hub/use-live'
import { takeFlash } from '@/lib/hub/flash'
import { ProposalList, type PropF } from './ProposalList'
import { AgreementList, type DocF } from './AgreementList'
import type { Prop } from '@/lib/hub/proposals'
import type { DocsData } from '@/lib/hub/documents-data'

export function DocumentsTab({ sec, props, docs, today, propF, docF, docQ }: {
  sec: 'proposals' | 'agreements'; props: Prop[]; docs: DocsData; today: string; propF: PropF; docF: DocF; docQ: string
}) {
  const router = useRouter()
  useLiveRefresh()
  const [s, setS] = useState(sec)
  const [q, setQ] = useState(docQ)
  const [qKey, setQKey] = useState(0)
  const [toast, setToast] = useState('')
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])
  function show(v: 'proposals' | 'agreements') {
    setS(v)
    router.replace(v === 'agreements' ? '/hub/commercial/documents?sec=agreements' : '/hub/commercial/documents', { scroll: false })
  }

  return (
    <>
      <div className="seg2 docseg" role="group" aria-label="Show">
        <button type="button" className={s === 'proposals' ? 'on' : ''} aria-pressed={s === 'proposals'} onClick={() => show('proposals')}>Proposals</button>
        <button type="button" className={s === 'agreements' ? 'on' : ''} aria-pressed={s === 'agreements'} onClick={() => show('agreements')}>Agreements and files</button>
      </div>
      {s === 'proposals'
        ? <ProposalList props={props} initial={propF} onToast={setToast} onAgreements={biz => { setQ(biz); setQKey(k => k + 1); show('agreements') }} />
        : <AgreementList key={qKey} data={docs} today={today} initial={q ? 'all' : docF} initialQuery={q} onToast={setToast} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
