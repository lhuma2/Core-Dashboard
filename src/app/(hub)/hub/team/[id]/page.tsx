import Link from 'next/link'
import { Back, Chev } from '@/components/hub/icons'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PACK_COLS, packDetails } from '@/lib/hub/team-data'
import { PACK_DOCS, starterPw } from '@/lib/hub/team'

export const dynamic = 'force-dynamic'

// The signed onboarding pack for one cleaner (Team → View signed pack). Words from the mock-up.
export default async function SignedPackPage({ params }: { params: { id: string } }) {
  const back = <Link className="back" href="/hub/team"><Back /> Team</Link>
  const none = (t: string) => <>{back}<p className="err" role="alert">{t}</p></>
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return none('That cleaner isn’t on the team any more.')
  const db = createClient() as any
  const [pQ, kQ] = await Promise.all([
    db.from('profiles').select('id, full_name, email, phone').eq('id', params.id).maybeSingle(),
    db.from('cleaner_packs').select(PACK_COLS).eq('profile_id', params.id).maybeSingle(),
  ])
  if (pQ.error) return none('The signed pack couldn’t load just now. Refresh the page to try again.')
  if (!pQ.data) return none('That cleaner isn’t on the team any more.')
  const p = pQ.data, k = kQ.error ? null : kQ.data
  const d = packDetails(k)
  if (!k || !d) return none(`${p.full_name || 'This cleaner'} signed the old onboarding pack, before the new hub, so there’s no copy here.`)
  const name = String(p.full_name || `${k.first_name} ${k.last_name}`).trim()
  const first = k.first_name || name.split(' ')[0]
  let certUrl = ''
  if (k.cert_path) {
    const s = await (createAdminClient() as any).storage.from('clean-photos').createSignedUrl(k.cert_path, 3600)
    certUrl = s.data?.signedUrl || ''
  }
  return (
    <>
      {back}
      <article className="doc">
        <div className="dochead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
          <div><div className="doccode">Signed onboarding pack</div><h1 className="doctitle">{name}</h1></div>
        </div>
        <div className="sigblock">
          <div className="sigline">{d.sig}</div>
          <div className="sigmeta">Signed electronically on {d.date} for {d.company}</div>
        </div>
        <h2 className="dh">Details they gave</h2>
        <ul className="dul">
          <li>Company or trading name: {d.company}</li>
          <li>ABN: {d.abn}</li>
          <li>Contact: {d.contact}</li>
          <li>Email: {p.email || k.email}</li>
          <li>Mobile: {p.phone || d.phone || 'Not given'}</li>
          <li>Public liability: {d.insurer}, policy {d.policy}, expires {d.expiry}</li>
          <li>Certificate of currency: {d.cert ? <>Attached{certUrl && <> · <a href={certUrl} target="_blank" rel="noreferrer">Open it</a></>}</> : 'Not attached'}</li>
        </ul>
        <h2 className="dh">Login email sent to them</h2>
        <div className="mailprev">
          <div className="mailhead"><span>From: admin@corecleaning.services</span><span>To: {p.email || k.email}</span><span>Subject: Your Core Cleaning portal login</span></div>
          <p>Hi {first},</p>
          <p>Thanks for signing the Core Cleaning subcontractor pack. You can now log in to the cleaner portal to see your jobs, checklists and site access details.</p>
          <p className="mailcreds">Website: portal.corecleaning.services<br />Username: {p.email || k.email}<br />Password: {starterPw(first, +String(k.signed_at).slice(0, 4))}</p>
          <p>The first time you log in it will ask you to choose your own password. On iPhone, open the portal in Safari, tap Share, then Add to Home Screen so it works like an app.</p>
          <p>Kind regards,</p>
          <div className="esig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-transparent.png" alt="Core Cleaning" />
            <div><strong>Laith Humadi</strong><span className="esigco">Core Cleaning</span><span>P 0407 026 360 · E admin@corecleaning.services · W www.corecleaning.services</span><span className="esigsub">Residential · Commercial · Bond Cleaning</span></div>
          </div>
        </div>
        <h2 className="dh">Documents covered by this signature</h2>
        <div className="list sharedlist">
          {PACK_DOCS.map(x => (
            <a key={x.code} className="drow" href={x.href || `/pack/${k.token}`} target="_blank" rel="noreferrer"><span className="dcode">{x.code}</span><span className="dtitle">{x.title}</span><Chev /></a>
          ))}
        </div>
      </article>
    </>
  )
}
