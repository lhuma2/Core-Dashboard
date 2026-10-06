export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { portalLoginFor } from '@/lib/documents/agreement-client'
import { APP_URL } from '@/lib/documents/sign-code'
import { CalendarDays, MapPin, Repeat, LogIn, Mail, Phone, CheckCircle2, ShieldCheck, MessageSquare, ClipboardList } from 'lucide-react'

// The commercial client's welcome page, sent from their profile once the owner
// has set their portal login. Residential / end-of-lease clients never get one.
export default async function WelcomePage({ params }: { params: { code: string } }) {
  const db = createAdminClient() as any
  const { data: client } = await db.from('clients')
    .select('id, business_name, contact_name, start_date')
    .eq('welcome_code', params.code).maybeSingle()

  if (!client) {
    return (
      <div className="min-h-[100dvh] bg-[#00250e] flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-xl font-bold mb-2">This welcome link isn&apos;t valid</h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">Please contact Core Cleaning and we&apos;ll send you a fresh one.</p>
        </div>
      </div>
    )
  }

  const [{ data: agr }, login] = await Promise.all([
    db.from('proposal_documents').select('data')
      .eq('client_id', client.id).eq('kind', 'agreement').eq('status', 'signed')
      .order('signed_at', { ascending: false }).limit(1).maybeSingle(),
    portalLoginFor(db, client.id),
  ])
  const a = agr?.data ? withAgreementDefaults(agr.data) : null
  const start = a?.commencementDate
    || (client.start_date ? new Date(client.start_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
  const first = (login?.name || client.contact_name || '').trim().split(' ')[0]
  const loginUrl = `${APP_URL}/client/login`
  const contact = withAgreementDefaults(a ?? {})

  const card = 'bg-white rounded-2xl border border-gray-200/70 shadow-sm p-5 sm:p-6'
  const label = 'text-[11px] font-bold tracking-[0.14em] uppercase text-gray-400'

  return (
    <div className="min-h-[100dvh] bg-[#f4f6f5]">
      <header className="bg-[#00250e] px-5 pt-10 pb-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proposal-assets/wordmark-white.png" alt="Core Cleaning" className="h-6 w-auto mx-auto mb-6 opacity-95" />
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-emerald-300 mb-2">Welcome aboard</p>
        <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight max-w-lg mx-auto">
          {first ? `${first}, welcome` : 'Welcome'} to Core Cleaning
        </h1>
        <p className="text-slate-300 text-sm mt-3 max-w-md mx-auto">
          {client.business_name} is all set up. Here&apos;s everything you need to know to get started.
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-10 pb-12 space-y-4">
        {(start || a?.premises || a?.frequency) && (
          <section className={card}>
            <p className={label}>Your service</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {start && <Fact icon={CalendarDays} title="First clean" value={start} />}
              {a?.frequency && <Fact icon={Repeat} title="Frequency" value={a.frequency} />}
              {a?.premises && <Fact icon={MapPin} title="Site" value={a.premises} />}
            </div>
          </section>
        )}

        <section className={card}>
          <p className={label}>Your client portal</p>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Your portal is where you see your upcoming cleans and keep in touch with us.
          </p>
          <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-sm">
            <Row k="Portal" v={<a href={loginUrl} className="font-semibold text-[#00250e] underline underline-offset-2 break-all">{loginUrl.replace('https://', '')}</a>} />
            <Row k="Login email" v={<span className="font-semibold text-gray-900 break-all">{login?.email ?? 'Sent separately'}</span>} />
            <Row k="Password" v={<span className="text-gray-700">In your welcome email</span>} />
          </div>
          <a href={loginUrl}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#00250e] text-white text-[15px] font-bold rounded-xl py-3.5 active:scale-[0.99] transition-transform">
            <LogIn className="w-4 h-4" /> Log in to your portal
          </a>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 text-sm text-gray-700">
            <Feature icon={CalendarDays} text="See your upcoming and completed cleans" />
            <Feature icon={ClipboardList} text="Request extra services" />
            <Feature icon={ShieldCheck} text="Download our insurance and compliance documents" />
            <Feature icon={MessageSquare} text="Report an issue or send us a message" />
          </ul>
        </section>

        <section className={card}>
          <p className={label}>Your contact</p>
          <p className="text-base font-semibold text-gray-900 mt-2">{contact.contactName}{contact.contactRole ? <span className="text-gray-400 font-normal"> · {contact.contactRole}</span> : null}</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <a href={`tel:${contact.contactPhone.replace(/\s/g, '')}`} className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              <Phone className="w-4 h-4" /> {contact.contactPhone}
            </a>
            <a href={`mailto:${contact.contactEmail}`} className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 break-all">
              <Mail className="w-4 h-4" /> {contact.contactEmail}
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400 pt-2 inline-flex items-center justify-center gap-1.5 w-full">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Thanks for choosing Core Cleaning.
        </p>
      </main>
    </div>
  )
}

function Fact({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3">
      <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {title}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1 leading-snug">{value}</p>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-gray-400 flex-shrink-0">{k}</span>
      <span className="text-right min-w-0">{v}</span>
    </div>
  )
}

function Feature({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-[#00250e] mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}
