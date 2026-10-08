import { describe, it, expect } from 'vitest'
import { createMetricInstance, type MetricInstance } from '../src/lib/metrics/instances'
import {
  multiSelectMetricHandlers,
  singleSelectMetricHandlers,
} from '../src/lib/plots/shared/metricInstanceHandlers'
import type { DataEngine } from '../src/lib/data/engine'
import type { WorkspaceCommandBus } from '../src/lib/workspace/commands/bus'

function setup(instances: MetricInstance[]) {
  const metadata = { metricInstances: instances }
  const engine = { metadata } as unknown as DataEngine
  const workspace = {
    apply: (cmd: { instances: MetricInstance[] }) => {
      metadata.metricInstances = cmd.instances
      return true
    },
  } as unknown as WorkspaceCommandBus
  let selected: string | null = 'b'
  const handlers = singleSelectMetricHandlers(
    engine,
    workspace,
    () => selected,
    id => (selected = id),
  )
  return { metadata, handlers, getSelected: () => selected }
}

describe('editing a metric instance', () => {
  const make = (id: string) => createMetricInstance({ id, baseId: 'fixationCount' })!

  it('keeps id and list position, so every plot using it follows the edit', () => {
    const { metadata, handlers, getSelected } = setup([make('a'), make('b'), make('c')])
    handlers.oncreateInstance(
      'fixationCount',
      {},
      'Edited',
      { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'AOI 1' } },
      'b',
    )
    expect(metadata.metricInstances.map(i => i.id)).toEqual(['a', 'b', 'c'])
    expect(metadata.metricInstances[1].label).toBe('Edited')
    expect(getSelected()).toBe('b')
  })

  it('creating appends a new instance and selects it', () => {
    const { metadata, handlers, getSelected } = setup([make('a'), make('b')])
    handlers.oncreateInstance('fixationCount', {}, 'New', { kind: 'identity-aoi-vector' })
    expect(metadata.metricInstances).toHaveLength(3)
    expect(getSelected()).toBe(metadata.metricInstances[2].id)
  })

  it('a new instance gets a free numbered label instead of a duplicate', () => {
    const named = (id: string, label: string) =>
      createMetricInstance({ id, baseId: 'fixationCount', label })!
    const { metadata, handlers } = setup([named('a', 'Count'), named('b', 'Count (2)')])
    handlers.oncreateInstance('fixationCount', {}, 'Count', { kind: 'identity-aoi-vector' })
    handlers.oncreateInstance('fixationCount', {}, 'Count (2)', { kind: 'identity-aoi-vector' })
    handlers.oncreateInstance('fixationCount', {}, 'Other', { kind: 'identity-aoi-vector' })
    expect(metadata.metricInstances.map(i => i.label)).toEqual([
      'Count', 'Count (2)', 'Count (3)', 'Count (4)', 'Other',
    ])
  })

  it('Save as new swaps the copy in for the original on a multi-metric plot only', () => {
    const metadata = { metricInstances: [make('a'), make('b'), make('c')] }
    const engine = { metadata } as unknown as DataEngine
    const workspace = {
      apply: (cmd: { instances: MetricInstance[] }) => {
        metadata.metricInstances = cmd.instances
        return true
      },
    } as unknown as WorkspaceCommandBus
    let selected = ['a', 'b']
    const handlers = multiSelectMetricHandlers(engine, workspace, () => selected, ids => (selected = ids))
    handlers.oncreateInstance('fixationCount', {}, 'Fork', { kind: 'identity-aoi-vector' }, undefined, undefined, 'b')
    const forkId = metadata.metricInstances[3].id
    expect(selected).toEqual(['a', forkId])
    expect(metadata.metricInstances.map(i => i.id).slice(0, 3)).toEqual(['a', 'b', 'c'])
    handlers.oncreateInstance('fixationCount', {}, 'Plain', { kind: 'identity-aoi-vector' })
    expect(selected).toEqual(['a', forkId, metadata.metricInstances[4].id])
  })
})
