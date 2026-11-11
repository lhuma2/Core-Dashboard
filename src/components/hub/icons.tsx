// Line icons from the mock-up (24px grid, stroke 2).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Chev = () => <svg className="chev" {...base} width={18} height={18}><path d="M9 6l6 6-6 6" /></svg>
export const Building = () => <svg {...base}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></svg>
export const House = () => <svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
export const Key = () => <svg {...base}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></svg>
export const People = () => <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5.4" /></svg>
export const Shield = () => <svg {...base}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
export const Warning = () => <svg {...base}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>
export const Star = () => <svg {...base}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
export const Back = () => <svg {...base} width={18} height={18}><path d="M15 6l-6 6 6 6" /></svg>
export const Search = () => <svg {...base} width={16} height={16}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
export const Prev = () => <svg {...base} width={18} height={18}><path d="M15 6l-6 6 6 6" /></svg>
export const Next = () => <svg {...base} width={18} height={18}><path d="M9 6l6 6-6 6" /></svg>
export const Close = () => <svg {...base} width={18} height={18}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Plus = () => <svg {...base} width={16} height={16} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
