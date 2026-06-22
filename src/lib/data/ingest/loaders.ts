import type { DataLoader } from './types'

/**
 * Build a {@link DataLoader} that fetches a single file from a URL and feeds
 * it to GazePlotter's normal ingest job (extension-based detection,
 * worker parsing, error reporting).
 *
 * @param url       URL to fetch.
 * @param fileName  Name attached to the resulting `File`. The extension drives
 *                  classification — use a meaningful one (`.json` for a
 *                  workspace, `.csv`, `.zip`, …). Defaults to the URL's last
 *                  path segment, falling back to `'data.json'`.
 *
 * Errors:
 * - HTTP non-2xx → thrown with status / statusText in the message.
 * - `fetch()` rejection (network down, CORS, DNS, …) → thrown with a
 *   CORS-flavoured message and the original error as `cause`.
 *
 * The host (`<GazePlotter>`) surfaces the thrown message verbatim in the
 * "Data Load Failed" toast. Aborts via the passed `signal` are forwarded
 * to `fetch` and bail without reporting.
 */
export function fromUrl(url: string, fileName?: string): DataLoader {
  return async signal => {
    let response: Response
    try {
      response = await fetch(url, { signal })
    } catch (cause) {
      throw new Error(
        `Could not load data from "${url}". The server may be unreachable or blocking cross-origin requests (CORS).`,
        { cause }
      )
    }
    if (!response.ok) {
      throw new Error(
        `Loading "${url}" failed with HTTP ${response.status} ${response.statusText}.`
      )
    }
    const blob = await response.blob()
    const name = fileName ?? deriveFileName(url)
    return [new File([blob], name, { type: blob.type || 'application/json' })]
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
