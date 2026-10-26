import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachOutsideDismiss, hasOpenFloating } from '$lib/shared/placement'

describe('hasOpenFloating', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts open popups, and a double detach never goes negative', () => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const options = { isInside: () => false, onDismiss: () => {} }
    expect(hasOpenFloating()).toBe(false)
    const first = attachOutsideDismiss(options)
    const second = attachOutsideDismiss(options)
    expect(hasOpenFloating()).toBe(true)
    first()
    first()
    expect(hasOpenFloating()).toBe(true)
    second()
    expect(hasOpenFloating()).toBe(false)
  })
})
