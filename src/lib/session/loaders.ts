import type { DataLoader, LoadProgress } from '$lib/data/ingest/types'
import { formatSizeProgress } from '$lib/shared/format'

/** No byte for this long: the connection is treated as dropped. */
const STALL_MS = 20_000
/** Waits before each retry; a retry that brings bytes starts the list over. */
const BACKOFF_MS = [1000, 2000, 4000, 8000]

/**
 * Build a {@link DataLoader} that downloads one file from a URL into
 * GazePlotter's normal ingest job.
 *
 * @param url       URL to fetch.
 * @param fileName  Name of the resulting `File`; its extension drives format
 *                  detection (`.json` for a workspace, `.csv`, `.zip`, …).
 *                  Defaults to the URL's last path segment, else `'data.json'`.
 *
 * Reports progress against the uncompressed size (from the response, or a HEAD
 * side request), drops stalled connections, backs off between retries, waits
 * for `online` when offline, and resumes with a plain `Range`. A failed load
 * keeps its bytes, so calling the loader again resumes; an abort drops them.
 *
 * Throws at once on HTTP 4xx (except 408/429). When retries run out, the
 * message says how far it got, or names CORS when another site sent nothing.
 * `<GazePlotter>` shows it verbatim on the "Data load failed" screen.
 */
export function fromUrl(url: string, fileName?: string): DataLoader {
  const name = fileName ?? deriveFileName(url)
  // Left by a failed call for the next one to resume; a call owns it while running.
  let partial: Download | null = null
  return async (signal, onProgress) => {
    const download = partial ?? emptyDownload()
    partial = null
    try {
      const blob = await fetchResilient(describe(url, name), signal, onProgress, download)
      return [new File([blob], name, { type: blob.type || 'application/json' })]
    } catch (error) {
      if (!signal.aborted) partial = download
      throw error
    }
  }
}

type Download = {
  chunks: Uint8Array<ArrayBuffer>[]
  loaded: number
  /** Uncompressed size; null when unknown, and then the download cannot resume. */
  total: number | null
  /** Of the full response: a resumed 206 must carry the same, else start over. */
  lastModified: string | null
  type: string
  /** Bytes ever received, across restarts: what counts as progress. */
  received: number
  /** The HEAD side request was sent: once per download. */
  probed: boolean
  /** The size may still arrive: before a response, or while the side request is out. */
  sizePending: boolean
}

const emptyDownload = (): Download => ({
  chunks: [],
  loaded: 0,
  total: null,
  lastModified: null,
  type: '',
  received: 0,
  probed: false,
  sizePending: true,
})

/** What the screen and the messages call a download. */
type Source = { url: string; label: string; otherSite: boolean }

class HttpError extends Error {
  readonly retryable: boolean
  constructor(source: Source, response: Response) {
    const status = [response.status, response.statusText].filter(Boolean).join(' ')
    super(`Could not download ${source.label}: the server answered HTTP ${status}.`)
    this.retryable =
      response.status === 408 || response.status === 429 || response.status >= 500
  }
}

async function fetchResilient(
  source: Source,
  signal: AbortSignal,
  onProgress: (progress: LoadProgress) => void,
  download: Download
): Promise<Blob> {
  // The side request may answer after the load settled: report nothing then.
  let live = true
  const report = (waiting: LoadProgress['waiting']) => {
    if (!live) return
    const { loaded, total, sizePending } = download
    onProgress({ source: source.label, loaded, total, sizePending, waiting })
  }
  report(null)
  let misses = 0
  try {
    for (;;) {
      const before = download.received
      let lastError: unknown
      try {
        if (await attempt(source, signal, report, download)) {
          return new Blob(download.chunks, { type: download.type })
        }
      } catch (error) {
        if (signal.aborted) throw error
        if (error instanceof HttpError && !error.retryable) throw error
        lastError = error
      }
      if (download.received > before) misses = 0
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        report('offline')
        await untilOnline(signal)
        continue
      }
      if (misses === BACKOFF_MS.length) throw failure(source, download, lastError)
      report('retrying')
      await sleep(BACKOFF_MS[misses++], signal)
    }
  } finally {
    live = false
  }
}

