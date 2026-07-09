/**
 * Pure recurrence-matrix texture rasterizer (canvas-free, buffers in / out).
 *
 * The recurrence matrix is N×N for N fixations, and N reaches the thousands, so
 * N² is tens of millions of cells. Building an N×N intermediate buffer or
 * re-scanning it on every resize is far too slow. Instead the figure rasterizes
 * ONCE per data/appearance change into a fixed-resolution texture (this
 * function) and then just scales that texture on resize.
 *
 * Each cell scatters into its pixel BLOCK of `out` (res×res, row-major
 * little-endian RGBA). When N > res many cells collapse onto one pixel and the
 * highest-alpha (strongest) cell wins — a max-pool that preserves diagonal /
 * block structure rather than dropping it (nearest-sampling would break thin
 * diagonals). Data row i maps to DISPLAY row N-1-i: recurrence's origin is
 * bottom-left, the buffer is top-down.
 *
 * Duration weighting is intentionally NOT applied here (it is invisible once
 * cells fall below a pixel); the readable dot renderer still shows it. Colours
 * come pre-packed from the figure so this stays a tight numeric loop.
 */
export interface RecurrenceTextureInput {
  /** Fixation count (matrix is n×n). */
  n: number
  /** Output texture side length in pixels (res×res). */
  res: number
  /** Flat n×n binary matrix (1 = recurrent). */
  matrix: Uint8Array
  /** Per-column base colour packed as little-endian RGB (length n). */
  columnRgb: Uint32Array
  /** 1 where the column has an AOI colour (length n). */
  columnHasAoi: Uint8Array
  /** Active highlight mask (flat n×n) or null when no highlight. */
  highlightMask: Uint8Array | null
  /** Accent RGB (packed) for highlighted non-AOI cells. */
  accentRgb: number
  /** Diagonal / mask fill RGB (packed). */
  diagonalRgb: number
  /** Dimmed RGB (packed) for non-highlighted cells. */
  dimmedRgb: number
  /** Alpha byte (0..255) for dimmed cells. */
  dimmedByte: number
  /** Paint the main diagonal as the mask colour. */
  maskDiagonal: boolean
  /** Mask the whole upper triangle (cols j ≥ i) as the mask colour. */
  maskLower: boolean
}

// Mask fill sits just under full opacity so a recurrent cell sharing its pixel
// (after collapse) always wins, matching the dot renderer's painter order.
const MASK_ALPHA = 200

export function rasterizeRecurrenceTexture(
  input: RecurrenceTextureInput,
  out: Uint32Array,
  alphaScratch: Uint8Array
): void {
  out.fill(0)
  alphaScratch.fill(0)
  const {
    n,
    res,
    matrix,
    columnRgb,
    columnHasAoi,
    highlightMask,
    accentRgb,
    dimmedRgb,
    dimmedByte,
    maskDiagonal,
    maskLower,
  } = input
  if (n <= 0 || res <= 0) return

  const scale = res / n
  const maskPacked = ((MASK_ALPHA << 24) | input.diagonalRgb) >>> 0

  for (let i = 0; i < n; i++) {
    const gy0 = Math.floor((n - 1 - i) * scale)
    let gy1 = Math.floor((n - i) * scale)
    if (gy1 <= gy0) gy1 = gy0 + 1
    if (gy1 > res) gy1 = res
    const rowOffset = i * n

    // maskLower: gray the whole upper triangle (cols j ≥ i) as one pixel run;
    // recurrent cells (j > i) overwrite below since they carry higher alpha.
    if (maskLower) {
      const mx0 = Math.floor(i * scale)
      for (let y = gy0; y < gy1; y++) {
        const base = y * res
        for (let x = mx0; x < res; x++) {
          if (MASK_ALPHA > alphaScratch[base + x]) {
            out[base + x] = maskPacked
            alphaScratch[base + x] = MASK_ALPHA
          }
        }
      }
    }

    const jEnd = maskLower ? i : n
    for (let j = 0; j < jEnd; j++) {
      let packed = 0
      let aByte = 0
      if (maskDiagonal && i === j) {
        packed = maskPacked
        aByte = MASK_ALPHA
      } else {
        if (matrix[rowOffset + j] === 0) continue
        let rgb = columnRgb[j]
        aByte = 255
        if (highlightMask) {
          if (highlightMask[rowOffset + j]) {
            if (columnHasAoi[j] === 0) rgb = accentRgb
          } else {
            rgb = dimmedRgb
            aByte = dimmedByte
          }
        }
        packed = ((aByte << 24) | rgb) >>> 0
      }

      const gx0 = Math.floor(j * scale)
      let gx1 = Math.floor((j + 1) * scale)
      if (gx1 <= gx0) gx1 = gx0 + 1
      if (gx1 > res) gx1 = res
      for (let y = gy0; y < gy1; y++) {
        const base = y * res
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
