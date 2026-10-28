import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromUrl } from '$lib/session/loaders'
import type { LoadProgress } from '$lib/data/ingest/types'

/** One scripted reply: a status, headers, and a body that ends one way. */
type Reply = {
  status?: number
  headers?: Record<string, string>
  chunks?: string[]
  /** 'error' drops the connection after the chunks; 'hang' never sends more. */
  end?: 'close' | 'error' | 'hang'
  /** A cross-origin response: the page cannot see Content-Encoding. */
  cors?: boolean
}

const encoder = new TextEncoder()
const noProgress = () => {}
const MODIFIED = 'Mon, 26 Oct 2026 14:33:15 GMT'

/** Stubs fetch: GETs take the replies in order, HEAD side requests take
 *  `head` (default: a network error). Bodies stream one chunk per read and
 *  error on abort, like a real response body. */
function serve(...replies: (Reply | Error)[]) {
  const requests: RequestInit[] = []
  const heads: RequestInit[] = []
  let head: Reply | Error | Promise<Reply> = new TypeError('HEAD not answered')
  const respond = (reply: Reply, signal: AbortSignal) => {
    const chunks = [...(reply.chunks ?? [])]
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason))
        },
        pull(controller) {
          const chunk = chunks.shift()
          if (chunk !== undefined) return controller.enqueue(encoder.encode(chunk))
          if (reply.end === 'error') return controller.error(new TypeError('network error'))
          if (reply.end === 'hang') return new Promise(() => {})
          controller.close()
        },
      },
      { highWaterMark: 0 }
    )
    const response = new Response(body, { status: reply.status ?? 200, headers: reply.headers })
    if (reply.cors) Object.defineProperty(response, 'type', { value: 'cors' })
    return response
  }
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const signal = init.signal!
    if (init.method === 'HEAD') {
      heads.push(init)
      const reply = await head
      if (reply instanceof Error) throw reply
      return respond({ ...reply, chunks: [] }, signal)
    }
    requests.push(init)
    const reply = replies.shift()
    if (!reply) throw new Error('unexpected request')
    if (reply instanceof Error) throw reply
    signal.throwIfAborted()
    return respond(reply, signal)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    fetchMock,
    heads,
    header: (request: number, name: string) =>
      new Headers(requests[request].headers).get(name),
    answerHead: (reply: Reply | Error | Promise<Reply>) => (head = reply),
  }
}

/** A full response's headers. */
const full = (length: number, extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  'Content-Length': String(length),
  'Last-Modified': MODIFIED,
  ...extra,
})

/** A 206 carrying the rest: its own length and the same Last-Modified. */
const rest = (length: number, extra: Record<string, string> = {}) => ({
  'Content-Length': String(length),
  'Last-Modified': MODIFIED,
  ...extra,
})

