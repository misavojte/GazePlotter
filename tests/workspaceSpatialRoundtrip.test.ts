import { describe, expect, it } from 'vitest'
import type { DataType } from '../src/lib/data/types'
import {
  jsonSegmentsToBinary,
  BinaryBufferReader,
} from '../src/lib/data/binary'
import { generateWorkspaceJson } from '../src/lib/data/export/mappers/workspace'
import { processJsonFileWithGrid } from '../src/lib/data/ingest/workspace/parser'

function buildBaseData(segments: DataType['segments']): DataType {
  return {
    isOrdinalOnly: false,
    stimuli: {
      data: [['Stimulus 1', 'Stimulus 1']],
      orderVector: [0],
    },
    participants: {
      data: [['Participant 1', 'Participant 1']],
      orderVector: [0],
    },
    participantsGroups: [],
    categories: {
      data: [['Category 1', 'Category 1', '#000000']],
      orderVector: [0],
    },
    noAoiTreatment: {
      displayedName: 'No AOI',
      color: '#cbd5e1',
    },
    aois: {
      data: [[['AOI 1', 'AOI 1', '#ff0000']]],
      orderVector: [[0]],
      dynamicVisibility: {},
      hiddenAois: [[]],
    },
    segments,
  }
}

describe('Workspace spatialData roundtrip', () => {
  it('exports and re-ingests optional spatialData when present', () => {
    const jsonSegments: number[][][][] = [
      [
        [
          [0, 100, 0, 0],
          [100, 200, 0],
        ],
      ],
    ]
    const spatialData: (number[] | null)[][][] = [[[[25, 35], null]]]

    const data = buildBaseData(
      jsonSegmentsToBinary(jsonSegments, undefined, spatialData)
    )

    const workspaceJson = generateWorkspaceJson(data, [], null)
    const parsedPayload = JSON.parse(workspaceJson)

    expect(parsedPayload.data.spatialData).toEqual(spatialData)

    const processed = processJsonFileWithGrid(workspaceJson)
    expect(processed.data.segments.hasSpatialData).toBe(true)

    const reader = new BinaryBufferReader(processed.data.segments)
    const range = reader.getSegmentRange(0, 0)
    expect(reader.getSegmentSpatial(range.startIndex)).toEqual({ x: 25, y: 35 })
    expect(reader.getSegmentSpatial(range.startIndex + 1)).toBeNull()
  })

  it('keeps legacy payload shape when spatialData is absent', () => {
    const jsonSegments: number[][][][] = [[[[0, 100, 0, 0]]]]

    const data = buildBaseData(jsonSegmentsToBinary(jsonSegments))

    const workspaceJson = generateWorkspaceJson(data, [], null)
    const parsedPayload = JSON.parse(workspaceJson)

    expect(parsedPayload.data.spatialData).toBeUndefined()

    const processed = processJsonFileWithGrid(workspaceJson)
    expect(processed.data.segments.hasSpatialData).toBe(false)

    const reader = new BinaryBufferReader(processed.data.segments)
    const range = reader.getSegmentRange(0, 0)
    expect(reader.getSegmentSpatial(range.startIndex)).toBeNull()
  })
})
