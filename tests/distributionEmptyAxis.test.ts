/**
 * An empty category axis (no event channels / AOIs on the stimulus) must reach
 * the figure as empty data so it paints the plot's empty card, never an empty
 * frame on an invented 0..100 axis.
 */
import { describe, it, expect } from 'vitest'
import { plotRegistry } from '../src/lib/plots/registry'
import { makeTestEngine } from './helpers/testEngine'
import { createDefaultMetricInstances } from '../src/lib/metrics/instances'
import '../src/lib/metrics/init'


const engine = () =>
  // Events exist in the dataset (stimulus 1), just not on stimulus 0.
  makeTestEngine([[[[0, 100, 0]]], [[[0, 100, 0]]]], {
    aoiData: [[], []],
    aoiOrderVector: [[], []],
    participantsOrderVector: [0],
    stimuli: [['S', 'S'], ['T', 'T']],
    stimuliOrderVector: [0, 1],
    eventData: [[], [['blink', 'Blink']]],
    events: [[], [[[10, 20]]]],
    metricInstances: createDefaultMetricInstances(),
  })

const base = {
  stimulusId: 0, orientation: 'horizontal' as const, orderDirection: 'asc' as const,
  scaleRange: [0, 0] as [number, number], statisticalOverlay: 'none' as const,
}

describe('distribution plots: empty category axis', () => {
  it('event comparison on a stimulus without events yields empty data and the event card', () => {
    const def = plotRegistry.eventComparison
    const settings = { ...def.getDefaultSettings(), ...base, orderBy: 'channel' as const }
    const result = def.collect(engine(), settings)
    expect(result.noMetric).toBeFalsy()
    expect(result.noParticipants).toBeFalsy()
    expect(result.data).toEqual([])
    const view = def.view.deriveView(engine(), settings)!
    expect(view.props.data).toEqual([])
    expect(view.props.emptyPlaceholder).toMatchObject({ message: 'No event channels to show on this stimulus.' })
  })

  it('AOI comparison with no AOIs and the No-AOI slot hidden yields empty data', () => {
    const def = plotRegistry.aoiComparison
    const settings = { ...def.getDefaultSettings(), ...base, orderBy: 'aoi' as const, hideNoAoi: true, metricInstanceIds: ['absoluteTime'] }
    const result = def.collect(engine(), settings)
    expect(result.noMetric).toBeFalsy()
    expect(result.data).toEqual([])
  })
})
