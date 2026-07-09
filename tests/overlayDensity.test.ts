/**
 * Overlay individual-line density core (evolving-metrics/core/overlayDensity).
 *
 * The overlay draws P faint participant lines as a density field: count lines per
 * pixel, then colour each pixel with the alpha P separate strokes would have
 * accumulated. These pin: correct rasterization, per-participant dedup (a single
 * line covers a pixel once, like a stroke), cross-participant accumulation, and
 * the exact 1−(1−a)ⁿ alpha curve + little-endian RGBA packing.
 */
import { describe, it, expect } from 'vitest'
import {
  rasterizeOverlayDensity,
  packOverlayDensity,
  type OverlayWindowLite,
} from '../src/lib/plots/evolving-metrics/core/overlayDensity'

// 10×10 grid, 1ms = 1px, value→row via axisMax 10 (value v → row 10 − v).
const GEOM = { width: 10, height: 10, timelineMin: 0, duration: 10, axisMax: 10 }

function part(windows: OverlayWindowLite[]) {
  return { windows }
}

function fresh() {
  return { counts: new Int32Array(100), stamp: new Int32Array(100) }
}

describe('rasterizeOverlayDensity', () => {
  it('rasterizes a single window as a horizontal run at the value row', () => {
    const { counts, stamp } = fresh()
    const max = rasterizeOverlayDensity(
      [part([{ startMs: 0, endMs: 5, value: 5 }])], // row 10−5 = 5, cols 0..5
      GEOM,
      counts,
      stamp
    )
    expect(max).toBe(1)
    for (let c = 0; c <= 5; c++) expect(counts[5 * 10 + c]).toBe(1)
    // nothing off the run
    expect(counts[4 * 10 + 0]).toBe(0)
    expect(counts[5 * 10 + 6]).toBe(0)
  })

  it('counts a pixel once per participant even when the line revisits it', () => {
    const { counts, stamp } = fresh()
    // Two contiguous windows at the same value share the boundary column (col 5).
    const max = rasterizeOverlayDensity(
      [part([
        { startMs: 0, endMs: 5, value: 5 },
        { startMs: 5, endMs: 10, value: 5 },
      ])],
      GEOM,
      counts,
      stamp
    )
    expect(max).toBe(1) // never 2 at the shared column — a stroke covers it once
    expect(counts[5 * 10 + 5]).toBe(1)
  })

  it('draws the vertical riser connecting a value change', () => {
    const { counts, stamp } = fresh()
    // value 2 then value 8 -> rows 8 then 2; riser at the boundary column spans rows 2..8.
    rasterizeOverlayDensity(
      [part([
        { startMs: 0, endMs: 5, value: 2 },
        { startMs: 5, endMs: 10, value: 8 },
      ])],
      GEOM,
      counts,
      stamp
    )
    const col = 5
    for (let r = 2; r <= 8; r++) expect(counts[r * 10 + col]).toBeGreaterThanOrEqual(1)
  })

  it('breaks the riser across a gap (non-contiguous windows)', () => {
    const { counts, stamp } = fresh()
    // A 2ms gap between windows (endMs 3 -> next startMs 5) -> no connecting riser.
    rasterizeOverlayDensity(
      [part([
        { startMs: 0, endMs: 3, value: 2 }, // row 8, cols 0..3
        { startMs: 5, endMs: 8, value: 8 }, // row 2, cols 5..8
      ])],
      GEOM,
      counts,
      stamp
    )
    // No vertical bridge at column 4/5 between rows 2 and 8.
    for (let r = 3; r <= 7; r++) {
      expect(counts[r * 10 + 4]).toBe(0)
      expect(counts[r * 10 + 5]).toBe(0)
    }
  })

  it('accumulates across participants (n lines through a pixel -> count n)', () => {
    const { counts, stamp } = fresh()
    const win = [{ startMs: 0, endMs: 5, value: 5 }]
    const max = rasterizeOverlayDensity(
      [part([...win]), part([...win]), part([...win])],
      GEOM,
      counts,
      stamp
    )
    expect(max).toBe(3)
    for (let c = 0; c <= 5; c++) expect(counts[5 * 10 + c]).toBe(3)
  })
})

describe('packOverlayDensity', () => {
  it('maps count n to the alpha n separate strokes accumulate: 1−(1−a)ⁿ', () => {
    const counts = new Int32Array([0, 1, 2, 3])
    const out = new Uint32Array(4)
    const a = 0.5
    packOverlayDensity(counts, 3, a, [210, 210, 210], out)

    const alphaByte = (v: number) => (v >>> 24) & 0xff
    const expectByte = (n: number) => (((1 - Math.pow(1 - a, n)) * 255 + 0.5) | 0)

    expect(out[0]).toBe(0) // empty pixel -> fully transparent
    expect(alphaByte(out[1])).toBe(expectByte(1)) // 0.5 -> 128
    expect(alphaByte(out[2])).toBe(expectByte(2)) // 0.75 -> 191
    expect(alphaByte(out[3])).toBe(expectByte(3)) // 0.875 -> 223
    // monotonic: more overlap -> more opaque
    expect(alphaByte(out[3])).toBeGreaterThan(alphaByte(out[2]))
    expect(alphaByte(out[2])).toBeGreaterThan(alphaByte(out[1]))
  })

  it('packs the RGB little-endian (byte0=R, byte1=G, byte2=B) for covered pixels', () => {
    const counts = new Int32Array([0, 1])
    const out = new Uint32Array(2)
    packOverlayDensity(counts, 1, 0.3, [210, 200, 190], out)
    const v = out[1]
    expect(v & 0xff).toBe(210) // R
    expect((v >>> 8) & 0xff).toBe(200) // G
    expect((v >>> 16) & 0xff).toBe(190) // B
    expect((v >>> 24) & 0xff).toBe(((1 - 0.7) * 255 + 0.5) | 0) // A for n=1, a=0.3
  })
})
