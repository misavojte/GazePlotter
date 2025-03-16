/**
 * Default service worker from SvelteKit docs
 * See: https://kit.svelte.dev/docs#serviceworker
 *
 * Allows for offline support and caching of static assets
 *
 * Uses 'sw' instead of 'self' for better type support
 */

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

const sw = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (self)
)

const CACHE = `cache-${version}`
const ASSETS = [
  ...files, // static folder
  ...build,
]

sw.addEventListener('install', event => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE)
    await cache.addAll(ASSETS)
  }
  event.waitUntil(addFilesToCache())
})

sw.addEventListener('activate', event => {
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key)
    }
  }

  event.waitUntil(deleteOldCaches())
})

sw.addEventListener('fetch', event => {
  // ignore POST requests etc
  if (event.request.method !== 'GET') return

  // Skip caching for chrome extension URLs - they can't be cached
  const url = new URL(event.request.url)
  if (url.protocol === 'chrome-extension:') {
    // Just fetch from network without caching
    event.respondWith(fetch(event.request))
    return
  }

  async function respond() {
    const cache = await caches.open(CACHE)

    // `build`/`files` can always be served from the cache
    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname)

      if (response) {
        return response
      }
    }

    // for everything else, try the network first, but
    // fall back to the cache if we're offline
    try {
      const response = await fetch(event.request)

      // if we're offline, fetch can return a value that is not a Response
      // instead of throwing - and we can't pass this non-Response to respondWith
      if (!(response instanceof Response)) {
        throw new Error('invalid response from fetch')
      }

      if (response.status === 200) {
        // Only cache if not a chrome-extension URL (double check)
        if (!event.request.url.startsWith('chrome-extension:')) {
          cache.put(event.request, response.clone())
        }
      }

      return response
    } catch (err) {
      const response = await cache.match(event.request)

      if (response) {
        return response
      }

      // if there's no cache, then just error out
      // as there is nothing we can do to respond to this request
      throw err
    }
  }

  event.respondWith(respond())
})
