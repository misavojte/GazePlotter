import { describe, expect, it, vi } from 'vitest'
import { FileDropTarget } from '$lib/workspace/fileDrop.svelte'

type FakeTransfer = {
  types: string[]
  files?: { length: number }
  dropEffect?: string
}

function drag(transfer: FakeTransfer | null): DragEvent & {
  preventDefault: ReturnType<typeof vi.fn>
} {
  return {
    dataTransfer: transfer,
    preventDefault: vi.fn(),
  } as unknown as DragEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

const fileDrag = () => drag({ types: ['Files'] })
const textDrag = () => drag({ types: ['text/plain'] })

describe('FileDropTarget', () => {
  it('stays active while the pointer crosses nested children', () => {
    const target = new FileDropTarget()
    expect(target.isActive).toBe(false)

    // Entering a child fires enter before the old element's leave, so the
    // depth rises to 2 and never dips to 0 mid-drag.
    target.enter(fileDrag())
    expect(target.isActive).toBe(true)
    target.enter(fileDrag())
    target.leave(fileDrag())
    expect(target.isActive).toBe(true)

    target.leave(fileDrag())
    expect(target.isActive).toBe(false)
  })

  it('ignores a non-file drag on BOTH enter and leave, so the depth cannot go negative', () => {
    const target = new FileDropTarget()

    // A text/URL drag crossing the workspace must not decrement: a negative
    // depth used to swallow the overlay on the next real file drag.
    target.leave(textDrag())
    target.leave(textDrag())
    target.enter(textDrag())
    expect(target.isActive).toBe(false)

    target.enter(fileDrag())
    expect(target.isActive).toBe(true)
  })

  it('accepts the drop as a copy rather than reporting none', () => {
    const target = new FileDropTarget()
    const transfer: FakeTransfer = { types: ['Files'] }
    const event = drag(transfer)

    target.over(event)

    // 'none' would make the browser suppress the drop event itself, so a
    // refusal (one upload at a time) could never explain itself with a toast.
    expect(transfer.dropEffect).toBe('copy')
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('leaves a non-file dragover alone', () => {
    const target = new FileDropTarget()
    const transfer: FakeTransfer = { types: ['text/plain'] }
    const event = drag(transfer)

    target.over(event)

    expect(transfer.dropEffect).toBeUndefined()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('returns the dropped files and goes inactive', () => {
    const target = new FileDropTarget()
    target.enter(fileDrag())
    target.enter(fileDrag())

    const files = { length: 2 }
    const event = drag({ types: ['Files'], files })

    expect(target.drop(event)).toBe(files)
    expect(event.preventDefault).toHaveBeenCalled()
    // One drop clears however deep the drag went.
    expect(target.isActive).toBe(false)
  })

  it('reports no files for an empty drop, without claiming the event', () => {
    const target = new FileDropTarget()
    target.enter(fileDrag())

    const event = drag({ types: ['Files'], files: { length: 0 } })

    expect(target.drop(event)).toBeNull()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(target.isActive).toBe(false)
  })

  it('survives a drop with no dataTransfer at all', () => {
    const target = new FileDropTarget()
    expect(target.drop(drag(null))).toBeNull()
    expect(target.isActive).toBe(false)
  })
})
