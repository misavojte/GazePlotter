import { describe, it, expect } from 'vitest'
import { packRgb } from '$lib/plots/shared/matrixTexture'

describe('packRgb', () => {
  it('packs r,g,b little-endian with a zero alpha byte', () => {
    expect(packRgb({ r: 0x12, g: 0x34, b: 0x56 })).toBe(0x563412)
  })
})
