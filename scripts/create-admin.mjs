// Creates the first admin: an auth user + a profiles row with role='admin'.
// Mirrors src/actions/team.ts. Idempotent — reuses the auth user if it exists.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const fullName = process.env.ADMIN_NAME || 'Laith Humadi'

if (!url || !serviceKey || !email || !password) {
  console.error('Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

let userId
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { role: 'admin', full_name: fullName },
})

if (createErr) {
  const exists = /already|registered/i.test(createErr.message)
  if (!exists) { console.error('createUser failed:', createErr.message); process.exit(1) }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const found = list.users.find(u => u.email === email)
  if (!found) { console.error('User exists but not found'); process.exit(1) }
  await admin.auth.admin.updateUserById(found.id, {
    password, email_confirm: true, user_metadata: { role: 'admin', full_name: fullName },
  })
  userId = found.id
  console.log('Reused existing auth user, password reset.')
} else {
  userId = created.user.id
  console.log('Created auth user.')
}

const profileData = { user_id: userId, role: 'admin', full_name: fullName, email }
const { data: existingProfile } = await admin.from('profiles').select('id').eq('user_id', userId).single()
if (existingProfile?.id) {
  const { error } = await admin.from('profiles').update(profileData).eq('user_id', userId)
  if (error) { console.error('profile update failed:', error.message); process.exit(1) }
  console.log('Updated existing profile → admin.')
} else {
  const { error } = await admin.from('profiles').insert(profileData)
  if (error) { console.error('profile insert failed:', error.message); process.exit(1) }
  console.log('Inserted profile → admin.')
}

console.log('\n[OK] Admin ready:', email, '(role=admin)')
