import { redirect } from 'next/navigation'

// The timetable now lives on the dashboard itself (front page), as a
// week view with prev/next navigation — this route is kept only so old
// links/bookmarks to it still land somewhere sensible.
export default function CleanerTimetableRedirect() {
  redirect('/cleaner/dashboard')
}
