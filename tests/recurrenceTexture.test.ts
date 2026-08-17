import { describe, it, expect } from 'vitest'
import {
  rasterizeRecurrenceTexture,
  type RecurrenceTextureInput,
} from '$lib/plots/recurrence/core/raster'

const MASK_ALPHA = 200

/** Pack rgb + alpha the way the rasterizer does. */
function p(rgb: number, a: number): number {
  return (((a << 24) | rgb) >>> 0) as number
}

function baseInput(
  n: number,
  res: number,
  matrix: number[],
  over: Partial<RecurrenceTextureInput> = {}
): RecurrenceTextureInput {
  return {
    n,
    res,
    matrix: Uint8Array.from(matrix),
    columnRgb: Uint32Array.from(
      Array.from({ length: n }, (_, j) => 0x100 * (j + 1))
    ),
    columnHasAoi: new Uint8Array(n),
    highlightMask: null,
    accentRgb: 0xaaaaaa,
    diagonalRgb: 0xcccccc,
    dimmedRgb: 0x999999,
    dimmedByte: 38,
    maskDiagonal: false,
    maskLower: false,
    ...over,
  }
}

describe('rasterizeRecurrenceTexture', () => {
  // Raw-literal anchor for the local packer: every other assertion routes
  // through p(), so without this pin a channel-order regression in the
  // rasterizer's packing would shift both sides together and pass.
  it('packs alpha into the high byte over the rgb value', () => {
    expect(p(0x000200, 255)).toBe(0xff000200)
    expect(p(0xaabbcc, 200)).toBe(0xc8aabbcc)
  })

  it('maps data row i to display row n-1-i and paints recurrent cells with the column colour', () => {
    const n = 3
    const res = 3
    // recurrent at (i=0,j=1) and (i=2,j=2)
    const m = new Array(9).fill(0)
    m[0 * n + 1] = 1
    m[2 * n + 2] = 1
    const out = new Uint32Array(res * res)
    const alpha = new Uint8Array(res * res)
    rasterizeRecurrenceTexture(baseInput(n, res, m), out, alpha)

    // (0,1) -> display row 2, x=1
    expect(out[2 * res + 1]).toBe(p(0x100 * 2, 255))
    // (2,2) -> display row 0, x=2
    expect(out[0 * res + 2]).toBe(p(0x100 * 3, 255))
    // everything else transparent
    let painted = 0
    for (const v of out) if (v !== 0) painted++
    expect(painted).toBe(2)
  })

  it('paints the diagonal with the mask colour when maskDiagonal is set', () => {
    const n = 3
    const res = 3
    const out = new Uint32Array(res * res)
    const alpha = new Uint8Array(res * res)
    rasterizeRecurrenceTexture(
      baseInput(n, res, new Array(9).fill(0), { maskDiagonal: true }),
      out,
      alpha
    )
    const mask = p(0xcccccc, MASK_ALPHA)
    expect(out[2 * res + 0]).toBe(mask) // (0,0) -> disp row 2
    expect(out[1 * res + 1]).toBe(mask) // (1,1)
    expect(out[0 * res + 2]).toBe(mask) // (2,2)
  })

  it('masks the upper triangle and lets recurrent lower cells win in the unmasked region', () => {
    const n = 3
    const res = 3
    const m = new Array(9).fill(0)
    m[0 * n + 2] = 1 // recurrent upper-triangle cell (i=0, j=2) — should be masked
    m[2 * n + 0] = 1 // recurrent lower-triangle cell (i=2, j=0) — should be drawn
    const out = new Uint32Array(res * res)
    const alpha = new Uint8Array(res * res)
    rasterizeRecurrenceTexture(
      baseInput(n, res, m, { maskDiagonal: true, maskLower: true }),
      out,
      alpha
    )
    const mask = p(0xcccccc, MASK_ALPHA)
    // recurrent upper-triangle cell (0,2) -> display row 2, x=2, is masked
    expect(out[2 * res + 2]).toBe(mask)
    // recurrent lower-triangle cell (2,0) -> display row 0, x=0, is drawn
    expect(out[0 * res + 0]).toBe(p(0x100 * 1, 255))
    // other upper-triangle cells stay masked
    expect(out[2 * res + 0]).toBe(mask) // (0,0) -> display row 2, x=0
    expect(out[2 * res + 1]).toBe(mask) // (0,1) -> display row 2, x=1
    expect(out[1 * res + 1]).toBe(mask) // (1,1) -> display row 1, x=1
    expect(out[1 * res + 2]).toBe(mask) // (1,2) -> display row 1, x=2
    expect(out[0 * res + 2]).toBe(mask) // (2,2) -> display row 0, x=2
    // non-recurrent lower triangle cells are transparent
    expect(out[0 * res + 1]).toBe(0) // (2,1) -> display row 0, x=1
    expect(out[1 * res + 0]).toBe(0) // (1,0) -> display row 1, x=0
  })

  it('collapses many cells onto one pixel keeping the strongest (max-alpha)', () => {
    const n = 2
    const res = 1 // all 4 cells map to the single pixel
    const m = [0, 1, 1, 0] // recurrent at (0,1) and (1,0)
    const out = new Uint32Array(1)
    const alpha = new Uint8Array(1)
    rasterizeRecurrenceTexture(
      baseInput(n, res, m, { maskDiagonal: true }),
      out,
      alpha
    )
    // diagonal cells contribute alpha 200; recurrent cells 255 -> 255 wins
    expect(alpha[0]).toBe(255)
    expect(out[0] >>> 24).toBe(255)
  })

  it('applies highlight accent and dims the rest', () => {
    const n = 2
    const res = 2
    const m = [1, 1, 1, 1]
    const hl = Uint8Array.from([1, 0, 0, 0]) // only (0,0) highlighted
    const out = new Uint32Array(res * res)
    const alpha = new Uint8Array(res * res)
    rasterizeRecurrenceTexture(
      baseInput(n, res, m, { highlightMask: hl }),
      out,
      alpha
    )
    // (0,0) highlighted, no AOI colour -> accent, full alpha; display row 1, x0
    expect(out[1 * res + 0]).toBe(p(0xaaaaaa, 255))
    // (0,1) not highlighted -> dimmed; display row 1, x1
    expect(out[1 * res + 1]).toBe(p(0x999999, 38))
  })

  it('clears the output buffers on each call', () => {
    const out = new Uint32Array([1, 2, 3, 4])
    const alpha = new Uint8Array([9, 9, 9, 9])
    rasterizeRecurrenceTexture(baseInput(2, 2, [0, 0, 0, 0]), out, alpha)
    expect(Array.from(out)).toEqual([0, 0, 0, 0])
    expect(Array.from(alpha)).toEqual([0, 0, 0, 0])
  })
})
