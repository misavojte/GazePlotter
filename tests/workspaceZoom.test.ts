import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WorkspaceZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
} from '$lib/workspace/zoom.svelte'

function viewport(init: { scrollLeft?: number; scrollTop?: number } = {}) {
  return {
    scrollLeft: init.scrollLeft ?? 0,
    scrollTop: init.scrollTop ?? 0,
    getBoundingClientRect: () => ({ left: 100, top: 50 }),
  } as unknown as HTMLElement
}

function wheel(init: {
  deltaY: number
  ctrlKey?: boolean
  clientX?: number
  clientY?: number
}) {
  return {
    deltaY: init.deltaY,
    ctrlKey: init.ctrlKey ?? true,
    metaKey: false,
    clientX: init.clientX ?? 100,
    clientY: init.clientY ?? 50,
    preventDefault: vi.fn(),
  } as unknown as WheelEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

/** Run the scroll-compensation callback synchronously. */
function withImmediateFrames(run: () => void) {
  const original = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }) as typeof globalThis.requestAnimationFrame
  try {
    run()
  } finally {
    globalThis.requestAnimationFrame = original
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clampZoom', () => {
  it('holds the range at both ends', () => {
    expect(clampZoom(10)).toBe(ZOOM_MAX)
    expect(clampZoom(0)).toBe(ZOOM_MIN)
    expect(clampZoom(0.7)).toBe(0.7)
  })
})

describe('WorkspaceZoom', () => {
  it('starts fully zoomed in and steps within the range', () => {
    const zoom = new WorkspaceZoom()
    expect(zoom.value).toBe(ZOOM_MAX)

    zoom.out()
    expect(zoom.value).toBeCloseTo(ZOOM_MAX - ZOOM_STEP)
    zoom.in()
    expect(zoom.value).toBeCloseTo(ZOOM_MAX)
  })

  it('clamps every write, including the rail slider’s binding', () => {
    const zoom = new WorkspaceZoom()

    zoom.in()
    expect(zoom.value).toBe(ZOOM_MAX)

    zoom.value = 99
    expect(zoom.value).toBe(ZOOM_MAX)
    zoom.value = -5
    expect(zoom.value).toBe(ZOOM_MIN)

    for (let i = 0; i < 50; i++) zoom.out()
    expect(zoom.value).toBe(ZOOM_MIN)

    zoom.reset()
    expect(zoom.value).toBe(ZOOM_MAX)
  })

  it('ignores a wheel without Ctrl/Cmd so plain scrolling still scrolls', () => {
    const zoom = new WorkspaceZoom()
    zoom.setViewport(viewport())
    const event = wheel({ deltaY: -100, ctrlKey: false })

    zoom.wheel(event)

    expect(zoom.value).toBe(ZOOM_MAX)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('claims the gesture even with no viewport bound, so the browser never page-zooms', () => {
    const zoom = new WorkspaceZoom()
    const event = wheel({ deltaY: -100 })

    zoom.wheel(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(zoom.value).toBe(ZOOM_MAX)
  })

  it('keeps the grid point under the cursor stationary while zooming out', () => {
    const zoom = new WorkspaceZoom()
    // Pointer 200px into the container, which is scrolled 300px right.
    const element = viewport({ scrollLeft: 300, scrollTop: 120 })
    zoom.setViewport(element)

    const before = zoom.value
    // Positive deltaY zooms out; 100 * 0.001 = 0.1 below ZOOM_MAX.
    const event = wheel({ deltaY: 100, clientX: 300, clientY: 200 })
    const pointerX = 300 - 100
    const pointerY = 200 - 50
    const gridX = (300 + pointerX) / before
    const gridY = (120 + pointerY) / before

    withImmediateFrames(() => zoom.wheel(event))

    expect(zoom.value).toBeCloseTo(before - 0.1)
    // The same grid coordinate still sits under the pointer after the zoom.
    expect((element.scrollLeft + pointerX) / zoom.value).toBeCloseTo(gridX)
    expect((element.scrollTop + pointerY) / zoom.value).toBeCloseTo(gridY)
  })

  it('does not touch scroll when the gesture cannot change the level', () => {
    const zoom = new WorkspaceZoom()
    const element = viewport({ scrollLeft: 300, scrollTop: 120 })
    zoom.setViewport(element)

    // Already at ZOOM_MAX, and this gesture zooms in further.
    withImmediateFrames(() => zoom.wheel(wheel({ deltaY: -100 })))

    expect(zoom.value).toBe(ZOOM_MAX)
    expect(element.scrollLeft).toBe(300)
    expect(element.scrollTop).toBe(120)
  })
})
