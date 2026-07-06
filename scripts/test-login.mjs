import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await sb.auth.signInWithPassword({
  email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
})
if (error) { console.error('[FAIL] login:', error.message); process.exit(1) }
console.log('[OK] Signed in as', data.user.email)
console.log('role in metadata:', data.user.user_metadata?.role)
// Read own profile role via the authenticated session
const { data: prof, error: pErr } = await sb.from('profiles').select('role, full_name, email').eq('user_id', data.user.id).single()
if (pErr) console.log('profile read note:', pErr.message)
else console.log('profile:', JSON.stringify(prof))
