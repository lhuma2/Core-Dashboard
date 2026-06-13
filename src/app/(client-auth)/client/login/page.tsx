import { redirect } from 'next/navigation'

// Everyone signs in at the single shared login page.
export default function ClientLoginRedirect() {
  redirect('/login')
}
