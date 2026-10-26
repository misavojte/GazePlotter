import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canCopyImages,
  copyCanvasToClipboard,
} from '$lib/plots/shared/figureExport'

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

function stubClipboard() {
  const written: FakeClipboardItem[] = []
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  vi.stubGlobal('navigator', {
    clipboard: {
      write: async (items: FakeClipboardItem[]) => {
        written.push(...items)
        await Promise.all(items.flatMap(item => Object.values(item.items)))
      },
    },
  })
  return written
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyCanvasToClipboard', () => {
  it('is unavailable without the clipboard image API', () => {
    vi.stubGlobal('ClipboardItem', undefined)
    expect(canCopyImages()).toBe(false)
    stubClipboard()
    expect(canCopyImages()).toBe(true)
  })

  it('starts the write before the figure has rendered', () => {
    const written = stubClipboard()
    const pending = new Promise<HTMLCanvasElement | null>(() => {})
    void copyCanvasToClipboard(pending)
    expect(written).toHaveLength(1)
    expect(Object.keys(written[0].items)).toEqual(['image/png'])
  })

  it('fails when the figure has nothing to draw', async () => {
    stubClipboard()
    await expect(copyCanvasToClipboard(Promise.resolve(null))).rejects.toThrow(
      'nothing to draw'
    )
  })
})
