// Shown the moment a hub link or tab is pressed, while the next screen's figures load.
export default function HubLoading() {
  return (
    <div className="hubload" role="status" aria-live="polite">
      <span className="sr">Loading…</span>
      <div className="hl-bar" />
      <div className="hl-title" />
      <div className="hl-row"><div /><div /><div /></div>
      <div className="hl-block" />
      <div className="hl-block short" />
    </div>
  )
}
