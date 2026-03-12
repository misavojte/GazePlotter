import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastState } from '$lib/toaster'

describe('ToastState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('dedupes identical toasts within the dedupe window', () => {
    const toastState = new ToastState()

    toastState.addError('Repeated failure')
    toastState.addError('Repeated failure')

    expect(toastState.current).toHaveLength(1)

    vi.advanceTimersByTime(2001)

    toastState.addError('Repeated failure')

    expect(toastState.current).toHaveLength(2)
  })

  it('prunes stale dedupe entries outside the dedupe window', () => {
    const toastState = new ToastState()

    toastState.addError('Old failure')
    vi.advanceTimersByTime(2001)
    toastState.addError('Fresh failure')

    const recentToastTimes = (
      toastState as unknown as { recentToastTimes: Map<string, number> }
    ).recentToastTimes

    expect(recentToastTimes.size).toBe(1)
    expect([...recentToastTimes.keys()][0]).toContain('Fresh failure')
  })

  it('keeps only the most recent visible toasts and truncates long messages', () => {
    const toastState = new ToastState()
    const longMessage = 'x'.repeat(400)

    toastState.addInfo(longMessage)

    expect(toastState.current[0]?.message.endsWith('...')).toBe(true)
    expect(toastState.current[0]?.message.length).toBe(280)

    for (let index = 0; index < 5; index++) {
      vi.advanceTimersByTime(2500)
      toastState.addSuccess(`Toast ${index}`)
    }

    expect(toastState.current).toHaveLength(5)
    expect(toastState.current[0]?.message).toBe('Toast 0')
    expect(toastState.current.at(-1)?.message).toBe('Toast 4')

    toastState.clear()

    expect(toastState.current).toEqual([])
  })
})