describe('fromUrl', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a File with the provided name on 200 OK', async () => {
    serve({ headers: { 'Content-Type': 'application/json' }, chunks: ['{"ok":true}'] })

    const load = fromUrl('https://example.test/data.json', 'custom.json')
    const files = await load(new AbortController().signal, noProgress)

    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('custom.json')
    expect(files[0].type).toBe('application/json')
    expect(await files[0].text()).toBe('{"ok":true}')
  })

  it('derives the name from the URL when fileName is omitted', async () => {
    serve({ chunks: ['{}'] })

    const load = fromUrl('https://example.test/some/path/etvis.json?v=2#frag')
    const files = await load(new AbortController().signal, noProgress)

    expect(files[0].name).toBe('etvis.json')
  })

  it.each([
    ['https://example.test/', 'trailing slash, empty last segment'],
    ['https://example.test', 'no path, host would otherwise leak in'],
    ['https://example.test/segmentwithoutextension', 'no extension'],
  ])('falls back to data.json when the URL has no usable filename (%s: %s)', async url => {
    serve({ chunks: ['{}'] })

    const files = await fromUrl(url)(new AbortController().signal, noProgress)

    expect(files[0].name).toBe('data.json')
  })

  it('reports progress against a visibly uncompressed length, with no side request', async () => {
    const { heads } = serve({ headers: full(6), chunks: ['abc', 'def'] })
    const progress: LoadProgress[] = []

    await fromUrl('https://example.test/a.json')(new AbortController().signal, p =>
      progress.push(p)
    )

    expect(progress).toEqual([
      { source: 'a.json from example.test', loaded: 0, total: null, sizePending: true, waiting: null },
      { source: 'a.json from example.test', loaded: 3, total: 6, sizePending: false, waiting: null },
      { source: 'a.json from example.test', loaded: 6, total: 6, sizePending: false, waiting: null },
    ])
    expect(heads).toHaveLength(0)
  })

  it('asks a HEAD with a range for the size when the response hides it', async () => {
    const { heads, answerHead } = serve({ headers: full(6), chunks: ['abc'], end: 'hang', cors: true })
    answerHead({ headers: { 'Content-Length': '6' } })
    const controller = new AbortController()
    const progress: LoadProgress[] = []

    const load = fromUrl('https://other.test/a.gazeplotter')(controller.signal, p =>
      progress.push(p)
    )
    await vi.waitFor(() =>
      expect(progress.at(-1)).toMatchObject({ loaded: 3, total: 6, sizePending: false })
    )
    controller.abort()
    await expect(load).rejects.toThrow()

    expect(heads).toHaveLength(1)
    expect(heads[0].method).toBe('HEAD')
    expect(new Headers(heads[0].headers).get('Range')).toBe('bytes=0-')
  })

  it('keeps the size pending while the side request is out, then settles it', async () => {
    const { answerHead } = serve({ headers: full(6), chunks: ['abc'], end: 'hang', cors: true })
    let answer!: (reply: Reply) => void
    answerHead(new Promise<Reply>(resolve => (answer = resolve)))
    const controller = new AbortController()
    const progress: LoadProgress[] = []

    const load = fromUrl('https://other.test/a.json')(controller.signal, p => progress.push(p))
    await vi.waitFor(() => expect(progress.at(-1)?.loaded).toBe(3))
    expect(progress.at(-1)).toMatchObject({ total: null, sizePending: true })

    // A HEAD without a length: the size is now known to be unknown.
    answer({ headers: {} })
    await vi.waitFor(() => expect(progress.at(-1)?.sizePending).toBe(false))
    expect(progress.at(-1)?.total).toBeNull()
    controller.abort()
    await expect(load).rejects.toThrow()
  })

  it('never blames CORS for an unreachable file on the same site', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('location', new URL('https://gazeplotter.test/'))
    serve(...Array(5).fill(new TypeError('Failed to fetch')))

    const result = expect(
      fromUrl('/data/demo.gazeplotter?v=1')(new AbortController().signal, noProgress)
    ).rejects.toThrow('Could not download demo.gazeplotter. Check your connection and try again.')
    await vi.runAllTimersAsync()
    await result
  })

  it('names the file, and the site when it is another one', async () => {
    vi.stubGlobal('location', new URL('https://gazeplotter.test/'))
    serve({ chunks: ['{}'] }, { chunks: ['{}'] })
    const sources: (string | undefined)[] = []

    await fromUrl('/data/demo.gazeplotter')(new AbortController().signal, p => sources.push(p.source))
    await fromUrl('https://osf.test/x/data.csv')(new AbortController().signal, p => sources.push(p.source))

    expect(sources[0]).toBe('demo.gazeplotter')
    expect(sources.at(-1)).toBe('data.csv from osf.test')
  })

  it('throws a non-retryable HTTP status at once', async () => {
    const { fetchMock } = serve({ status: 404, headers: {} })

    await expect(
      fromUrl('https://example.test/missing.json')(new AbortController().signal, noProgress)
    ).rejects.toThrow(/HTTP 404/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries with backoff, then names the site and CORS, keeping the cause', async () => {
    vi.useFakeTimers()
    const networkError = new TypeError('Failed to fetch')
    const { fetchMock } = serve(...Array(5).fill(networkError))

    const result = expect(
      fromUrl('https://blocked.test/data.json')(new AbortController().signal, noProgress)
    ).rejects.toMatchObject({
      message:
        'Could not download data.json from blocked.test. The site may be unreachable, or it may not let other sites load its files (CORS).',
      cause: networkError,
    })
    await vi.runAllTimersAsync()
    await result
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('retries a 503 and gives up with its HTTP message', async () => {
    vi.useFakeTimers()
    serve(...Array(5).fill({ status: 503, headers: {} }))

    const result = expect(
      fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    ).rejects.toThrow(/HTTP 503/)
    await vi.runAllTimersAsync()
    await result
  })

  it('resumes a dropped download with a lone Range, no If-Range', async () => {
    vi.useFakeTimers()
    const { header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'error' },
      { status: 206, headers: rest(3), chunks: ['def'] }
    )
    const progress: LoadProgress[] = []

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, p =>
      progress.push(p)
    )
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(0, 'Range')).toBeNull()
    expect(header(1, 'Range')).toBe('bytes=3-')
    expect(header(1, 'If-Range')).toBeNull()
    expect(progress).toContainEqual(expect.objectContaining({ loaded: 3, total: 6, waiting: 'retrying' }))
  })

  it('resumes across sites with the size from the side request', async () => {
    vi.useFakeTimers()
    const { header, answerHead } = serve(
      { headers: full(6), chunks: ['abc'], end: 'error', cors: true },
      { status: 206, headers: rest(3), chunks: ['def'], cors: true }
    )
    answerHead({ headers: { 'Content-Length': '6' } })

    const files = fromUrl('https://other.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(1, 'Range')).toBe('bytes=3-')
  })

  it('finishes a compressed start with an uncompressed rest', async () => {
    vi.useFakeTimers()
    const { header, answerHead } = serve(
      { headers: full(3, { 'Content-Encoding': 'gzip' }), chunks: ['abcd'], end: 'error' },
      { status: 206, headers: rest(2), chunks: ['ef'] }
    )
    answerHead({ headers: { 'Content-Length': '6' } })
    const progress: LoadProgress[] = []

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, p =>
      progress.push(p)
    )
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(0, 'Range')).toBeNull()
    expect(header(1, 'Range')).toBe('bytes=4-')
    // The compressed Content-Length (3) is never shown as the total.
    expect(progress.some(p => p.total === 3)).toBe(false)
  })

  it.each([
    ['a length that is not the rest', rest(6)],
    ['a changed Last-Modified', rest(3, { 'Last-Modified': 'Tue, 27 Oct 2026 09:00:00 GMT' })],
    ['no Last-Modified', { 'Content-Length': '3' }],
  ])('starts over when the 206 carries %s', async (_case, headers) => {
    vi.useFakeTimers()
    const { header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'error' },
      { status: 206, headers, chunks: ['def'] },
      { headers: full(6), chunks: ['abcdef'] }
    )

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(2, 'Range')).toBeNull()
  })

  it('takes a 200 reply to a Range request as the whole, changed file', async () => {
    vi.useFakeTimers()
    serve(
      { headers: full(6), chunks: ['abc'], end: 'error' },
      { headers: full(6), chunks: ['xyzxyz'] }
    )

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('xyzxyz')
  })

  it('without a known size, shows bytes only and a drop starts over', async () => {
    vi.useFakeTimers()
    const { header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'error', cors: true },
      { headers: full(6), chunks: ['abcdef'], cors: true }
    )
    const progress: LoadProgress[] = []

    const files = fromUrl('https://other.test/a.json')(new AbortController().signal, p =>
      progress.push(p)
    )
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(1, 'Range')).toBeNull()
    expect(progress.every(p => p.total === null)).toBe(true)
  })

  it('drops a size that the bytes outgrow', async () => {
    const { answerHead } = serve({ headers: full(3), chunks: ['abc', 'def'], cors: true })
    let answer!: (reply: Reply) => void
    answerHead(new Promise<Reply>(resolve => (answer = resolve)))
    const progress: LoadProgress[] = []
    let answered = false

    const files = fromUrl('https://other.test/a.json')(new AbortController().signal, p => {
      progress.push(p)
      // Answer the side request with a too-small size right after the first chunk.
      if (p.loaded === 3 && !answered) {
        answered = true
        answer({ headers: { 'Content-Length': '3' } })
      }
    })

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(progress.at(-1)?.total).toBeNull()
  })

  it('reports nothing when the side request answers after the load settled', async () => {
    const { answerHead } = serve({ headers: full(2), chunks: ['ok'], cors: true })
    let answer!: (reply: Reply) => void
    answerHead(new Promise<Reply>(resolve => (answer = resolve)))
    const onProgress = vi.fn()

    await fromUrl('https://other.test/a.json')(new AbortController().signal, onProgress)
    const calls = onProgress.mock.calls.length
    answer({ headers: { 'Content-Length': '2' } })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(onProgress).toHaveBeenCalledTimes(calls)
  })

  it('drops a stalled connection and resumes', async () => {
    vi.useFakeTimers()
    const { header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'hang' },
      { status: 206, headers: rest(3), chunks: ['def'] }
    )

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
    expect(header(1, 'Range')).toBe('bytes=3-')
  })

  it('treats a body shorter than its own Content-Length as interrupted', async () => {
    vi.useFakeTimers()
    serve(
      { headers: full(6), chunks: ['abc'] },
      { status: 206, headers: rest(3), chunks: ['def'] }
    )

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abcdef')
  })

  it('starts the retry budget over whenever an attempt brings bytes', async () => {
    vi.useFakeTimers()
    const drop = new TypeError('network error')
    serve(
      drop,
      drop,
      drop,
      { headers: full(3), chunks: ['a'], end: 'error' },
      drop,
      drop,
      drop,
      { status: 206, headers: rest(2), chunks: ['bc'] }
    )

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, noProgress)
    await vi.runAllTimersAsync()

    expect(await (await files)[0].text()).toBe('abc')
  })

  it('waits for the browser to come back online without spending retries', async () => {
    const online = { onLine: false }
    vi.stubGlobal('navigator', online)
    vi.stubGlobal('window', new EventTarget())
    const { fetchMock } = serve(new TypeError('offline'), { headers: full(2), chunks: ['ok'] })
    const progress: LoadProgress[] = []

    const files = fromUrl('https://example.test/a.json')(new AbortController().signal, p =>
      progress.push(p)
    )
    await vi.waitFor(() => expect(progress.at(-1)?.waiting).toBe('offline'))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    online.onLine = true
    window.dispatchEvent(new Event('online'))

    expect(await (await files)[0].text()).toBe('ok')
  })

  it('keeps the bytes of a failed load so the next call resumes', async () => {
    vi.useFakeTimers()
    const drop = new TypeError('network error')
    const { header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'error' },
      drop,
      drop,
      drop,
      drop,
      { status: 206, headers: rest(3), chunks: ['def'] }
    )
    const load = fromUrl('https://example.test/a.json')

    const failed = expect(load(new AbortController().signal, noProgress)).rejects.toThrow(
      'The download of a.json from example.test stopped at 3 of 6 Bytes. Check your connection and try again.'
    )
    await vi.runAllTimersAsync()
    await failed

    const files = await load(new AbortController().signal, noProgress)
    expect(await files[0].text()).toBe('abcdef')
    expect(header(5, 'Range')).toBe('bytes=3-')
  })

  it('aborts the request on abort and drops the bytes', async () => {
    const { fetchMock, header } = serve(
      { headers: full(6), chunks: ['abc'], end: 'hang' },
      { headers: full(6), chunks: ['abcdef'] }
    )
    const load = fromUrl('https://example.test/a.json')
    const controller = new AbortController()
    const progress: LoadProgress[] = []

    const aborted = load(controller.signal, p => progress.push(p))
    await vi.waitFor(() => expect(progress.at(-1)?.loaded).toBe(3))
    controller.abort()

    await expect(aborted).rejects.toThrow()
    expect(fetchMock.mock.calls[0][1].signal!.aborted).toBe(true)

    await load(new AbortController().signal, noProgress)
    expect(header(1, 'Range')).toBeNull()
  })
})
