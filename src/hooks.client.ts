import type { HandleClientError } from '@sveltejs/kit'

// Chrome, Firefox, Safari wording for a module file that never arrived.
const MISSING_MODULE = /dynamically imported module|Importing a module script failed/

// A chunk that never arrived (crawlers skip fetches) must not replace the page with Error 500.
export const handleError: HandleClientError = ({ error, event }) => {
  if (!(error instanceof TypeError) || !MISSING_MODULE.test(error.message)) return
  // Startup: keep the prerendered page. Navigations and hover preloads stay SvelteKit's.
  if (event.url.href !== location.href) return
  return new Promise<never>(() => {})
}
