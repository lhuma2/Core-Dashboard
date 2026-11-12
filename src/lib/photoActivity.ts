/**
 * Tracks when a cleaner is busy with photos, so the cleaner portal's
 * refresh-on-focus can hold off. Coming back from the iOS photo picker or
 * camera counts as the app regaining focus, which used to re-load the whole
 * page from the server right as 30-40 photos started uploading: the two
 * fought over the phone's signal and the screen felt frozen. Nothing here
 * changes how photos are taken or uploaded.
 */

let busy = 0
let pickerOpened = false

/** Photo work (stamping, uploading, the photo box being open) has started. */
export function photoWorkStarted() {
  busy++
}

/** Matching end for photoWorkStarted. */
export function photoWorkEnded() {
  busy = Math.max(0, busy - 1)
}

/** The photo/video picker is about to open; the focus it hands back shouldn't refresh. */
export function photoPickerOpened() {
  pickerOpened = true
}

/** True when a refresh right now would compete with photo work. Consumes a pending picker return. */
export function shouldHoldRefresh(): boolean {
  if (pickerOpened) {
    pickerOpened = false
    return true
  }
  return busy > 0
}
