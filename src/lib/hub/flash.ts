// A one-off message carried to the next screen (e.g. "CCQ-0001 saved."). Kept in this tab's session storage rather
// than the address, so it shows once and a refresh doesn't bring it back.
const KEY = 'hub-flash'
export function setFlash(msg: string) { try { sessionStorage.setItem(KEY, msg) } catch { /* private mode: no message */ } }
export function takeFlash(): string { try { const m = sessionStorage.getItem(KEY) || ''; sessionStorage.removeItem(KEY); return m } catch { return '' } }
