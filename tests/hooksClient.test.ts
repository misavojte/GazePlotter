import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleError } from '../src/hooks.client'

const HOME = 'https://gazeplotter.com/'
const CHUNK = 'https://gazeplotter.com/_app/immutable/nodes/3.BG0DBdn8.js'

function run(error: unknown, url: string) {
  const event = { url: new URL(url), params: {}, route: { id: null } }
  return handleError({ error, event, status: 500, message: 'Internal Error' })
}

function stubLocation() {
  const assign = vi.fn()
  vi.stubGlobal('location', { href: HOME, assign })
  return assign
}

describe('handleError on a missing chunk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    `Failed to fetch dynamically imported module: ${CHUNK}`,
    `error loading dynamically imported module: ${CHUNK}`,
    'Importing a module script failed.',
  ])('keeps the prerendered page at startup (%s)', async (message) => {
    const assign = stubLocation()
    const settled = vi.fn()
    void Promise.resolve(run(new TypeError(message), HOME)).then(settled)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(settled).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('loads the navigation target as a full page', () => {
    const assign = stubLocation()

    run(new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`), `${HOME}docs/`)

    expect(assign).toHaveBeenCalledWith(new URL(`${HOME}docs/`))
  })

  it('leaves every other error to the error page', () => {
    const assign = stubLocation()

    expect(run(new TypeError('x is not a function'), HOME)).toBeUndefined()
    expect(run(new Error('boom'), HOME)).toBeUndefined()
    expect(assign).not.toHaveBeenCalled()
  })
})
