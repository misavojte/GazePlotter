import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { snapshotSettings } from '$lib/plots/shared/plotData.svelte'
import { resolvePlotRuntime } from '$lib/plots/registry'
import type { AllGridTypes, GridState } from '$lib/workspace/grid'
import type { GridItemMap, PlotType } from '$lib/workspace/grid/types'
import { getWorkspaceCanvasExportDimensions } from '../shared/helpers'
import type { PlotExportProps } from './types'

/**
 * Resolve a grid item's export view-model via its plot's `deriveView` — the
 * same single source the on-screen container renders from. Returns `null`
 * when the plot has nothing to draw.
 */
export function deriveItemView<K extends PlotType>(
  engine: DataEngine,
  item: GridItemMap[K]
): PlotView | null {
  const config = resolvePlotRuntime(item.type).view
  // Same reactive/plain boundary the on-screen containers apply (usePlotData):
  // deriveView receives a plain frozen snapshot, never a live `$state` proxy.
  const settings = snapshotSettings(item.settings)
  const view = config.deriveView(engine, settings, {
    itemWidth: item.w,
    itemHeight: item.h,
  })
  // View-only settings feed the input on screen and in export alike.
  return view && config.viewOnly
    ? { ...view, input: { ...view.input, ...config.viewOnly.input(settings, engine) } }
    : view
}

/** Whether the item's plot renders through the playback shell (it declares `playback`). */
export function itemPlayback(item: AllGridTypes): boolean {
  return resolvePlotRuntime(item.type).playback ?? false
}

/**
 * Canvas-sizing props for one figure: its workspace-derived size with the
 * uniform export margin carved out, at the given resolution (`null` = device
 * pixel ratio, used by the preview).
 */
export function itemExportProps(
  item: AllGridTypes,
  grid: GridState,
  dpi: number | null,
  margin: number
): PlotExportProps {
  const { width, height } = getWorkspaceCanvasExportDimensions(
    item,
    grid.config,
    margin
  )
  return {
    width,
    height,
    dpiOverride: dpi,
    margin,
  }
}
