import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { PlotExportProps } from '$lib/modals/export/download-plot/types'

export type DefaultPlotParams = {
  stimulusId?: number
  groupId?: number
}

export type PlotLayoutInput<TSettings> = Partial<TSettings> & {
  x?: number
  y?: number
  w?: number
  h?: number
}

export type PlotItemContract<TType extends string, TSettings> = {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  redrawTimestamp: number
  type: TType
  settings: TSettings
}

/**
 * Declares how a plot can be exported as an image via the download modal.
 * When provided on a PlotDefinition, the generic download modal can render
 * this plot's export without a dedicated per-plot modal.
 */
export type PlotExportConfig<TType extends string, TSettings> = {
  /** Component that derives plot data and renders the Figure for export. */
  figure: Component<{
    item: PlotItemContract<TType, TSettings>
    engine: DataEngine
    exportProps: PlotExportProps
  }>
}

export type PlotDefinition<
  TType extends string,
  TSettings,
  TPlotProps extends {
    item: PlotItemContract<TType, TSettings>
  } = {
    item: PlotItemContract<TType, TSettings>
  },
  TParams extends DefaultPlotParams = DefaultPlotParams,
> = {
  type: TType
  name: string
  component: Component<TPlotProps>
  getDefaultSettings: (params?: TParams) => TSettings
  getDefaultHeight: (params?: PlotLayoutInput<TSettings>) => number
  getDefaultWidth: (params?: PlotLayoutInput<TSettings>) => number
  getMinSize: (params?: TParams) => { w: number; h: number }
  requireCapabilities?: DataCapabilityRequirements
  /** Export configuration for the generic download modal. */
  export?: PlotExportConfig<TType, TSettings>
}

export function definePlot<
  TType extends string,
  TSettings,
  TPlotProps extends {
    item: PlotItemContract<TType, TSettings>
  } = {
    item: PlotItemContract<TType, TSettings>
  },
  TParams extends DefaultPlotParams = DefaultPlotParams,
>(definition: PlotDefinition<TType, TSettings, TPlotProps, TParams>) {
  return definition
}
