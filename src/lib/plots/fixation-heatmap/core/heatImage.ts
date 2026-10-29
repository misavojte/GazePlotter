/**
 * The heat image's colour encoding, canvas-free: one RGBA lookup table maps a
 * map value to colour + alpha (the heat, or the opacity map's mask), and the
 * legend ramp is sampled from the SAME table, so the key can never disagree
 * with the map.
 */
import { hexToRgb, rgbToHex, samplePalette } from '$lib/color'
import { FIXATION_HEATMAP_LAYOUT as L } from '../const'

/** Alpha share at scale position t: a smoothstep fade-in over the bottom `fadeTop`. */
export function fadeIn(t: number): number {
  const x = Math.min(1, Math.max(0, t / L.fadeTop))
  return x * x * (3 - 2 * x)
}

/** Packed little-endian RGBA (ImageData byte order) per scale position 0..1. */
export function heatLut(stops: readonly string[], opacity: number, size: number = L.lutSize): Uint32Array {
  const lut = new Uint32Array(size)
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1)
    const { r, g, b } = hexToRgb(samplePalette(stops, t))
    const a = Math.round(255 * opacity * fadeIn(t))
    lut[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
  }
  return lut
}

/** The opacity map's table: the mask colour at `opacity` for 0, clearing linearly to nothing at the top. */
export function maskLut(color: string, opacity: number, size: number = L.lutSize): Uint32Array {
  const lut = new Uint32Array(size)
  const { r, g, b } = hexToRgb(color)
  for (let i = 0; i < size; i++) {
    const a = Math.round(255 * opacity * (1 - i / (size - 1)))
    lut[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
  }
  return lut
}

/** Paint grid values into `out` pixels; values at or above `top` take the top colour, 0 takes `zero` (clear for the heat). */
export function paintHeat(values: Float32Array, top: number, lut: Uint32Array, out: Uint32Array, zero: number = 0): void {
  const last = lut.length - 1
  const scale = top > 0 ? last / top : 0
  for (let k = 0; k < values.length; k++) {
    const v = values[k]
    out[k] = v > 0 ? lut[v >= top ? last : (v * scale) | 0] : zero
  }
}

/** `count` evenly spaced LUT colours composited over white: the legend bar as the map shows it on paper. */
export function legendRamp(lut: Uint32Array, count: number = L.legendStops): string[] {
  const ramp: string[] = []
  const last = lut.length - 1
  for (let i = 0; i < count; i++) {
    const c = lut[Math.round((i / (count - 1)) * last)]
    const a = (c >>> 24) / 255
    const over = (channel: number) => 255 + (channel - 255) * a
    ramp.push(rgbToHex(over(c & 0xff), over((c >>> 8) & 0xff), over((c >>> 16) & 0xff)))
  }
  return ramp
}
