import { plotRegistry } from '$lib/plots/registry'
import { generateUniqueId } from '$lib/shared/uniqueId'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import type { GridState } from '$lib/workspace/grid/gridState.svelte'
import type { PlotType } from '$lib/workspace/grid/types'
import { responsive } from '../responsive.svelte'
import type { ControlVisualization } from './config'

/** Plots the current dataset can feed, for the Add Visualization menus. */
export function addablePlots(engine: DataEngine): ControlVisualization[] {
  return (Object.keys(plotRegistry) as PlotType[])
    .filter(id => engine.hasCapabilities(plotRegistry[id].requireCapabilities))
    .map(id => ({
      id,
      label: plotRegistry[id].name,
      detail: plotRegistry[id].tagline,
      group: plotRegistry[id].group,
    }))
}

// Added while one plot is selected, a plot opens on that plot's stimulus
// and participant selection (selection ids are stimulus-independent).
function inheritedSettings(grid: GridState, vizType: PlotType) {
  const source = grid.selectedItem?.settings as Record<string, unknown> | undefined
  if (!source) return undefined
  const defaults = plotRegistry[vizType].getDefaultSettings()
  const settings: Record<string, number> = {}
  for (const key of ['stimulusId', 'groupId']) {
    const value = source[key]
    if (typeof value === 'number' && key in defaults) settings[key] = value
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
