/**
 * Roundtrip tests for binary converters.
 * Ensures JSON → binary → JSON produces identical results.
 */

import { describe, it, expect } from 'vitest'
import {
  jsonSegmentsToBinary,
  binarySegmentsToJson,
  validateRoundtrip,
  createReaderFromJson,
} from '../src/lib/data/binary/converters'

describe('Binary Converters Roundtrip', () => {
  it('should handle empty segments', () => {
    const empty: number[][][][] = []
    const result = validateRoundtrip(empty)
    expect(result).toBe(true)
  })

  it('should handle single segment without AOIs', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0], // start, end, category
        ],
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle single segment with one AOI', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0, 5], // start, end, category, aoiId
        ],
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle segment with multiple AOIs', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0, 5, 7, 9], // start, end, category, aoiId1, aoiId2, aoiId3
        ],
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle multiple segments per participant', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0, 5],
          [100, 200, 1, 7, 9],
          [200, 300, 0],
        ],
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle multiple participants', () => {
    const segments: number[][][][] = [
      [
        [[0, 100, 0, 5]], // Participant 0
        [[0, 150, 1, 7, 9]], // Participant 1
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle multiple stimuli', () => {
    const segments: number[][][][] = [
      // Stimulus 0
      [[[0, 100, 0, 5]]],
      // Stimulus 1
      [[[0, 200, 1, 7, 9]]],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should handle complex dataset with varying segments per participant', () => {
    const segments: number[][][][] = [
      // Stimulus 0: 3 participants (all present)
      [
        [
          [0, 100, 0, 5],
          [100, 200, 1],
        ],
        [[0, 150, 0, 7, 9, 11]],
        [[50, 100, 1]],
      ],
      // Stimulus 1: 3 participants (third is empty)
      [
        [[0, 300, 0, 1, 2, 3, 4]],
        [
          [100, 200, 1],
          [200, 400, 0, 6],
        ],
        [], // Empty participant
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should preserve floating point precision', () => {
    const segments: number[][][][] = [[[[0.123456789, 100.987654321, 0, 5]]]]

    const buffers = jsonSegmentsToBinary(segments)
    const converted = binarySegmentsToJson(buffers)

    // Check that values are preserved within Float32Array precision (~7 decimal digits)
    // Float32 has ~6-7 significant decimal digits of precision
    expect(Math.abs(converted[0][0][0][0] - 0.123456789)).toBeLessThan(1e-5)
    expect(Math.abs(converted[0][0][0][1] - 100.987654321)).toBeLessThan(1e-4)
  })

  it('should handle participants with no segments', () => {
    const segments: number[][][][] = [
      [
        [[0, 100, 0, 5]], // Participant 0 has segments
        [], // Participant 1 has no segments
      ],
    ]
    const result = validateRoundtrip(segments)
    expect(result).toBe(true)
  })

  it('should correctly populate index table', () => {
    const segments: number[][][][] = [
      [
        [[0, 100, 0]], // Participant 0: 1 segment
        [
          [0, 50, 0],
          [50, 100, 1],
        ], // Participant 1: 2 segments
      ],
    ]

    const buffers = jsonSegmentsToBinary(segments)

    // Check index table for participant 0 (stimulus 0)
    expect(buffers.indexTable[0]).toBe(0) // start
    expect(buffers.indexTable[1]).toBe(1) // end (1 segment)

    // Check index table for participant 1 (stimulus 0)
    expect(buffers.indexTable[2]).toBe(1) // start
    expect(buffers.indexTable[3]).toBe(3) // end (2 segments)
  })

  it('should correctly populate AOI pool', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0, 5, 7], // 2 AOIs
          [100, 200, 1, 9], // 1 AOI
        ],
      ],
    ]

    const buffers = jsonSegmentsToBinary(segments)

    // AOI pool should contain: [5, 7, 9]
    expect(buffers.aoiPool.length).toBe(3)
    expect(buffers.aoiPool[0]).toBe(5)
    expect(buffers.aoiPool[1]).toBe(7)
    expect(buffers.aoiPool[2]).toBe(9)
  })

  it('should create reader with correct segment access', () => {
    const segments: number[][][][] = [
      [
        [
          [0, 100, 0, 5],
          [100, 200, 1, 7, 9],
        ],
      ],
    ]

    const reader = createReaderFromJson(segments)

    // Check segment count
    expect(reader.getSegmentCount(0, 0)).toBe(2)

    // Check first segment
    const range = reader.getSegmentRange(0, 0)
    expect(reader.getSegmentStart(range.startIndex)).toBe(0)
    expect(reader.getSegmentEnd(range.startIndex)).toBe(100)
    expect(reader.getSegmentCategory(range.startIndex)).toBe(0)
    expect(reader.getSegmentAoiCount(range.startIndex)).toBe(1)

    // Check second segment
    expect(reader.getSegmentStart(range.startIndex + 1)).toBe(100)
    expect(reader.getSegmentEnd(range.startIndex + 1)).toBe(200)
    expect(reader.getSegmentCategory(range.startIndex + 1)).toBe(1)
    expect(reader.getSegmentAoiCount(range.startIndex + 1)).toBe(2)
  })

  it('should handle large dataset efficiently', () => {
    // Create a dataset with many segments
    const numStimuli = 5
    const numParticipants = 10
    const segmentsPerParticipant = 100

    const segments: number[][][][] = []

    for (let s = 0; s < numStimuli; s++) {
      const stimulus: number[][][] = []
      for (let p = 0; p < numParticipants; p++) {
        const participantSegs: number[][] = []
        for (let i = 0; i < segmentsPerParticipant; i++) {
          const start = i * 100
          const end = start + 50
          const category = i % 2
          const aois = i % 3 === 0 ? [1, 2] : [3]
          participantSegs.push([start, end, category, ...aois])
        }
        stimulus.push(participantSegs)
      }
      segments.push(stimulus)
    }

    const startTime = performance.now()
    const result = validateRoundtrip(segments)
    const endTime = performance.now()

    expect(result).toBe(true)

    // Conversion should be reasonably fast (< 100ms for 5000 segments)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('should maintain segment order within participants', () => {
    const segments: number[][][][] = [
      [
        [
          [100, 200, 0],
          [0, 50, 1],
          [200, 300, 0],
          [50, 100, 1],
        ],
      ],
    ]

    const buffers = jsonSegmentsToBinary(segments)
    const converted = binarySegmentsToJson(buffers)

    // Segment order should be preserved exactly
    for (let i = 0; i < segments[0][0].length; i++) {
      expect(converted[0][0][i]).toEqual(segments[0][0][i])
    }
  })
})
