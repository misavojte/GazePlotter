import type { DataEngine } from '$lib/data/engine'
import type { WorkspaceService } from '$lib/workspace/service.svelte'
import { createMetricInstance } from '$lib/metrics'
import type { GroupReduction, MetricInstance, Projection } from '$lib/metrics'

/**
 * THE create/replace-instance callback signature — shared by every consumer
 * (metric-library modal steps, `MetricSelect`, the handler factories below) so
 * the parameter list can never drift between them.
 */
export type CreateInstanceHandler = (
  baseId: string,
  params: Record<string, unknown>,
  label: string,
  projection: Projection,
  replacingId?: string,
  reduction?: GroupReduction,
) => void

interface BaseHandlers {
  onrenameInstance: (id: string, label: string) => void
  oncreateInstance: CreateInstanceHandler
  ondeleteInstance: (id: string) => void
}

export interface SingleSelectMetricHandlers extends BaseHandlers {
  onchange: (ids: string[]) => void
}

export interface MultiSelectMetricHandlers extends BaseHandlers {
  onchange: (ids: string[]) => void
}

// Every mutation is a delta of the full instances array dispatched as ONE
// `updateMetricInstances` command (single undo step; bumps the redraw epoch
// on all items). Nothing edits `engine.metadata.metricInstances` directly.

function currentInstances(engine: DataEngine): MetricInstance[] {
  return engine.metadata?.metricInstances ?? []
}

function renamed(
  instances: MetricInstance[],
  id: string,
  label: string
): MetricInstance[] | null {
  const trimmed = label.trim()
  if (trimmed.length === 0) return null
  const idx = instances.findIndex(i => i.id === id)
  if (idx < 0) return null
  const next = [...instances]
  next[idx] = { ...next[idx], label: trimmed }
  return next
}

function baseHandlers(
  engine: DataEngine,
  workspace: WorkspaceService,
  onCreated: (newId: string, replacingId?: string) => void,
  onDeleted: (id: string) => void,
): BaseHandlers {
  return {
    onrenameInstance: (id, label) => {
      const next = renamed(currentInstances(engine), id, label)
      if (next) workspace.updateMetricInstances(next, 'metricLibrary.rename')
    },
    oncreateInstance: (baseId, params, label, projection, replacingId, reduction) => {
      const inst = createMetricInstance({ baseId, params, projection, label, reduction })
      if (!inst) return
      const current = currentInstances(engine)
      const next =
        replacingId != null
          ? [...current.filter(i => i.id !== replacingId), inst]
          : [...current, inst]
      workspace.updateMetricInstances(next, 'metricLibrary.create')
      onCreated(inst.id, replacingId)
    },
    ondeleteInstance: id => {
      workspace.updateMetricInstances(
        currentInstances(engine).filter(i => i.id !== id),
        'metricLibrary.delete'
      )
      onDeleted(id)
    },
  }
}

export function singleSelectMetricHandlers(
  engine: DataEngine,
  workspace: WorkspaceService,
  getSelected: () => string | null,
  setSelected: (id: string | null) => void,
): SingleSelectMetricHandlers {
  return {
    onchange: ids => setSelected(ids[0] ?? null),
    ...baseHandlers(
      engine,
      workspace,
      newId => setSelected(newId),
      id => {
        if (getSelected() === id) setSelected(null)
      },
    ),
  }
}

export function multiSelectMetricHandlers(
  engine: DataEngine,
  workspace: WorkspaceService,
  getSelected: () => string[],
  setSelected: (ids: string[]) => void,
): MultiSelectMetricHandlers {
  return {
    onchange: ids => setSelected(ids),
    ...baseHandlers(
      engine,
      workspace,
      (newId, replacingId) => {
        const current = getSelected()
        if (replacingId != null) {
          setSelected(current.map(id => (id === replacingId ? newId : id)))
        } else {
          setSelected([...current, newId])
        }
      },
      id => setSelected(getSelected().filter(x => x !== id)),
    ),
  }
}
