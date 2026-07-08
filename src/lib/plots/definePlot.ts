import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { PlotMetricContract } from '$lib/metrics'
import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/workspace/commands'
import type { WorkspaceService } from '$lib/workspace/service.svelte'
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
  /**
   * `false` when the plot has data-independent reasons to show the loading /
   * unavailable placeholder instead of the figure. Omitted means `true`.
   */
  hasData?: boolean
  /**
   * Screen-coordination surface: values a plot's screen recipe needs beyond
   * the figure props (sync keys, data maxima, default-range flags). Opaque to
   * the host; the plot's own recipe casts it. Export ignores it.
   */
  meta?: unknown
}

/**
 * Host layout context for plots whose view depends on their on-screen size —
 * width-windowed plots derive a display budget from `itemWidth`. Most plots
 * ignore it. Cross-plot coordination does NOT live here: sync values are
 * resolved by the on-screen container (via the `PlotSyncRegistry` instances)
 * and merged into the settings before deriving; export derives from the raw
 * settings and never syncs.
 */
export type PlotViewContext = {
  /** This plot's grid cell size, in grid units. */
  itemWidth: number
  itemHeight: number
}

/**
 * Declares how a plot derives its view from (engine, settings). The single
 * derivation for BOTH hosts: the generic screen container (`PlotContainer`)
 * derives through it via `usePlotData`, and the generic download modal renders
 * it directly — no per-plot container or export component exists.
 */
export type PlotViewConfig<TSettings> = {
  /**
   * Returns the view-model, or `null` when the plot has nothing to draw (no
   * spatial data, no fixations) — the host then renders nothing. `ctx` carries
   * the plot's grid size for width-derived display budgets; most plots ignore it.
   */
  deriveView: (
    engine: DataEngine,
    settings: TSettings,
    ctx?: PlotViewContext
  ) => PlotView | null
  /**
   * Set when `deriveView` reads `ctx.itemWidth` (display budget): the screen
   * container then re-derives on width resize. Height never re-derives.
   */
  viewDependsOnWidth?: boolean
  /**
   * Settings keys `deriveView` provably never reads (view-only state such as
   * `highlights`). Changes to them repaint but never re-derive.
   */
  viewOnlySettings?: readonly string[]
}

/**
 * Screen-only behavior, declared as a factory the generic `PlotContainer`
 * invokes ONCE during component init — so it may use runes and `$effect`-based
 * helpers (`usePlotSync`, `usePlotData`); recipes that do live in
 * `<plot>/core/screen.svelte.ts`. Everything a per-plot container used to do
 * fits in the three optional slots:
 *
 *  - `settings` — the reactive settings the view derives from on screen
 *    (e.g. cross-plot sync merged in). Export always derives from the raw
 *    item settings, so anything merged here is screen-only by construction.
 *  - `props`   — screen-only props overlaid on the view's props (interaction
 *    handlers, sync overrides). Runs inside a `$derived`; reactive reads
 *    (sync registries, item settings) are tracked.
 */
export type PlotScreenContext<TSettings> = {
  /** The live grid item (reactive getter — do not capture the value). */
  readonly item: PlotItemContract<string, TSettings>
  engine: DataEngine
  workspace: WorkspaceService
  /**
   * The current derived view. Valid inside effects, deriveds and event
   * handlers (it is bound after the container initializes) — do not call it
   * synchronously inside the factory body.
   */
  view: () => PlotView | null
}

export type PlotScreen<TSettings> = {
  settings?: () => TSettings
  props?: (view: PlotView) => Record<string, unknown>
}

export type PlotScreenFactory<TSettings> = (
  ctx: PlotScreenContext<TSettings>
) => PlotScreen<TSettings>

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

// ─── Declarative settings schema ─────────────────────────────────────────────

export type SectionFieldOption = { value: string; label: string }

/**
 * Context handed to a schema field's functions (`showWhen`, function-form
 * `options`, entry `summary`). `common` is the bulk-aware read — visibility
 * gates on a mode field must use it so a control hides when the selection
 * DISAGREES on the mode (`!mixed && value === …`), matching how the
 * hand-written sections behaved.
 */
export type SectionFieldCtx = {
  engine: DataEngine
  /** The representative item's settings (read-only convenience). */
  settings: Record<string, unknown>
  /** `{ value, mixed }` for one field across the live edit selection. */
  common: <T>(read: (settings: any) => T) => { value: T; mixed: boolean }
}

/**
 * One declarative control in a schema pane section. The generic renderer
 * (`SchemaSection`) owns everything the hand-written sections repeated: bulk
 * context + command provenance, Mixed display, `?? default` display fallbacks,
 * summary text, and keep-mounted visibility gating. Field kinds map 1:1 onto
 * the existing shared controls, including the two special write semantics
 * (`scaleRange` partial-bound merge, `stimulusColorRange` per-item keyed write).
 */
