import { describe, it, expect } from 'vitest'
import { packRgb, rasterizeSquareMatrix } from '$lib/plots/shared/matrixTexture'

/** Build a packed little-endian RGBA int the way the figures do. */
function packed(r: number, g: number, b: number, a = 255): number {
  return (((a << 24) | (b << 16) | (g << 8) | r) >>> 0) as number
}

describe('packRgb', () => {
  it('packs r,g,b little-endian with a zero alpha byte', () => {
    expect(packRgb({ r: 0x12, g: 0x34, b: 0x56 })).toBe(0x563412)
  })
})

describe('rasterizeSquareMatrix', () => {
  it('tiles each cell into a gap-free pixel block when n < gridPx', () => {
    const n = 2
    const gridPx = 4
    const A = packed(10, 0, 0)
    const B = packed(0, 0, 20)
    // display: row0 = [A, 0], row1 = [0, B]
    const cellPacked = new Uint32Array([A, 0, 0, B])
    const out = new Uint32Array(gridPx * gridPx).fill(0xdead) // garbage, must be cleared
    const alpha = new Uint8Array(gridPx * gridPx)
    rasterizeSquareMatrix(n, gridPx, cellPacked, out, alpha)

    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      expect(out[y * gridPx + x]).toBe(A)
    }
    for (const [x, y] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]) {
      expect(out[y * gridPx + x]).toBe(B)
    }
    expect(out[0 * gridPx + 2]).toBe(0) // top-right cell is transparent
    expect(out[2 * gridPx + 0]).toBe(0) // bottom-left cell is transparent
  })

  it('leaves no gaps when gridPx is not a multiple of n', () => {
    const n = 3
    const gridPx = 10
    const C = packed(5, 5, 5)
    const cp = new Uint32Array(n * n)
    cp[0 * n + 0] = C
    cp[1 * n + 0] = C
    cp[2 * n + 0] = C // display column 0, every row
    const out = new Uint32Array(gridPx * gridPx)
    const alpha = new Uint8Array(gridPx * gridPx)
    rasterizeSquareMatrix(n, gridPx, cp, out, alpha)

    for (let y = 0; y < gridPx; y++) expect(out[y * gridPx + 0]).toBe(C)
  })

  it('keeps the highest-alpha cell when several collapse onto one pixel', () => {
    const n = 4
    const gridPx = 2 // scale 0.5: display cols 0 and 1 both map to pixel x=0
    const lo = packed(1, 2, 3, 100)
    const hi = packed(9, 8, 7, 200)

    const forward = new Uint32Array(n * n)
    forward[0] = lo
    forward[1] = hi
    let out = new Uint32Array(gridPx * gridPx)
    let alpha = new Uint8Array(gridPx * gridPx)
    rasterizeSquareMatrix(n, gridPx, forward, out, alpha)
    expect(out[0]).toBe(hi)
    expect(alpha[0]).toBe(200)

    // order-independent: hi written first, lo second, hi still wins
    const reverse = new Uint32Array(n * n)
    reverse[0] = hi
    reverse[1] = lo
    out = new Uint32Array(gridPx * gridPx)
    alpha = new Uint8Array(gridPx * gridPx)
    rasterizeSquareMatrix(n, gridPx, reverse, out, alpha)
    expect(out[0]).toBe(hi)
  })

  it('treats a packed 0 as transparent and clears prior buffer contents', () => {
    const n = 2
    const gridPx = 2
    const A = packed(10, 20, 30)
    const cp = new Uint32Array([A, 0, 0, 0]) // only display cell (0,0)
    const out = new Uint32Array([1, 2, 3, 4]) // garbage
    const alpha = new Uint8Array([9, 9, 9, 9])
    rasterizeSquareMatrix(n, gridPx, cp, out, alpha)
    expect(out[0]).toBe(A)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(0)
    expect(out[3]).toBe(0)
  })
})
