import type { ToastState } from '$lib/toaster/toastState.svelte'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

const STORAGE_KEY = 'gazePlotter:announcedVersion'

/**
 * Announce a new app version once per browser, per release.
 *
 * The first time a build version is seen, this shows a single info toast that
 * links to the guide; the version is then recorded in localStorage so returning
 * users are not nagged on every visit. The key is the build-time
 * `__APP_VERSION__`, so the notice reappears automatically after the next
 * release without any code change.
 *
 * This is an app-level concern, not part of the reusable `<GazePlotter>`
 * library: the `/docs` guide link only exists on the hosted site. Call it from
 * a route's `onMount` with the live session's toast state.
 */
export function announceVersionOnce(toastState: Pick<ToastState, 'add'>): void {
  let seen: string | null
  try {
    seen = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage blocked (private mode / disabled): skip rather than re-announce
    // on every visit with no way to remember it was shown.
    return
  }
  if (seen === __APP_VERSION__) return

  toastState.add({
    id: generateUniqueId(),
    title: "What's new",
    message: `GazePlotter ${__APP_VERSION__} is here.`,
    type: 'info',
    // No timeout: the announcement stays until the user dismisses it.
    duration: null,
    link: { href: '/docs', label: 'See what changed' },
  })

  // Best-effort persistence: if writing fails, the toast was still shown.
  try {
    localStorage.setItem(STORAGE_KEY, __APP_VERSION__)
  } catch {
    /* ignore */
  }
}