export type SectionField =
  | {
      kind: 'enum'
      key: string
      /** 'select' (default) renders a dropdown; 'radio' a labeled group. */
      control?: 'select' | 'radio'
      label?: string
      /** Radio accessible name when no visible `label`. Default: section title. */
      ariaLabel?: string
      /** Radio layout. Default 'column'. */
      direction?: 'column' | 'row'
      options:
        | readonly SectionFieldOption[]
        | ((ctx: SectionFieldCtx) => readonly SectionFieldOption[])
      /** Pane-display fallback when the setting is unset. */
      default?: string
      /** Effective-value override replacing the plain `settings[key]` read —
       *  e.g. recurrence coerces the stored method to 'aoi' when the dataset
       *  has no spatial data. Runs per selected item (bulk divergence then
       *  reflects what each plot actually uses). */
      read?: (settings: Record<string, unknown>, engine: DataEngine) => string
      /** Drives the collapsed-header summary (selected option's label / 'Mixed'). */
      summary?: boolean
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'boolean'
      key: string
      label: string
      default?: boolean
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'number'
      key: string
      label: string
      min?: number
      max?: number
      step?: number
      /** Display fallback AND the value an emptied input commits; when absent,
       *  an emptied input recommits the current value. */
      default?: number
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'color'
      key: string
      label: string
      default?: string
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'colorScale'
      key: 'colorScale'
      defaultMin: string
      defaultMax: string
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      /** Min/max pair writing `[min, max]` into `key` with a per-item merge of
       *  the untouched bound ("0 = Auto" convention). */
      kind: 'scaleRange'
      key: string
      legend?: string
      inputMax?: number
      step?: number
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      /** Per-stimulus color value range: keyed per-item write into
       *  `stimuliColorValueRanges[stimulusId]`. */
      kind: 'stimulusColorRange'
      key: 'stimuliColorValueRanges'
      legend?: string
      inputMax?: number
      step?: number
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      /** The shared "Hide data → No AOI data" checkbox (bar/stream/matrix). */
      kind: 'hideNoAoi'
      key: 'hideNoAoi'
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }

/**
 * A pane section declared as data instead of a component: the generic
 * `SchemaSection` renders `fields` in order. This is the preferred shape for
 * plot-specific sections — a new plot declares its settings pane without
 * authoring any Svelte. Registration validates the schema (unique keys; every
 * key present in `getDefaultSettings()` or carrying a `default`; static enum
 * defaults ∈ options).
 */
export type SchemaPaneSectionEntry = {
  key: string
  title: string
  fields: SectionField[]
  /** Collapsed-header summary override (e.g. a fixed word). Defaults to the
   *  `summary`-flagged enum field's selected label, else the first enum's. */
  summary?: (ctx: SectionFieldCtx) => string
}

/**
 * One entry in a plot's ordered pane. `key` is the section's stable identity:
 * shared cross-type sections use a canonical key ('stimulus', 'group',
 * 'participant', 'timelineRange', 'aoi', 'event', 'eyeMovement'); plot-specific
 * sections use a namespaced key (e.g. 'scarf:visualisation') so they never
 * count as common across types. The multi-select Pane derives which sections to
 * show purely by intersecting these keys across the selection.
 *
 * Two shapes: a schema section (preferred — declarative `fields`) or a bespoke
 * component (escape hatch for genuinely irregular panes, e.g. the dual-mode
 * scarf timeline; also how the shared cross-type sections are referenced).
 */
export type PaneSectionEntry =
  | { key: string; component: PaneSection }
  | SchemaPaneSectionEntry

export type PlotDefinition<
  TType extends string,
  TSettings,
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
  getDefaultSettings: (params?: TParams) => TSettings
  getDefaultHeight: (params?: PlotLayoutInput<TSettings>) => number
  getDefaultWidth: (params?: PlotLayoutInput<TSettings>) => number
  getMinSize: (params?: TParams) => { w: number; h: number }
  requireCapabilities?: DataCapabilityRequirements
  /**
   * The single view derivation both hosts render from. There is no per-plot
   * container component: the generic `PlotContainer` executes this (plus the
   * optional `screen` recipe) for every plot.
   */
  view: PlotViewConfig<TSettings>
  /** Screen-only behavior (sync, interaction handlers); most plots need none. */
  screen?: PlotScreenFactory<TSettings>
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
  TParams extends DefaultPlotParams = DefaultPlotParams,
>(definition: PlotDefinition<TType, TSettings, TParams>) {
  return definition
}
