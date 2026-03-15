import type { PlotDefinition, PlotItemContract } from '$lib/plots/definePlot'
import type { plotRegistry } from '$lib/plots/registry'

export type GridConfig = {
  cellSize: { width: number; height: number }
  gap: number
  minWidth: number
  minHeight: number
}

export type GridItemPosition = {
  id: number
  x: number
  y: number
  w: number
  h: number
}

/**
 * Shared layout fields for every grid item in the workspace.
 */
export interface GridItemBase {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  redrawTimestamp: number
}

type PlotDefinitions = typeof plotRegistry

export type PlotType = keyof PlotDefinitions

type InferPlotSettings<TDefinition> =
  TDefinition extends PlotDefinition<any, infer TSettings, any, any>
    ? TSettings
    : never

/**
 * Plot settings are now derived from the plot definitions map.
 */
export type PlotSettingsMap = {
  [K in PlotType]: InferPlotSettings<PlotDefinitions[K]>
}

export type AllPlotSettings = PlotSettingsMap[keyof PlotSettingsMap]

/**
 * Generic plot item shape used across the workspace.
 */
export type PlotItem<
  TType extends PlotType,
  TSettings extends AllPlotSettings,
> = PlotItemContract<TType, TSettings>

export type GridItemMap = {
  [K in PlotType]: PlotItem<K, PlotSettingsMap[K]>
}

export type AllGridTypes = GridItemMap[keyof GridItemMap]

export type GridType = GridItemBase

export type GridItemLayoutUpdate = Partial<
  Pick<GridItemBase, 'x' | 'y' | 'w' | 'h' | 'min' | 'redrawTimestamp'>
>

export type GridItemSnapshot<K extends PlotType = PlotType> =
  Partial<GridItemBase> & {
    type: K
    settings?: Partial<PlotSettingsMap[K]>
  }

export type VisualizationConfig<K extends PlotType> = PlotDefinitions[K]
