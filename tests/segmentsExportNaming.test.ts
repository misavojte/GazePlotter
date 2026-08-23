import { describe, expect, it } from 'vitest'
import type { DataType } from '../src/lib/data/types'
import { makeDataType } from './helpers/dataTypeFixtures'
import { generateUnifiedCsv } from '../src/lib/data/export/mappers/segments'

/**
 * One segment referencing three AOIs:
 * - AOI 0 "Left" and AOI 1 "Right" share the displayed name "Region" (grouped)
 * - AOI 2 "Top" is displayed as "Top Area"
 * Category 0 is imported as "Fixation" but renamed (displayed) to "Gaze".
 */
function createData(): DataType {
  return makeDataType([[[[0, 100, 0, 0, 1, 2]]]], {
    stimuli: { data: [['S1', 'StimulusOne']], orderVector: [0] },
    participants: { data: [['P1', 'ParticipantOne']], orderVector: [0] },
    metricInstances: [],
    categories: { data: [['Fixation', 'Gaze', '#000000']], orderVector: [0] },
    aois: {
      data: [
        [
          ['Left', 'Region', '#ff0000'],
          ['Right', 'Region', '#00ff00'],
          ['Top', 'Top Area', '#0000ff'],
        ],
      ],
      orderVector: [[0, 1, 2]],
    },
  })
}

describe('segment export naming', () => {
  it('displayed (default): renamed category, grouped+deduped AOIs, displayed stimulus/participant', () => {
    const lines = generateUnifiedCsv(createData()).split('\n')
    expect(lines[1]).toBe('StimulusOne,ParticipantOne,0,100,Gaze,Region;Top Area')
  })

  it('raw: original category name, every AOI listed, no grouping, raw stimulus/participant', () => {
    const lines = generateUnifiedCsv(
      createData(),
      undefined,
      undefined,
      false,
      undefined,
      'raw'
    ).split('\n')
    expect(lines[1]).toBe('S1,P1,0,100,Fixation,Left;Right;Top')
  })
})
