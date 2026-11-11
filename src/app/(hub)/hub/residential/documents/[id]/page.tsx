import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { AgreementBody, AgreementHead } from '@/components/hub/AgreementBody'
import { AgreementAdminBar } from '@/components/hub/AgreementAdminBar'
import { dLong } from '@/lib/hub/home-quotes'
import { loadDoc } from '@/lib/hub/docs-data'
import { AGR_TITLE, docMeta, docTag } from '@/lib/hub/home-agreements'

export const dynamic = 'force-dynamic'

export default async function AgreementPage({ params }: { params: { id: string } }) {
  const r = await loadDoc(params.id)
  const back = <Link className="back" href="/hub/residential/documents"><Back /> Documents</Link>
  if (r === null) return <>{back}<p className="err" role="alert">The agreement couldn’t load just now. Refresh the page to try again.</p></>
  if (r === 'missing') return <>{back}<p className="err" role="alert">That agreement was removed.</p></>
  const { d, email } = r
  const cls = 'agstatus' + (d.status === 'sent' ? ' wait' : d.status === 'signed' ? ' ok' : '')
  return (
    <>
      {back}
      <article className="doc">
        <AgreementHead kicker={d.ref} title={AGR_TITLE} />
        <p className={cls}>{docTag(d)[0]} · {docMeta(d)}</p>
        <AgreementAdminBar id={d.id} ref_={d.ref} code={d.code} status={d.status} email={email} client={d.homeName}
          draftNote={`This draft reads from ${d.homeName}’s page, so any change there shows here. It’s locked in when you send it.`} />
        {d.snap
          ? <AgreementBody ref_={d.ref} snap={d.snap} signedBy={d.signedBy} signedOn={d.signedAt ? dLong(d.signedAt) : ''} />
          : <p className="dp">This client was removed.</p>}
      </article>
    </>
  )
}
