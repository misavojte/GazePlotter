/**
 * Overlay individual-line DENSITY rasterization (pure, canvas-free).
 *
 * The Metric Timeline overlay draws one faint step line per participant. Drawing
 * them as P separate translucent strokes means P full-plot alpha-composite passes
 * — the cost that makes overlay slow at many participants. Instead we count how
 * many participant lines cross each logical pixel and map that count to the EXACT
 * alpha those strokes would accumulate: a pixel crossed by `n` lines, each stroked
 * at alpha `a`, ends up at `1 − (1 − a)ⁿ`. Rasterizing the counts + applying that
 * curve reproduces the identical look with one blit and cost independent of P at
 * composite time.
 *
 * This module is the pure core (buffers in, buffers out); the figure owns the
 * canvas/offscreen and the final `drawImage`.
 */

/** Minimal structural view of a window the rasterizer needs. */
export interface OverlayWindowLite {
  startMs: number
  endMs: number
  value: number
}

export interface OverlayDensityGeom {
  /** Plot-area size in LOGICAL pixels (the count buffer is width × height). */
  width: number
  height: number
  /** Left edge of the time axis, in ms. */
  timelineMin: number
  /** Time span across the width, in ms (must be > 0). */
  duration: number
  /** Value at the top of the plot (bottom is 0); must be > 0. */
  axisMax: number
}

/**
 * Rasterize every participant's step line into `counts` (length `width*height`,
 * row-major), incrementing each covered pixel. A single line contributes AT MOST
 * ONCE per pixel — exactly like a stroke, whose coverage is clamped to 1 no matter
 * how many of its own segments cross a pixel — so `stamp` (same length) records
 * the participant id (1-based) that last touched each pixel and blocks
 * within-line double counting. Both buffers are zeroed here.
 *
 * The step line is horizontal runs (a window's value held from startMs..endMs)
 * joined by vertical risers at value changes; gaps (non-contiguous windows) break
 * the riser, matching the vector `drawStepLinePath`.
 *
 * @returns the maximum per-pixel count (0 if nothing was drawn).
 */
export function rasterizeOverlayDensity(
  participants: readonly { readonly windows: readonly OverlayWindowLite[] }[],
  geom: OverlayDensityGeom,
  counts: Int32Array,
  stamp: Int32Array
): number {
  const { width: W, height: H } = geom
  if (W <= 0 || H <= 0) return 0
  counts.fill(0)
  stamp.fill(0)

  const invMsPerPx = W / geom.duration
  const invAxisMax = geom.axisMax > 0 ? 1 / geom.axisMax : 0
  const timelineMin = geom.timelineMin

  let maxCount = 0
  for (let p = 0; p < participants.length; p++) {
    const wins = participants[p].windows
    if (wins.length === 0) continue
    const sid = p + 1
    let prevYi = -1
    let drawing = false
    for (let i = 0; i < wins.length; i++) {
      const w = wins[i]
      const prev = i > 0 ? wins[i - 1] : null
      const hasGap = prev !== null && Math.abs(w.startMs - prev.endMs) > 0.5
      const x0 = (w.startMs - timelineMin) * invMsPerPx
      const x1 = (w.endMs - timelineMin) * invMsPerPx
      const yF = H - w.value * invAxisMax * H
      const xi0 = x0 <= 0 ? 0 : x0 >= W ? W - 1 : x0 | 0
      const xi1 = x1 <= 0 ? 0 : x1 >= W ? W - 1 : x1 | 0
      const yi = yF <= 0 ? 0 : yF >= H ? H - 1 : yF | 0

      // Vertical riser connecting the previous value to this one (at column xi0).
      if (drawing && !hasGap && prevYi >= 0) {
        const a = prevYi < yi ? prevYi : yi
        const b = prevYi < yi ? yi : prevYi
        for (let yy = a; yy <= b; yy++) {
          const k = yy * W + xi0
          if (stamp[k] !== sid) {
            stamp[k] = sid
            const c = ++counts[k]
            if (c > maxCount) maxCount = c
          }
        }
      }

      // Horizontal run holding this window's value.
      const xa = xi0 < xi1 ? xi0 : xi1
      const xb = xi0 < xi1 ? xi1 : xi0
      const rowBase = yi * W
      for (let xx = xa; xx <= xb; xx++) {
        const k = rowBase + xx
        if (stamp[k] !== sid) {
          stamp[k] = sid
          const c = ++counts[k]
          if (c > maxCount) maxCount = c
        }
      }

      prevYi = yi
      drawing = true
    }
  }
  return maxCount
}

/**
 * Map the per-pixel `counts` to packed little-endian RGBA in `out` (length =
 * counts.length): empty pixels become fully transparent, a pixel with count `n`
 * gets `rgb` at alpha `1 − (1 − alpha)ⁿ` — the alpha `n` separate strokes of
 * `alpha` would have accumulated. `alpha` is the per-line opacity.
 */
export function packOverlayDensity(
  counts: Int32Array,
  maxCount: number,
  alpha: number,
  rgb: readonly [number, number, number],
  out: Uint32Array
): void {
  const oneMinus = 1 - alpha
  // count → 0..255 alpha byte; small table since counts share values.
  const lut = new Uint8Array(maxCount + 1)
  for (let n = 1; n <= maxCount; n++) {
    lut[n] = ((1 - Math.pow(oneMinus, n)) * 255 + 0.5) | 0
  }
  const r = rgb[0]
  const g = rgb[1]
  const b = rgb[2]
  const packedBase = (b << 16) | (g << 8) | r
  for (let k = 0; k < counts.length; k++) {
    const n = counts[k]
    out[k] = n === 0 ? 0 : (((lut[n] << 24) | packedBase) >>> 0)
  }
}
