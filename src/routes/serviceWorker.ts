import { base } from '$app/paths'
import { dev } from '$app/environment'

let registered = false

/**
 * Registered by hand (svelte.config.js `register: false`): SvelteKit's inline
 * registration starts the precache in parallel with the page's own first
 * downloads. Offline support is best-effort, so a failure is ignored.
 */
export function registerServiceWorker(): void {
  if (registered || !('serviceWorker' in navigator)) return
  registered = true
  navigator.serviceWorker
    .register(`${base}/service-worker.js`, { type: dev ? 'module' : 'classic' })
    .catch(() => {})
}
