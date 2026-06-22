import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastState } from '$lib/toaster'
import { announceVersionOnce } from '../src/routes/versionNotice'

function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    ...overrides,
  } as Storage
}

describe('announceVersionOnce', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the toast once and records the build version', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const toastState = new ToastState()

    announceVersionOnce(toastState)

    expect(toastState.current).toHaveLength(1)
    const toast = toastState.current[0]
    expect(toast.type).toBe('info')
    expect(toast.duration).toBeNull()
    expect(toast.message).toContain(__APP_VERSION__)
    expect(toast.link).toEqual({ href: '/docs', label: 'See what changed' })
    expect(storage.getItem('gazePlotter:announcedVersion')).toBe(__APP_VERSION__)
  })

  it('does not re-announce a version already seen', () => {
    const storage = fakeStorage()
    storage.setItem('gazePlotter:announcedVersion', __APP_VERSION__)
    vi.stubGlobal('localStorage', storage)
    const toastState = new ToastState()

    announceVersionOnce(toastState)

    expect(toastState.current).toHaveLength(0)
  })

  it('re-announces when a different version was previously seen', () => {
    const storage = fakeStorage()
    storage.setItem('gazePlotter:announcedVersion', '0.0.0-old')
    vi.stubGlobal('localStorage', storage)
    const toastState = new ToastState()

    announceVersionOnce(toastState)

    expect(toastState.current).toHaveLength(1)
    expect(storage.getItem('gazePlotter:announcedVersion')).toBe(__APP_VERSION__)
  })

  it('skips silently when storage reads throw (e.g. blocked storage)', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        getItem: () => {
          throw new Error('blocked')
        },
      })
    )
    const toastState = new ToastState()

    expect(() => announceVersionOnce(toastState)).not.toThrow()
    expect(toastState.current).toHaveLength(0)
  })

  it('still shows the toast when persistence fails', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new Error('quota exceeded')
        },
      })
    )
    const toastState = new ToastState()

    expect(() => announceVersionOnce(toastState)).not.toThrow()
    expect(toastState.current).toHaveLength(1)
  })
})
