import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function initVapid() {
  const subject = process.env.VAPID_SUBJECT
  const pubKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !pubKey || !privKey) return false
  webpush.setVapidDetails(subject.trim(), pubKey.trim(), privKey.trim())
  return true
}

// Send push to all users with a given role (e.g. all managers)
export async function sendPushToRole(
  role: 'manager' | 'admin' | 'cleaner',
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return
  const admin = createAdminClient()

  // Get all user_ids for the role
  const { data: profiles } = await (admin as any)
    .from('profiles')
    .select('user_id')
    .eq('role', role)

  if (!profiles?.length) return

  await Promise.allSettled(
    profiles.map((p: { user_id: string }) => sendPushToUser(p.user_id, payload))
  )
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!initVapid()) return   // silently skip if env vars not set

  const admin = createAdminClient()

  const { data: subscriptions, error } = await (admin as any)
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subscriptions?.length) return

  const payloadString = JSON.stringify(payload)

  await Promise.allSettled(
    subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadString
        )
      } catch (err: any) {
        // 410 Gone / 404 = subscription expired — clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await (admin as any)
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      }
    })
  )
}
