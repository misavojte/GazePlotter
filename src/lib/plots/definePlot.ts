import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { MetricContext } from '$lib/metrics'
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

/**
 * A single captioned value rendered in the grid-item header (e.g.
 * `{ label: 'Stimulus', value: 'SMI Base' }`). Plots return an array of
 * these so the header can lay them out as a label/value grid divided by
 * thin separators, instead of a single joined string.
 */
export type PlotSubtitlePart = { label: string; value: string }

export type PlotSubtitleParts = PlotSubtitlePart[]

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
  /**
   * Optional: the component rendered inside the workspace Pane when this
   * plot instance is selected. Receives the grid item as its prop and wires
   * all edits live via `workspace.updateItemSettings(...)`. Plots without
   * `paneSettings` simply don't open a Pane when selected.
   */
  paneSettings?: Component<{ item: PlotItemContract<TType, TSettings> }>

  /**
   * Optional: builds the captioned label/value parts shown under the
   * plot's title in its grid-item header. Typically one entry per filter
   * (e.g. stimulus, participant group). Return undefined or an empty
   * array to hide.
   */
  getSubtitle?: (params: {
    item: PlotItemContract<TType, TSettings>
    engine: DataEngine
  }) => PlotSubtitleParts | undefined

  /**
   * Which metric instances this plot consumes, if any. Drives both the
   * pane's MetricSelect filter and the library modal's filter — single
   * source of truth so pane and modal can't drift.
   */
  consumesMetrics?: MetricContext
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
