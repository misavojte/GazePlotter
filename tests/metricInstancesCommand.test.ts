/**
 * Metric-library edits are workspace commands, not direct engine mutations.
 * `updateMetricInstances` must (1) replace the library wholesale, (2) bump the
 * redraw epoch on ALL items (plots re-derive via `usePlotData`'s `epoch` — the
 * container layer has no metric-specific invalidation), and (3) reverse to a
 * snapshot of the PREVIOUS array so rename/create/delete/replace/reorder each
 * undo as one atomic step.
 */
import { describe, expect, it } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import type { MetricInstance } from '$lib/metrics'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
  createMockMetadata,
} from './helpers/workspaceCommandFixtures'

const instance = (id: string, label: string): MetricInstance => ({
  id,
  baseId: 'absoluteTime',
  params: {},
  label,
  projection: { kind: 'aoi-vector' } as unknown as MetricInstance['projection'],
})

function setup(initial: MetricInstance[]) {
  const engine = createMockEngine(
    createMockMetadata({ metricInstances: initial })
  )
  const gridStore = createMockGridStore()
  const registry = createWorkspaceCommandRegistry(gridStore, engine)
  return { engine, gridStore, registry }
}

describe('updateMetricInstances command', () => {
  it('replaces the library and triggers a workspace-wide redraw', () => {
    const { engine, gridStore, registry } = setup([instance('a', 'A')])
    const next = [instance('a', 'A'), instance('b', 'B')]

    registry.execute(
      createChainedCommand({ type: 'updateMetricInstances', instances: next }),
      { isUndoRedoOperation: false, dispatch: () => {} }
    )

    expect(engine.metadata?.metricInstances).toBe(next)
    expect(gridStore.triggerRedraw).toHaveBeenCalledTimes(1)
  })

  it('reverses to a snapshot of the previous library', () => {
    const before = [instance('a', 'A'), instance('b', 'B')]
    const { registry } = setup(before)

    const reverse = registry.reverse(
      createChainedCommand({
        type: 'updateMetricInstances',
        instances: [instance('a', 'A renamed'), instance('b', 'B')],
      })
    )

    expect(reverse).not.toBeNull()
    expect(reverse!.type).toBe('updateMetricInstances')
    const reversed = reverse as { instances: MetricInstance[] }
    expect(reversed.instances).toEqual(before)
  })

  it('round-trips: forward then inverse restores the original library', () => {
    const before = [instance('a', 'A')]
    const { engine, registry } = setup(before)
    const forward = createChainedCommand({
      type: 'updateMetricInstances',
      instances: [instance('b', 'B')],
    })

    const inverse = registry.reverse(forward)!
    const context = { isUndoRedoOperation: false, dispatch: () => {} }
    registry.execute(forward, context)
    expect(engine.metadata?.metricInstances.map(i => i.id)).toEqual(['b'])

    registry.execute(inverse, { ...context, isUndoRedoOperation: true })
    expect(engine.metadata?.metricInstances).toEqual(before)
  })
})
