'use client'
/** New password + Type it again, with the three rules ticking off as they type (mock-up words). */
export function PwFields({ p1, p2, setP1, setP2, show, setShow, first }: { p1: string; p2: string; setP1: (v: string) => void; setP2: (v: string) => void; show: boolean; setShow: (f: (s: boolean) => boolean) => void; first: string }) {
  const rules = [
    { ok: p1.length >= 8, text: 'At least 8 characters' },
    { ok: !!p1 && (!first || !p1.toLowerCase().includes(first.toLowerCase())), text: 'Not your first name' },
    { ok: !!p1 && p1 === p2, text: 'Both boxes match' },
  ]
  return (
    <>
      <label className="fld"><span>New password</span>
        <span className="pwrow">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" value={p1} onChange={e => setP1(e.target.value)} />
          <button type="button" className="linkbtn" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>{show ? 'Hide' : 'Show'}</button>
        </span>
      </label>
      <label className="fld"><span>Type it again</span>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" value={p2} onChange={e => setP2(e.target.value)} />
      </label>
      <ul className="rules">
        {rules.map(r => <li key={r.text} className={r.ok ? 'ok' : ''}><span className="dot" aria-hidden="true" />{r.text}<span className="sr">{r.ok ? ' (done)' : ' (not yet)'}</span></li>)}
      </ul>
    </>
  )
}
