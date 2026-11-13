import '../../app/(hub)/hub/hub.css'

/** The plain page around something we share with people outside the business (no hub menu). */
export function PubShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{children}</main>
    </div>
  )
}
export const BadLink = ({ what }: { what: string }) => (
  <div className="addcard pubdone"><h1 className="nch">This link isn’t valid</h1><p className="nchint">The {what} link may be mistyped or no longer shared. Please contact Core Cleaning on 0407 026 360 or admin@corecleaning.services.</p></div>
)
