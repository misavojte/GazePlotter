import { describe, expect, it } from 'vitest'
import type { DataType } from '../src/lib/data/types'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import {
  generateMetadataForBatchCsv,
  generateUnifiedCsv,
} from '../src/lib/data/export/mappers/segments'

function createData(segments: DataType['segments']): DataType {
  return {
    isOrdinalOnly: false,
    stimuli: {
      data: [['Stimulus A', 'Stimulus A']],
      orderVector: [0],
    },
    participants: {
      data: [['Participant A', 'Participant A']],
      orderVector: [0],
    },
    participantsGroups: [],
    categories: {
      data: [['Fixation', 'Fixation', '#000000']],
      orderVector: [0],
    },
    noAoiTreatment: {
      displayedName: 'No AOI',
      color: '#cbd5e1',
    },
    aois: {
      data: [[['AOI 1', 'AOI 1', '#ff0000']]],
      orderVector: [[0]],
      hiddenAois: [[]],
    },
    segments,
    eventData: {
      data: [[]],
      orderVector: [],
      hiddenChannels: [],
      events: [[]],
    },
  }
}

describe('segmented export spatial columns', () => {
  it('exports legacy segmented CSV columns when no spatial data is available', () => {
    const segmentsJson: number[][][][] = [[[[0, 100, 0, 0]]]]
    const data = createData(jsonSegmentsToBinary(segmentsJson))

    const csv = generateUnifiedCsv(data)
    const lines = csv.split('\n')

    expect(lines[0]).toBe(
      'stimulus,participant,timestamp,duration,eyemovementtype,AOI'
    )
    expect(lines[1]).toBe('Stimulus A,Participant A,0,100,0,AOI 1')
  })

  it('exports x and y columns for segmented CSV when spatial data exists', () => {
    const segmentsJson: number[][][][] = [
      [
        [
          [0, 100, 0, 0],
          [100, 200, 0],
        ],
      ],
    ]
    const spatialData: (number[] | null)[][][] = [[[[10, 20], null]]]
    const data = createData(
      jsonSegmentsToBinary(segmentsJson, undefined, spatialData)
    )

    const csv = generateUnifiedCsv(data)
    const lines = csv.split('\n')

    expect(lines[0]).toBe(
      'stimulus,participant,timestamp,duration,eyemovementtype,AOI,x,y'
    )
    expect(lines[1]).toBe('Stimulus A,Participant A,0,100,0,AOI 1,10,20')
    expect(lines[2]).toBe('Stimulus A,Participant A,100,100,0,,,')
  })

  it('exports batch CSV with x/y columns when spatial data exists', () => {
    const segmentsJson: number[][][][] = [[[[0, 100, 0, 0]]]]
    const spatialData: (number[] | null)[][][] = [[[[15, 25]]]]
    const data = createData(
      jsonSegmentsToBinary(segmentsJson, undefined, spatialData)
    )

    const batch = generateMetadataForBatchCsv(data)

    expect(batch).toHaveLength(1)
    const lines = batch[0].content.split('\n')

    expect(lines[0]).toBe('timestamp,duration,eyemovementtype,AOI,x,y')
    expect(lines[1]).toBe('0,100,0,AOI 1,15,25')
  })
})
