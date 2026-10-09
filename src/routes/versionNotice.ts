import type { ToastState } from '$lib/toaster/toastState.svelte'
import { generateUniqueId } from '$lib/shared/uniqueId'

const STORAGE_KEY = 'gazePlotter:announcedVersion'

/**
 * Announce a new app version once per browser, per release.
 *
 * When a returning user first sees a new build version, this shows a single
 * info toast that links to the changelog; the version is then recorded in
 * localStorage so they are not nagged on every visit. A first visit records
 * the version silently: there is no earlier version to compare against. The key is the build-time
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

  if (seen !== null) toastState.add({
    id: generateUniqueId(),
    message: `GazePlotter ${__APP_VERSION__} is here.`,
    type: 'info',
    // No timeout: the announcement stays until the user dismisses it.
    duration: null,
    link: { href: `/docs/changelog#${__APP_VERSION__.replace(/\./g, '')}`, label: 'See what changed' },
  })

  // Best-effort persistence: if writing fails, the toast was still shown.
  try {
    localStorage.setItem(STORAGE_KEY, __APP_VERSION__)
  } catch {
    /* ignore */
  }
}
