import { describe, it, expect } from 'vitest'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import { createReaderFromJson } from '../src/lib/data/binary/converters'

describe('AoiGroupReader Optimization Verification', () => {
  it('should correctly map and deduplicate AOIs', () => {
    // 1 stimulus, 1 participant, 3 segments
    // Segment 0: AOIs: 0, 1, 0, 1
    const segments = [
      [
        [
          [0, 100, 0, 0, 1, 0, 1], // AOIs: 0, 1, 0, 1
        ],
      ],
    ]

    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)

    const meta = {
      aois: {
        data: [
          [
            ['0', 'A'],
            ['1', 'B'],
          ],
        ],
        orderVector: [[0, 1]],
      },
      stimuli: { data: [['S1']] },
    }

    groupReader.updateMap(meta)

    const buffer = new Uint32Array(10)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)
    const result = Array.from(buffer.subarray(0, len))
    expect(result.sort((a, b) => a - b)).toEqual([0, 1])
  })

  it('should correctly populate buffer using Zero-Allocation API', () => {
    // Segment 0: 0, 1, 0, 1 -> Unique: 0, 1 (Length 2)
    const segments = [[[[0, 100, 0, 0, 1, 0, 1]]]]

    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)

    const meta = {
      aois: {
        data: [
          [
            ['0', 'A'],
            ['1', 'B'],
          ],
        ],
        orderVector: [[0, 1]],
      },
      stimuli: { data: [['S1']] },
    }
    groupReader.updateMap(meta)

    const buffer = new Uint32Array(10)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)

    expect(len).toBe(2)
    // Expect first two elements to be 0 and 1 (order non-deterministic in bitmask vs stamp table, but predictable)
    // Bitmask iterates 0..count. order of encountering unique: 0 then 1.
    const result = Array.from(buffer.subarray(0, len)).sort((a, b) => a - b)
    expect(result).toEqual([0, 1])
  })

  it('should fallback to stamp table for large counts or mapLen > 31', () => {
    // Force mapLen > 31.
    const numAois = 40
    const aoisDef = Array.from({ length: numAois }, (_, i) => [
      `${i}`,
      `Name${i}`,
    ])

    // Segment uses repeated AOIs including > 31.
    const segments = [
      [
        [
          [0, 100, 0, 0, 35, 0, 35, 5], // AOIs: 0, 35, 0, 35, 5 -> Unique: 0, 35, 5
        ],
      ],
    ]

    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)

    const meta = {
      aois: { data: [aoisDef] },
      stimuli: { data: [['S1']] },
    }
    groupReader.updateMap(meta)

    const buffer = new Uint32Array(50)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)

    expect(len).toBe(3)
    const result = Array.from(buffer.subarray(0, len)).sort((a, b) => a - b)
    expect(result).toEqual([0, 5, 35])
  })

  it('should handle single AOI fast path', () => {
    const segments = [[[[0, 100, 0, 5]]]]
    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)
    const meta = {
      aois: { data: [Array.from({ length: 10 }, (_, i) => [i + '', 'N' + i])] },
      stimuli: { data: [['S1']] },
    }
    groupReader.updateMap(meta)

    const buffer = new Uint32Array(10)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)
    expect(len).toBe(1)
    expect(buffer[0]).toBe(5)
  })

  it('should handle empty segments', () => {
    const segments = [[[[0, 100, 0]]]]
    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)
    groupReader.updateMap({ aois: { data: [[]] }, stimuli: { data: [['S1']] } })

    const buffer = new Uint32Array(10)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)
    expect(len).toBe(0)
  })

  it('should exclude hidden AOIs', () => {
    // Segment 0: 0, 1. But 1 is hidden.
    const segments = [[[[0, 100, 0, 0, 1]]]]
    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)

    const meta = {
      aois: {
        data: [
          [
            ['0', 'A'],
            ['1', 'B'],
          ],
        ],
        hiddenAois: [[1]], // Mark AOI 1 as hidden
      },
      stimuli: { data: [['S1']] },
    }
    groupReader.updateMap(meta)

    const buffer = new Uint32Array(10)
    const len = groupReader.getSegmentAoisUniqueDirect(0, 0, buffer)

    expect(len).toBe(1)
    expect(buffer[0]).toBe(0) // Only AOI 0 should remain

    // Also verify getAoiMapping
    const mapped0 = groupReader.getAoiMapping(0, 0)
    const mapped1 = groupReader.getAoiMapping(0, 1)

    expect(mapped0).toBe(0)
    expect(mapped1).toBe(AoiGroupReader.HIDDEN_ID)
  })

  it('should return correct metrics (order and count) for a segment (Zero-Allocation)', () => {
    // AOIs: 1, 0, 1 -> Unique: 1, 0 (Count 2)
    const segments = [[[[0, 100, 0, 1, 0, 1]]]]
    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)
    const meta: any = {
      aois: {
        data: [
          [
            ['0', 'A'],
            ['1', 'B'],
          ],
        ],
      },
      stimuli: { data: [['S1']] },
    }
    groupReader.updateMap(meta)

    const out = { order: 0, count: 0 }

    groupReader.getAoiMetricsInSegmentInto(0, 0, 1, out)
    expect(out.order).toBe(0) // order
    expect(out.count).toBe(2) // count

    groupReader.getAoiMetricsInSegmentInto(0, 0, 0, out)
    expect(out.order).toBe(1) // order
    expect(out.count).toBe(2) // count

    groupReader.getAoiMetricsInSegmentInto(0, 0, 5, out)
    expect(out.order).toBe(-1) // order
    expect(out.count).toBe(2) // count

    // Hidden test
    meta.aois.hiddenAois = [[1]]
    groupReader.updateMap(meta)
    groupReader.getAoiMetricsInSegmentInto(0, 0, 0, out)
    expect(out.order).toBe(0) // Now order 0 because 1 is hidden
    expect(out.count).toBe(1)
  })
})

describe('getSegmentAoisUniqueDirect correctness across all segment shapes', () => {
  it('correctly maps and filters segments', () => {
    // AOI ids 0..3: id2 shares name 'A' with id0 (groups to id0); id3 is hidden.
    const segments = [
      [
        [
          [0, 100, 0], //            seg0: no AOI            -> {}
          [0, 100, 0, 0], //         seg1: AOI0              -> {0}
          [0, 100, 0, 3], //         seg2: AOI3 (hidden)     -> {}
          [0, 100, 0, 0, 1, 2], //   seg3: 0,1,2 (2->A->0)   -> {0,1}
          [0, 100, 0, 0, 0, 1], //   seg4: dup 0,0,1         -> {0,1}
          [0, 100, 0, 3, 3], //      seg5: all hidden        -> {}
        ],
      ],
    ]
    const reader = createReaderFromJson(segments)
    const groupReader = new AoiGroupReader(reader)
    groupReader.updateMap({
      aois: {
        data: [[['0', 'A'], ['1', 'B'], ['2', 'A'], ['3', 'C']]],
        orderVector: [[0, 1, 2, 3]],
        hiddenAois: [[3]],
      },
      stimuli: { data: [['S1']] },
    })

    const expected = [
      [],
      [0],
      [],
      [0, 1],
      [0, 1],
      [],
    ]

    const b = new Uint32Array(16)
    for (let seg = 0; seg < 6; seg++) {
      const nNew = groupReader.getSegmentAoisUniqueDirect(seg, 0, b)
      const got = Array.from(b.subarray(0, nNew)).sort((x, y) => x - y)
      expect(nNew, `seg ${seg} count`).toBe(expected[seg].length)
      expect(got, `seg ${seg} ids`).toEqual(expected[seg])
    }
  })
})
