import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView, PlotViewContext } from '$lib/plots/definePlot'
import { snapshotSettings } from '$lib/plots/shared/plotData.svelte'
import { resolvePlotDefinition } from '$lib/plots/registry'
import type { AllGridTypes, GridState } from '$lib/workspace/grid'
import { getWorkspaceCanvasExportDimensions } from '../shared/helpers'
import type { PlotExportProps } from './types'

/**
 * Resolve a grid item's export view-model via its plot's `deriveView` — the
 * same single source the on-screen container renders from. Returns `null`
 * when the plot has nothing to draw.
 */
export function deriveItemView(
  engine: DataEngine,
  item: AllGridTypes
): PlotView | null {
  // Resolved generically, so deriveView is cast to a loose signature (its
  // settings type is guaranteed to match `item` at runtime).
  const deriveView = resolvePlotDefinition(item.type).view.deriveView as (
    engine: DataEngine,
    settings: unknown,
    ctx?: PlotViewContext
  ) => PlotView | null
  // Same reactive/plain boundary the on-screen containers apply (usePlotData):
  // deriveView receives a plain frozen snapshot, never a live `$state` proxy.
  const settings = snapshotSettings(
    (item as { settings: object }).settings
  ) as unknown
  return deriveView(engine, settings, {
    itemWidth: item.w,
    itemHeight: item.h,
  })
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
    margins: { top: margin, right: margin, bottom: margin, left: margin },
  }
}
