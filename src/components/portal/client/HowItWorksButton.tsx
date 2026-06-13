'use client'

export function HowItWorksButton() {
  function open() {
    window.dispatchEvent(new Event('delta:openOnboarding'))
  }

  return (
    <button
      onClick={open}
      className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
    >
      How it works
    </button>
  )
}
