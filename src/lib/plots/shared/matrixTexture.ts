/** Pack an {r,g,b} triple into a little-endian RGB int (alpha byte left 0). */
export function packRgb(c: { r: number; g: number; b: number }): number {
  return ((c.b << 16) | (c.g << 8) | c.r) >>> 0
}