/** One request. True when the file is complete, false when it must go again. */
async function attempt(
  source: Source,
  signal: AbortSignal,
  report: (waiting: LoadProgress['waiting']) => void,
  download: Download
): Promise<boolean> {
  signal.throwIfAborted()
  const { url } = source
  const resume = download.loaded > 0 && download.total !== null
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort)
  let stall = setTimeout(() => controller.abort(), STALL_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // A lone single range needs no CORS preflight, and makes the browser ask
      // for the uncompressed file (Fetch §4.6), so the offset counts the same
      // bytes even when the first response was compressed.
      headers: resume ? { Range: `bytes=${download.loaded}-` } : undefined,
    })
    // The transport's own size: what completion is checked against.
    let end: number | null
    if (resume && response.status === 206) {
      if (!continues(response, download)) {
        await response.body?.cancel()
        restart(download)
        return false
      }
      end = download.total
    } else if (response.ok) {
      restart(download)
      end = ownLength(response)
      download.total = end
      download.lastModified = response.headers.get('Last-Modified')
      download.type = response.headers.get('Content-Type') ?? ''
      download.sizePending = end === null && !download.probed
      if (download.sizePending) {
        download.probed = true
        void uncompressedSize(url, signal).then(size => {
          download.sizePending = false
          if (size !== null && download.total === null && download.loaded <= size) {
            download.total = size
          }
          report(null)
        })
      }
    } else if (resume && response.status === 416) {
      restart(download)
      return false
    } else {
      throw new HttpError(source, response)
    }

    const reader = response.body?.getReader()
    for (;;) {
      const chunk = await reader?.read()
      if (!chunk || chunk.done) break
      clearTimeout(stall)
      stall = setTimeout(() => controller.abort(), STALL_MS)
      download.chunks.push(chunk.value)
      download.loaded += chunk.value.length
      download.received += chunk.value.length
      // A size that more bytes outgrew was not the uncompressed one.
      if (download.total !== null && download.loaded > download.total) download.total = null
      report(null)
    }
    return end === null || download.loaded >= end
  } finally {
    clearTimeout(stall)
    signal.removeEventListener('abort', abort)
  }
}

function restart(download: Download): void {
  download.chunks = []
  download.loaded = 0
  download.total = null
  download.lastModified = null
}

/** The response's size, when the page can see it is uncompressed; across
 *  sites Content-Encoding is hidden (Fetch: CORS-safelisted response headers). */
function ownLength(response: Response): number | null {
  if (response.type === 'cors') return null
  const encoding = response.headers.get('Content-Encoding')
  if (encoding && encoding !== 'identity') return null
  const length = Number(response.headers.get('Content-Length'))
  return length > 0 ? length : null
}

/** Asked on the side: with `Range` the browser requests the uncompressed file
 *  (Fetch §4.6) and the server ignores the range on HEAD (RFC 9110 §14.2).
 *  The length is optional on HEAD (§8.6), so null is a normal answer. */
async function uncompressedSize(url: string, signal: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', headers: { Range: 'bytes=0-' }, signal })
    const length = Number(response.headers.get('Content-Length'))
    return response.ok && length > 0 ? length : null
  } catch {
    return null
  }
}

/** A 206 continues the held bytes only when it carries exactly the rest of
 *  the same file; both headers are readable across sites. */
function continues(response: Response, download: Download): boolean {
  return (
    download.lastModified !== null &&
    response.headers.get('Last-Modified') === download.lastModified &&
    Number(response.headers.get('Content-Length')) === download.total! - download.loaded
  )
}

function failure(source: Source, download: Download, cause: unknown): Error {
  if (cause instanceof HttpError) return cause
  if (download.loaded > 0) {
    const at = formatSizeProgress(download.loaded, download.total)
    return new Error(
      `The download of ${source.label} stopped at ${at}. Check your connection and try again.`,
      { cause }
    )
  }
  return new Error(
    source.otherSite
      ? `Could not download ${source.label}. The site may be unreachable, or it may not let other sites load its files (CORS).`
      : `Could not download ${source.label}. Check your connection and try again.`,
    { cause }
  )
}

/** Settles when `arm` calls back, or rejects when the signal aborts first. */
function until(
  signal: AbortSignal,
  arm: (done: () => void) => () => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const disarm = arm(settle)
    signal.addEventListener('abort', settle)
    function settle() {
      disarm()
      signal.removeEventListener('abort', settle)
      if (signal.aborted) reject(signal.reason)
      else resolve()
    }
  })
}

const sleep = (ms: number, signal: AbortSignal) =>
  until(signal, done => {
    const timer = setTimeout(done, ms)
    return () => clearTimeout(timer)
  })

const untilOnline = (signal: AbortSignal) =>
  until(signal, done => {
    window.addEventListener('online', done)
    return () => window.removeEventListener('online', done)
  })

/** The file, plus the site it comes from when that is not this page's. */
function describe(url: string, name: string): Source {
  const here = typeof location === 'undefined' ? null : location
  try {
    const at = new URL(url, here?.href ?? 'http://this.page/')
    const otherSite = at.origin !== (here?.origin ?? 'http://this.page')
    return { url, label: otherSite ? `${name} from ${at.host}` : name, otherSite }
  } catch {
    return { url, label: name, otherSite: false }
  }
}

function deriveFileName(url: string): string {
  // Use URL parsing so we never accidentally treat the host as a filename
  // (e.g. `https://example.com` whose last `/`-segment is `example.com`).
  try {
    const parsed = new URL(url, 'http://_placeholder_/')
    const segments = parsed.pathname.split('/').filter(s => s.length > 0)
    const last = segments[segments.length - 1]
    // Require an extension so classification downstream has something to read.
    if (last && /\.[^./]+$/.test(last)) {
      return last
    }
  } catch {
    // malformed URL → fall through to default
  }
  return 'data.json'
}
