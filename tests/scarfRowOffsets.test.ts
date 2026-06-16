import { describe, it, expect } from 'vitest'
import { buildRectRowOffsets } from '../src/lib/plots/scarf/core/transformer'
import { RECT_STRIDE } from '../src/lib/plots/scarf/const'

// `buildRectRowOffsets` powers the scarf hover hit-test: instead of scanning the
// whole segment buffer per pointer move, the hit-test scans only the hovered
// row's slice [rowStart[r], rowStart[r + 1]). These tests pin that the slice is
// EXACTLY the set of segments whose participantIndex == r, which is the property
// the hit-test relies on. Buffers always have a non-decreasing pIndex column
// (the transformer fills them in ascending participant order), so the inputs
// here respect that invariant.

/** Build a rect bucket whose segments carry the given per-segment row indices
 *  (must be non-decreasing). Other columns get arbitrary-but-set values. */
function bucketFromRows(rowsPerSeg: number[]): Float32Array {
  const buf = new Float32Array(rowsPerSeg.length * RECT_STRIDE)
  for (let i = 0; i < rowsPerSeg.length; i++) {
    const idx = i * RECT_STRIDE
    buf[idx] = (i % 50) / 50 // x
    buf[idx + 1] = rowsPerSeg[i] // participant row index
    buf[idx + 2] = 0.01 // width
  }
  return buf
}

/** Reference: the segment indices of row r, by brute-force filter. */
function rowSegmentsReference(buffer: Float32Array, r: number): number[] {
  const out: number[] = []
  const segCount = buffer.length / RECT_STRIDE
  for (let i = 0; i < segCount; i++) {
    if (buffer[i * RECT_STRIDE + 1] === r) out.push(i)
  }
  return out
}

function sliceIndices(rowStart: Int32Array, r: number): number[] {
  const out: number[] = []
  for (let i = rowStart[r]; i < rowStart[r + 1]; i++) out.push(i)
  return out
}

function expectPartitions(buffer: Float32Array, rows: number): void {
  const [rowStart] = buildRectRowOffsets([buffer], rows)
  // Boundaries: starts at 0, ends at segment count, monotonic non-decreasing.
  expect(rowStart[0]).toBe(0)
  expect(rowStart[rows]).toBe(buffer.length / RECT_STRIDE)
  for (let r = 0; r < rows; r++) {
    expect(rowStart[r + 1]).toBeGreaterThanOrEqual(rowStart[r])
  }
  // Each row's slice equals exactly the brute-force set for that row.
  for (let r = 0; r < rows; r++) {
    expect(sliceIndices(rowStart, r)).toEqual(rowSegmentsReference(buffer, r))
  }
}

describe('buildRectRowOffsets', () => {
  it('handles an empty bucket', () => {
    const [rowStart] = buildRectRowOffsets([new Float32Array(0)], 5)
    expect(Array.from(rowStart)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('partitions a simple contiguous-by-row bucket', () => {
    expectPartitions(bucketFromRows([0, 0, 1, 1, 1, 2]), 3)
  })

  it('handles rows with no segments (gaps in the row sequence)', () => {
    // No segments for rows 1 and 3 -> empty slices, boundaries still correct.
    expectPartitions(bucketFromRows([0, 0, 2, 2, 4]), 5)
  })

  it('handles a single row holding every segment', () => {
    expectPartitions(bucketFromRows([2, 2, 2, 2]), 4)
  })

  it('handles the last row being empty', () => {
    expectPartitions(bucketFromRows([0, 1, 1]), 4) // rows 2,3 empty
  })

  it('keeps each bucket independent in a multi-bucket call', () => {
    const a = bucketFromRows([0, 1, 1, 2])
    const b = bucketFromRows([0, 0, 0, 3])
    const [oa, ob] = buildRectRowOffsets([a, b], 4)
    for (let r = 0; r < 4; r++) {
      expect(sliceIndices(oa, r)).toEqual(rowSegmentsReference(a, r))
      expect(sliceIndices(ob, r)).toEqual(rowSegmentsReference(b, r))
    }
  })

  it('matches the reference across randomized non-decreasing buckets', () => {
    let seed = 0x51a7c0de
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const pick = (n: number) => Math.floor(rnd() * n)

    for (let trial = 0; trial < 300; trial++) {
      const rows = 1 + pick(40)
      const segCount = pick(400)
      // Build a non-decreasing row sequence (the transformer's invariant): walk
      // rows upward, emitting a random number of segments per row (incl. zero).
      const rowsPerSeg: number[] = []
      let r = 0
      while (rowsPerSeg.length < segCount && r < rows) {
        const k = pick(6)
        for (let c = 0; c < k && rowsPerSeg.length < segCount; c++) {
          rowsPerSeg.push(r)
        }
        r++
      }
      expectPartitions(bucketFromRows(rowsPerSeg), rows)
    }
  })
})
