import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'

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
  canAdd?: (engine: DataEngine) => boolean
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
