import { plotRegistry } from '$lib/plots/registry'
import { generateUniqueId } from '$lib/shared/uniqueId'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataCapabilities } from '$lib/data/types'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import type { GridState } from '$lib/workspace/grid/gridState.svelte'
import type { PlotType } from '$lib/workspace/grid/types'
import { responsive } from '../responsive.svelte'
import type { ControlVisualization } from './config'

// What a plot is missing, named by the first requirement the dataset fails.
const NEEDS: Record<keyof DataCapabilities, string> = {
  segmented: 'Needs fixation data',
  spatial: 'Needs fixation coordinates',
  event: 'Needs event data',
}

/** Every plot for the Add Visualization menus, with why the dataset cannot feed it. */
export function addablePlots(engine: DataEngine): ControlVisualization[] {
  return (Object.keys(plotRegistry) as PlotType[]).map(id => {
    const def = plotRegistry[id]
    const missing = def.requireCapabilities?.find(req => !engine.hasCapabilities([req]))
    return {
      id,
      label: def.name,
      detail: def.tagline,
      group: def.group,
      keywords: def.keywords,
      unavailable: missing && NEEDS[Array.isArray(missing) ? missing[0] : missing],
    }
  })
}

// Added while one plot is selected, a plot opens on that plot's stimulus
// and participants axis (selection ids are stimulus-independent).
function inheritedSettings(grid: GridState, vizType: PlotType) {
  const source = grid.selectedItem?.settings as Record<string, unknown> | undefined
  if (!source) return undefined
  const def = plotRegistry[vizType]
  const hasParticipants = def.paneSections.includes('participants')
  const inherits = (key: string) =>
    key === 'stimulusId' ? key in def.getDefaultSettings() : hasParticipants
  const settings: Record<string, unknown> = {}
  for (const key of ['stimulusId', 'participantSelectionId', 'hideEmptyParticipants']) {
    if (source[key] !== undefined && inherits(key)) settings[key] = source[key]
  }
  return Object.keys(settings).length > 0 ? settings : undefined
}

/** Adds a plot (at the cell `at` when it is free) and selects it; on desktop that also opens its pane. */
export function addPlot(
  { workspace, grid }: { workspace: WorkspaceCommandBus; grid: GridState },
  vizType: PlotType,
  at?: { x: number; y: number }
): void {
  const newId = generateUniqueId()
  const settings = inheritedSettings(grid, vizType)
  if (workspace.addGridItem(vizType, 'controls', newId, settings, at)) {
    grid.selectOnly(newId)
    if (!responsive.isMobile) grid.openPane(newId)
  }
}
