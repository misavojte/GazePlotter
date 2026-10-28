import { fromUrl, type DataLoader } from '$lib'

// Not a `cache-*` name: the service worker deletes those on every deploy.
const CACHE = 'gazeplotter-data'

/**
 * `fromUrl` behind Cache Storage: the first visit downloads, later visits
 * open the stored copy with no network at all. Only for content-versioned
 * URLs, since a stored copy is never revalidated; storing one prunes the rest.
 */
export function cachedLoader(url: string, fileName: string): DataLoader {
  const download = fromUrl(url, fileName)
  return async (signal, onProgress) => {
    const stored = await readStored(url)
    if (stored) return [new File([stored], fileName, { type: stored.type })]
    const files = await download(signal, onProgress)
    void store(url, files[0])
    return files
  }
}

// Storage is best-effort throughout (no `caches` outside secure contexts,
// private modes, quota): failing it only means downloading again next time.

async function readStored(url: string): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(CACHE)).match(url)
    return hit ? await hit.blob() : null
  } catch {
    return null
  }
}

async function store(url: string, file: File): Promise<void> {
  try {
    const cache = await caches.open(CACHE)
    await cache.put(url, new Response(file, { headers: { 'Content-Type': file.type } }))
    const current = new URL(url, location.href).href
    for (const request of await cache.keys()) {
      if (request.url !== current) await cache.delete(request)
    }
  } catch {
    // Kept nothing: the next visit downloads again.
  }
}
