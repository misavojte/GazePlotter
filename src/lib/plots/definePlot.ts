import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { PlotMetricContract } from '$lib/metrics'
import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/workspace/commands'
import type { PlotGroup } from './groups'

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

/**
 * A pane section: a self-contained, selection-aware unit of the settings pane.
 * It takes the (representative) grid item, reads the edit-target items from the
 * `paneEditItems` context (default: just its own item), shows the common value
 * / "Mixed" across them, and writes the same change to all of them. So it works
 * identically for one item or N — single and bulk are the same code path.
 */
/**
 * The item type pane sections accept. Deliberately loose (any settings) and
 * defined HERE rather than as `AllGridTypes` — `AllGridTypes` derives from the
 * plot registry, which references section components, so importing it into the
 * sections would create a type cycle.
 */
export type PaneSectionItem = PlotItemContract<string, any>

export type PaneSection = Component<{ item: any }>

/**
 * One entry in a plot's ordered pane. `key` is the section's stable identity:
 * shared cross-type sections use a canonical key ('stimulus', 'group',
 * 'participant', 'timelineRange', 'aoi', 'event', 'eyeMovement'); plot-specific
 * sections use a namespaced key (e.g. 'scarf:visualisation') so they never
 * count as common across types. The multi-select Pane derives which sections to
 * show purely by intersecting these keys across the selection.
 */
export type PaneSectionEntry = { key: string; component: PaneSection }

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
  /**
   * Taxonomy bucket: the plot's unit of analysis. Read in exactly one place,
   * the add-visualization menu, which groups plots by this field (group =
   * parent item, its plots = submenu). Never surfaced in the plot's own chrome.
   */
  group: PlotGroup
  component: Component<TPlotProps>
  getDefaultSettings: (params?: TParams) => TSettings
  getDefaultHeight: (params?: PlotLayoutInput<TSettings>) => number
  getDefaultWidth: (params?: PlotLayoutInput<TSettings>) => number
  getMinSize: (params?: TParams) => { w: number; h: number }
  requireCapabilities?: DataCapabilityRequirements
  /** Export configuration for the generic download modal. */
  export?: PlotExportConfig<TSettings>
  /**
   * The plot's settings pane, declared as an ordered list of sections. The
   * single-plot pane renders this list; a multi-selection of one type renders
   * the same list (edits applied to all); a mixed-type selection renders the
   * intersection of the selected types' section keys. This list IS the pane —
   * the single source of truth for both single and bulk editing. Plots with an
   * empty list don't open a Pane when selected.
   */
  paneSections: PaneSectionEntry[]

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

  /**
   * Optional: called after a root command is executed (skipped during undo/redo).
   * Gives the plot a chance to return one or more child commands to reconcile
   * its own settings with the new world state (e.g. clearing stale highlights).
   */
  onCommand?: (
    command: WorkspaceCommandChain,
    item: PlotItemContract<TType, TSettings>,
    engine: DataEngine,
    dispatch: (cmd: WorkspaceCommand) => void
  ) => void
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
