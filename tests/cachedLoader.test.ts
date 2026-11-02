import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedLoader } from '../src/routes/cachedLoader'

const ORIGIN = 'https://gazeplotter.test/'
const DEMO = '/data/demo.gazeplotter?v=new'
const absolute = (url: string) => new URL(url, ORIGIN).href

/** Cache Storage in memory, keyed by absolute URL like the real one. */
function stubCaches(stored: Record<string, string> = {}) {
  const entries = new Map(
    Object.entries(stored).map(([url, body]) => [absolute(url), new Response(body)])
  )
  const cache = {
    match: vi.fn(async (url: string) => entries.get(absolute(url))?.clone()),
    put: vi.fn(async (url: string, response: Response) => {
      entries.set(absolute(url), response)
    }),
    keys: vi.fn(async () => [...entries.keys()].map(url => new Request(url))),
    delete: vi.fn(async (request: Request) => entries.delete(request.url)),
  }
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) })
  vi.stubGlobal('location', { href: ORIGIN })
  return { cache, entries }
}

const stubFetch = () => {
  const fetchMock = vi.fn(async () => new Response('downloaded'))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const run = (load: ReturnType<typeof cachedLoader>) =>
  load(new AbortController().signal, () => {})

describe('cachedLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens the stored copy without the network', async () => {
    stubCaches({ [DEMO]: 'stored' })
    const fetchMock = stubFetch()

    const [file] = await run(cachedLoader(DEMO, 'demo.gazeplotter'))

    expect(file.name).toBe('demo.gazeplotter')
    expect(await file.text()).toBe('stored')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('downloads on a miss, stores it, and prunes other versions', async () => {
    const { cache, entries } = stubCaches({ '/data/demo.gazeplotter?v=old': 'old' })
    stubFetch()

    const [file] = await run(cachedLoader(DEMO, 'demo.gazeplotter'))

    expect(await file.text()).toBe('downloaded')
    await vi.waitFor(() => expect(cache.delete).toHaveBeenCalled())
    expect([...entries.keys()]).toEqual([absolute(DEMO)])
    expect(await entries.get(absolute(DEMO))!.text()).toBe('downloaded')
  })

  it('still loads when storage is unavailable', async () => {
    vi.stubGlobal('caches', { open: vi.fn(async () => Promise.reject(new Error('quota'))) })
    stubFetch()

    const [file] = await run(cachedLoader(DEMO, 'demo.gazeplotter'))

    expect(await file.text()).toBe('downloaded')
  })
})
