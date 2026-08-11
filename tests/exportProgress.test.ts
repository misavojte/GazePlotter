import { describe, expect, it, vi } from 'vitest'
import { reportProgress } from '$lib/data/export/progress'

describe('reportProgress', () => {
  it('forwards the report as given', async () => {
    const onProgress = vi.fn()

    await reportProgress(onProgress, 3, 10, 'Packaging a.csv')

    expect(onProgress).toHaveBeenCalledWith(3, 10, 'Packaging a.csv')
  })

  it('awaits an async reporter before yielding', async () => {
    const order: string[] = []
    const onProgress = async () => {
      await Promise.resolve()
      order.push('reported')
    }

    await reportProgress(onProgress, 1, 2, 'work')
    order.push('returned')

    expect(order).toEqual(['reported', 'returned'])
  })

  it('yields a MACROTASK, so the browser can actually paint the update', async () => {
    // A timer queued before the call runs while `reportProgress` is still
    // pending. A microtask-only yield (a bare `await`) would resolve first and
    // leave the progress bar frozen for the whole export, which is the whole
    // reason this helper exists.
    const order: string[] = []
    const timerFired = new Promise<void>(resolve =>
      setTimeout(() => {
        order.push('timer')
        resolve()
      }, 0)
    )

    await reportProgress(
      () => {
        order.push('reported')
      },
      1,
      2,
      'work'
    )
    order.push('returned')

    await timerFired
    expect(order).toEqual(['reported', 'timer', 'returned'])
  })

  it('is a no-op without a reporter, and still yields nothing', async () => {
    const order: string[] = []
    setTimeout(() => order.push('timer'), 0)

    await reportProgress(undefined, 1, 2, 'work')

    // Returned inside the same task: a caller that passes no reporter pays
    // nothing per item.
    expect(order).toEqual([])
  })
})
