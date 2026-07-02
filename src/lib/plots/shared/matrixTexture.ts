/**
 * Pure square-matrix texture rasterizer (canvas-free, buffers in / buffers out).
 *
 * A dense N×N matrix (recurrence, AOI transitions, participant similarity,
 * metric correlation) stops being drawable cell-by-cell once cells fall below
 * ~1px: dots/arcs vanish sub-pixel, gridlines merge to a wash, and per-cell
 * `fillStyle` churn dominates. But the ANALYTICAL payoff of these matrices is
 * the pattern (blocks, clusters, diagonal structure), which survives at any
 * size if drawn as a crisp texture. So the figure packs one RGBA per DISPLAY
 * cell (row 0 = top) into `cellPacked`, this tiles it into a gridPx×gridPx
 * pixel buffer, and the figure blits it in one `drawImage`.
 *
 * Cells larger than a pixel fill a pixel BLOCK (crisp, gap-free, since block
 * edges snap to the same integer boundary for adjacent cells). When N exceeds
 * gridPx many cells collapse onto one pixel; the highest-alpha (strongest) cell
 * wins, preserving the texture rather than an arbitrary last-write.
 *
 * The figure owns the offscreen canvas + `putImageData`/`drawImage`; this
 * module is the pure core so it can be unit-tested with plain typed arrays.
 */

/** Pack an {r,g,b} triple into a little-endian RGB int (alpha byte left 0). */
export function packRgb(c: { r: number; g: number; b: number }): number {
  return ((c.b << 16) | (c.g << 8) | c.r) >>> 0
}

/**
 * Tile `cellPacked` (length n*n, row-major, DISPLAY orientation — index
 * `row*n + col`, row 0 at the top) into `out` (length gridPx*gridPx, row-major
 * little-endian RGBA). `cellPacked` entries are packed RGBA; a value of 0 is a
 * transparent/skipped cell (the figure's background shows through). `alphaScratch`
 * (same length as `out`) tracks the winning alpha per pixel for the collapse
 * case. Both `out` and `alphaScratch` are zeroed here.
 */
export function rasterizeSquareMatrix(
  n: number,
  gridPx: number,
  cellPacked: Uint32Array,
  out: Uint32Array,
  alphaScratch: Uint8Array
): void {
  out.fill(0)
  alphaScratch.fill(0)
  if (n <= 0 || gridPx <= 0) return
  const scale = gridPx / n
  for (let r = 0; r < n; r++) {
    const gy0 = Math.floor(r * scale)
    if (gy0 >= gridPx) break
    let gy1 = Math.floor((r + 1) * scale)
    if (gy1 <= gy0) gy1 = gy0 + 1
    if (gy1 > gridPx) gy1 = gridPx
    const rowBase = r * n
    for (let c = 0; c < n; c++) {
      const packed = cellPacked[rowBase + c]
      if (packed === 0) continue
      const aByte = packed >>> 24
      const gx0 = Math.floor(c * scale)
      let gx1 = Math.floor((c + 1) * scale)
      if (gx1 <= gx0) gx1 = gx0 + 1
      if (gx1 > gridPx) gx1 = gridPx
      for (let y = gy0; y < gy1; y++) {
        const base = y * gridPx
        for (let x = gx0; x < gx1; x++) {
          const idx = base + x
          if (aByte > alphaScratch[idx]) {
            out[idx] = packed
            alphaScratch[idx] = aByte
          }
        }
      }
    }
  }
}
