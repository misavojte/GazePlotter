import type { HandleClientError } from '@sveltejs/kit'

// Chrome, Firefox, Safari wording for a module file that never arrived.
const MISSING_MODULE = /dynamically imported module|Importing a module script failed/

// A chunk that never arrived (crawlers skip fetches) must not replace the page with Error 500.
export const handleError: HandleClientError = ({ error, event }) => {
  if (!(error instanceof TypeError) || !MISSING_MODULE.test(error.message)) return
  // Navigation: load the target as a full page. Startup: keep the prerendered page.
  if (event.url.href !== location.href) location.assign(event.url)
  return new Promise<never>(() => {})
}
