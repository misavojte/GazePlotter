import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FRAME_INSET,
  OPEN_ZOOM_MIN,
  WorkspaceCamera,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
  type GridBounds,
} from '$lib/workspace/camera.svelte'

/** An 800×600 frame whose padding box starts at client (100, 50). */
function frame() {
  return {
    clientWidth: 800,
    clientHeight: 600,
    clientLeft: 0,
    clientTop: 0,
    getBoundingClientRect: () => ({ left: 100, top: 50, right: 900, bottom: 650 }),
  } as unknown as HTMLElement
}

function camera(bounds: GridBounds | null = { left: 0, top: 0, right: 1600, bottom: 1200 }) {
  const cam = new WorkspaceCamera()
  cam.setFrame(frame())
  cam.setContentBounds(() => bounds)
  return cam
}

function wheel(init: { deltaY: number; ctrlKey?: boolean; clientX?: number; clientY?: number }) {
  return {
    deltaY: init.deltaY,
    ctrlKey: init.ctrlKey ?? true,
    metaKey: false,
    clientX: init.clientX ?? 100,
    clientY: init.clientY ?? 50,
    preventDefault: vi.fn(),
  } as unknown as WheelEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

/** The grid point under frame point (x, y). */
const gridAt = (cam: WorkspaceCamera, x: number, y: number) => ({
  x: (x - cam.x) / cam.zoom,
  y: (y - cam.y) / cam.zoom,
})

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

describe('WorkspaceCamera', () => {
  // No requestAnimationFrame in Node: animated moves land immediately.

  it('rests with the grid origin clear of the tool card, full scale', () => {
    const cam = camera()
    expect([cam.x, cam.y, cam.zoom]).toEqual([FRAME_INSET.left, FRAME_INSET.top, ZOOM_MAX])
  })

  it('opens a fresh load showing the whole layout, centred, from the top', () => {
    // 1400 wide in an 800-wide frame: the width limits the zoom, so the
    // layout fills the room and sits at the left inset.
    const wide = camera({ left: 0, top: 0, right: 1400, bottom: 500 })
    wide.open()
    const { left, right, top, bottom } = FRAME_INSET
    expect(wide.zoom).toBeCloseTo((800 - left - right) / 1400)
    expect(wide.x).toBeCloseTo(left)
    expect(wide.y).toBeCloseTo(top)

    // Tall: the height limits the zoom, and the narrower layout is centred.
    const tall = camera({ left: 0, top: 0, right: 400, bottom: 1000 })
    tall.open()
    const zoom = (600 - top - bottom) / 1000
    const roomW = 800 - left - right
    expect(tall.zoom).toBeCloseTo(zoom)
    expect(tall.x).toBeCloseTo(left + (roomW - 400 * zoom) / 2)
    expect(tall.y).toBeCloseTo(top)
  })

  it('opens no smaller than readable, and never above full scale', () => {
    const huge = camera({ left: 0, top: 0, right: 10000, bottom: 8000 })
    huge.open()
    expect(huge.zoom).toBe(OPEN_ZOOM_MIN)

    const small = camera({ left: 0, top: 0, right: 200, bottom: 100 })
    small.open()
    expect(small.zoom).toBe(ZOOM_MAX)
  })

  it('steps zoom around the middle of the frame', () => {
    const cam = camera()
    const before = gridAt(cam, 400, 300)

    cam.out()

    expect(cam.zoom).toBeCloseTo(ZOOM_MAX - ZOOM_STEP)
    const after = gridAt(cam, 400, 300)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('clamps every zoom write, including the rail slider binding', () => {
    const cam = camera()
    cam.zoom = 99
    expect(cam.zoom).toBe(ZOOM_MAX)
    cam.zoom = -5
    expect(cam.zoom).toBe(ZOOM_MIN)
    cam.reset()
    expect(cam.zoom).toBe(ZOOM_MAX)
  })

  it('zooms around the pointer on Ctrl+wheel', () => {
    const cam = camera()
    const event = wheel({ deltaY: 100, clientX: 400, clientY: 250 })
    // Client (400, 250) is frame (300, 200).
    const before = gridAt(cam, 300, 200)

    expect(cam.wheel(event)).toBe(true)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(cam.zoom).toBeCloseTo(ZOOM_MAX - 0.1)
    const after = gridAt(cam, 300, 200)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('leaves a plain wheel to the page', () => {
    const cam = camera()
    const event = wheel({ deltaY: 100, ctrlKey: false })

    expect(cam.wheel(event)).toBe(false)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(cam.zoom).toBe(ZOOM_MAX)
  })

  it('pans freely past the origin, but keeps some of the layout in view', () => {
    const cam = camera({ left: 0, top: 0, right: 400, bottom: 300 })

    cam.panTo(300, 200)
    expect([cam.x, cam.y]).toEqual([300, 200])

    // Far right/down: the layout's left/top edge stops 120px inside the frame.
    cam.panTo(5000, 5000)
    expect([cam.x, cam.y]).toEqual([800 - 120, 600 - 120])

    // Far left/up: its right/bottom edge stops 120px inside.
    cam.panTo(-5000, -5000)
    expect([cam.x, cam.y]).toEqual([120 - 400, 120 - 300])
  })

  it('fits the whole layout in the frame, centred, never above full scale', () => {
    const cam = camera({ left: 0, top: 0, right: 1460, bottom: 530 })

    cam.fit()

    // The width left between the control insets is the limiting axis.
    const { left, right, top, bottom } = FRAME_INSET
    const roomW = 800 - left - right
    const roomH = 600 - top - bottom
    const zoom = roomW / 1460
    expect(cam.zoom).toBeCloseTo(zoom)
    expect(cam.x).toBeCloseTo(left + (roomW - 1460 * zoom) / 2)
    expect(cam.y).toBeCloseTo(top + (roomH - 530 * zoom) / 2)

    const small = camera({ left: 0, top: 0, right: 100, bottom: 100 })
    small.fit()
    expect(small.zoom).toBe(ZOOM_MAX)
  })

  it('follows a layout shift so nothing moves on screen', () => {
    const cam = camera()
    cam.zoom = 0.5
    const x = cam.x
    const y = cam.y

    cam.followShift(200, 100)

    expect(cam.x).toBeCloseTo(x - 100)
    expect(cam.y).toBeCloseTo(y - 50)
  })

  it('reveals a rectangle in the middle of the frame at the same zoom', () => {
    const cam = camera({ left: 0, top: 0, right: 4000, bottom: 4000 })

    cam.reveal({ left: 2000, top: 1000, right: 2400, bottom: 1200 })

    expect(cam.zoom).toBe(ZOOM_MAX)
    expect(cam.x + 2200).toBeCloseTo(400)
    expect(cam.y + 1100).toBeCloseTo(300)
  })

  it('pinches around the finger midpoint and pans with it', () => {
    const cam = camera()
    // Midpoint at client (500, 350) = frame (400, 300); fingers spread to 0.5×.
    const before = gridAt(cam, 400, 300)

    cam.pinch({ x: 500, y: 350 }, { x: 0, y: 0 }, 0.5)

    expect(cam.zoom).toBeCloseTo(0.5)
    const after = gridAt(cam, 400, 300)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)

    const x = cam.x
    cam.pinch({ x: 520, y: 350 }, { x: 20, y: 0 }, 1)
    expect(cam.x).toBeCloseTo(x + 20)
  })
})
