import type { DataEngine } from '$lib/data/engine'
import type { Projection } from '$lib/metrics'

interface BaseHandlers {
  onrenameInstance: (id: string, label: string) => void
  oncreateInstance: (
    baseId: string,
    params: Record<string, unknown>,
    label: string,
    projection: Projection,
    replacingId?: string,
  ) => void
  ondeleteInstance: (id: string) => void
}

export interface SingleSelectMetricHandlers extends BaseHandlers {
  onchange: (ids: string[]) => void
}

export interface MultiSelectMetricHandlers extends BaseHandlers {
  onchange: (ids: string[]) => void
}

export function singleSelectMetricHandlers(
  engine: DataEngine,
  getSelected: () => string | null,
  setSelected: (id: string | null) => void,
): SingleSelectMetricHandlers {
  return {
    onchange: ids => setSelected(ids[0] ?? null),
    onrenameInstance: (id, label) => engine.updateMetricInstanceLabel(id, label),
    oncreateInstance: (baseId, params, label, projection, replacingId) => {
      if (replacingId != null) engine.deleteMetricInstance(replacingId)
      const newId = engine.addMetricInstance(baseId, params, label, projection)
      if (newId !== null) setSelected(newId)
    },
    ondeleteInstance: id => {
      engine.deleteMetricInstance(id)
      if (getSelected() === id) setSelected(null)
    },
  }
}

export function multiSelectMetricHandlers(
  engine: DataEngine,
  getSelected: () => string[],
  setSelected: (ids: string[]) => void,
): MultiSelectMetricHandlers {
  return {
    onchange: ids => setSelected(ids),
    onrenameInstance: (id, label) => engine.updateMetricInstanceLabel(id, label),
    oncreateInstance: (baseId, params, label, projection, replacingId) => {
      const newId = engine.addMetricInstance(baseId, params, label, projection)
      if (newId === null) return
      const current = getSelected()
      if (replacingId != null) {
        engine.deleteMetricInstance(replacingId)
        setSelected(current.map(id => (id === replacingId ? newId : id)))
      } else {
        setSelected([...current, newId])
      }
    },
    ondeleteInstance: id => {
      engine.deleteMetricInstance(id)
      setSelected(getSelected().filter(x => x !== id))
    },
  }
}
