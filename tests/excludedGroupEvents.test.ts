import { describe, it, expect } from 'vitest'
import { DatasetBuilder } from '$lib/data/ingest/kernel/sink'
import type { ParseSettings } from '$lib/data/ingest/types'

const settings: ParseSettings = {
  rowDelimiter: '\n',
  columnDelimiter: ',',
  encoding: 'utf-8',
  type: 'test',
  userInputSetting: '',
  headerRowId: 0,
}

describe('DatasetBuilder — excluded-group event accounting', () => {
  it('counts and warns when events are dropped with an excluded interval group', () => {
    const builder = new DatasetBuilder()
    builder.beginFile(settings)
    // A (S1,P1) segment so the dataset has a stimulus + participant, plus an
    // event timed against the SAME group — which is then excluded.
    builder.addSegment({
      start: '0',
      end: '100',
      stimulus: 'S1',
      participant: 'P1',
      category: 'Fixation',
      aoi: null,
    })
    builder.addEvent({
      stimulus: 'S1',
      participant: 'P1',
      channel: 'marker',
      start: 10,
      duration: 0,
    })
    builder.recordExclusion('S1', 'P1', [{ kind: 'double-start', timeSeconds: 0 }])

    builder.buildFinalData()

    // The drop must be surfaced (parity with segment-exclusion reporting), not
    // silent.
    expect(
      builder.warnings.some(w =>
        /event\(s\) belonged to excluded interval group/.test(w)
      )
    ).toBe(true)
  })

  it('does not warn when no events fall in an excluded group', () => {
    const builder = new DatasetBuilder()
    builder.beginFile(settings)
    builder.addSegment({
      start: '0',
      end: '100',
      stimulus: 'S1',
      participant: 'P1',
      category: 'Fixation',
      aoi: null,
    })
    builder.addEvent({
      stimulus: 'S1',
      participant: 'P1',
      channel: 'marker',
      start: 10,
      duration: 0,
    })

    builder.buildFinalData()

    expect(
      builder.warnings.some(w => /excluded interval group/.test(w))
    ).toBe(false)
  })
})
