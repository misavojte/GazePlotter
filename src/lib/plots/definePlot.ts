import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { PlotMetricContract } from '$lib/metrics'

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
 * A figure component + the data/config props to render it with — everything
 * except the canvas-sizing props (`width`/`height`/`dpiOverride`/`margins`),
 * which the host supplies (the grid for screen, the download modal for export).
 * This is the single "what does this plot draw" view-model: the screen
 * container and the export modal both render from it, so they can never drift.
 */
export type PlotView = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>
  props: Record<string, unknown>
}

/**
 * Host context for plots whose view depends on more than (engine, settings) —
 * e.g. cross-plot timeline sync that scans sibling grid items. Most plots
 * ignore it. Provided by the host (the grid on screen, the download modal for
 * export) so screen and export resolve the same view.
 */
export type PlotViewContext = {
  /** All workspace grid items (for cross-plot coordination). */
  gridItems: readonly unknown[]
  /** This plot's grid cell size, in grid units. */
  itemWidth: number
  itemHeight: number
}

/**
 * Declares how a plot derives its view from (engine, settings). The generic
 * download modal renders `deriveView(...)` directly — no per-plot export
 * component — and the on-screen container derives from the same function.
 */
export type PlotExportConfig<TSettings> = {
  /**
   * Returns the view-model, or `null` when the plot has nothing to draw (no
   * spatial data, no fixations) — the host then renders nothing. `ctx` carries
   * host context for the few plots that coordinate across siblings; most ignore it.
   */
  deriveView: (
    engine: DataEngine,
    settings: TSettings,
    ctx?: PlotViewContext
  ) => PlotView | null
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
  export?: PlotExportConfig<TSettings>
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
  consumesMetrics?: PlotMetricContract
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
