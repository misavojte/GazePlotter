import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromUrl } from '$lib/data/ingest/loaders'

function okResponse(body: string, contentType = 'application/json'): Response {
  return new Response(body, {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': contentType },
  })
}

describe('fromUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a File with the provided name on 200 OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)

    const load = fromUrl('https://example.test/data.json', 'custom.json')
    const files = await load(new AbortController().signal)

    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('custom.json')
    expect(files[0].type).toBe('application/json')
    expect(await files[0].text()).toBe('{"ok":true}')
  })

  it('derives the name from the URL when fileName is omitted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('{}')))

    const load = fromUrl(
      'https://example.test/some/path/etvis.json?v=2#frag'
    )
    const files = await load(new AbortController().signal)

    expect(files[0].name).toBe('etvis.json')
  })

  it.each([
    ['https://example.test/', 'trailing slash, empty last segment'],
    ['https://example.test', 'no path, host would otherwise leak in'],
    ['https://example.test/segmentwithoutextension', 'no extension'],
  ])(
    'falls back to data.json when the URL has no usable filename (%s — %s)',
    async url => {
      // Fresh response per call — `.blob()` consumes the body.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => Promise.resolve(okResponse('{}')))
      )

      const load = fromUrl(url)
      const files = await load(new AbortController().signal)

      expect(files[0].name).toBe('data.json')
    }
  )

  it('throws with the HTTP status when the response is not OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not found', { status: 404, statusText: 'Not Found' })
      )
    )

    const load = fromUrl('https://example.test/missing.json', 'missing.json')

    await expect(load(new AbortController().signal)).rejects.toThrow(
      /HTTP 404 Not Found/
    )
  })

  it('throws a CORS-flavoured error when fetch itself rejects, preserving the cause', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    const load = fromUrl('https://blocked.test/data.json')

    await expect(load(new AbortController().signal)).rejects.toMatchObject({
      message: expect.stringContaining('blocking cross-origin requests (CORS)'),
      cause: networkError,
    })
  })

  it('forwards the signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{}'))
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const load = fromUrl('https://example.test/data.json')
    await load(controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/data.json',
      expect.objectContaining({ signal: controller.signal })
    )
  })
})
