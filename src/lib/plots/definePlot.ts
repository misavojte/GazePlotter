import type { Component } from 'svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataCapabilityRequirements } from '$lib/data/types'
import type { PlotMetricContract } from '$lib/metrics'
import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/workspace/commands'
import type { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import type { ModalState } from '$lib/modals/modalState.svelte'
import type { PlotGroup } from './groups'
import type { AnyPlotKit, PlotKit } from './shared/kit'
import type { PlotHighlightSpec } from './shared/highlightLink'

export type DefaultPlotParams = {
  stimulusId?: number
}

/** Fallback grid sizing for plots that omit `size` (grid units). */
export const DEFAULT_PLOT_SIZE = {
  min: { w: 11, h: 10 },
  w: 12,
  h: 12,
} as const

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
 * What a plot draws: a kit and its plain input. The single "what does this plot
 * draw" view-model: the screen container and the export modal both render it
 * through the one canvas host, so they can never drift.
 */
export type PlotView<I = any, M = unknown> = {
  kit: AnyPlotKit
  input: I
  /**
   * `false` when the plot has data-independent reasons to show the loading /
   * unavailable placeholder instead of the figure. Omitted means `true`.
   */
  hasData?: boolean
  /** Values the plot's sync offers need beyond the input (sync keys, data maxima); export ignores it. */
  meta?: M
}

/** A view of `kit`, its input checked against the kit's own. */
export function plotView<I, M = undefined>(
  kit: PlotKit<I, any, any, any, any>,
  input: I,
  options: { meta?: M; hasData?: boolean } = {}
): PlotView<I, M> {
  return { kit, input, ...options }
}

/**
 * Host layout context for plots whose view depends on their on-screen size
 * (width-windowed plots derive a display budget from `itemWidth`). Cross-plot
 * sync does not live here: `sync` merges it into the settings.
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
export type PlotViewConfig<TSettings, TView extends PlotView<object> = PlotView> = {
  /**
   * Returns the view-model, or `null` when the plot has nothing to draw (no
   * spatial data, no fixations) — the host then renders nothing. `ctx` carries
   * the plot's grid size for width-derived display budgets; most plots ignore it.
   */
  deriveView: (
    engine: DataEngine,
    settings: TSettings,
    ctx?: PlotViewContext
  ) => TView | null
  /**
   * Set when `deriveView` reads `ctx.itemWidth` (display budget): the screen
   * container then re-derives on width resize. Height never re-derives.
   */
  viewDependsOnWidth?: boolean
  /**
   * View-only settings (e.g. `highlights`): `settings` lists the keys
   * `deriveView` never reads, so a change to them never re-derives; `input` maps
   * them to the input part they feed, merged over `view.input` on screen and in
   * export alike.
   */
  viewOnly?: {
    settings: readonly string[]
    input: (settings: TSettings, engine: DataEngine) => Partial<TView['input']>
  }
}

/**
 * The PLOT CURSOR port the platform builds for a plot (`shared/plotCursor.svelte.ts`).
 * The kit publishes through `act.publish` and reads the cursor in its overlay.
 */
export type PlotCursorSpec<TSettings> = {
  /** This plot's stimulus while its x axis is absolute time, else null. Omit for a plot that neither shows nor reads time. */
  time?: (settings: TSettings) => number | null
  /** The stimulus that gates 'stimulus' participant sets, both ways. Omit only for a plot spanning stimuli. */
  stimulus?: (settings: TSettings) => number | null
  /** What the participant sets this plot publishes mean; 'identity' when omitted. */
  publishes?: 'identity' | 'stimulus'
}

/** What a sync offer may read: the screen settings, the derived view, the grid item, the engine. */
export type PlotSyncContext<TSettings, TView extends PlotView<object>> = {
  settings: TSettings
  view: TView | null
  item: { readonly type: string; readonly w: number; readonly h: number }
  engine: DataEngine
}

/**
 * One cross-plot sync channel (`shared/plotSync.svelte.ts`), screen only: export
 * never syncs. Comparable plots share the largest `own` among equal `key`s;
 * the group max, when it beats this plot's own, lands in its settings before
 * deriving (`settings`) or over its input after (`input`).
 */
export type PlotSyncSpec<TSettings, TView extends PlotView<object>> = {
  channel: string
  /**
   * This plot's offer to the group; null opts out (a user-set range wins). An
   * offer whose max lands in `settings` must not read `view` (it derives from them).
   */
  offer: (ctx: PlotSyncContext<TSettings, TView>) => { key: unknown[]; own: number } | null
  settings?: (settings: TSettings, max: number) => TSettings
  input?: (view: TView, max: number) => Partial<TView['input']>
}

/**
 * A single captioned value rendered in the grid-item header (e.g.
 * `{ label: 'Active stimulus', value: 'SMI Base' }`). Plots return an array of
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

export type SectionFieldOption = {
  value: string
  label: string
  /** Muted secondary line in the dropdown row (the menu's `detail`
   *  pass-through) — e.g. a clique's internal-agreement readout. */
  detail?: string
}

/**
 * Context handed to a schema field's functions (`showWhen`, function-form
 * `options`, entry `summary`). `common` is the bulk-aware read — visibility
 * gates on a mode field must use it so a control hides when the selection
 * DISAGREES on the mode (`!mixed && value === …`), matching how the
 * hand-written sections behaved.
 */
export type SectionFieldCtx = {
  engine: DataEngine
  workspace: WorkspaceCommandBus
  modalState: ModalState
  /** The representative grid item (for its plot type and id). */
  item: PaneSectionItem
  /** Command provenance for edits and modals opened from this section. */
  source: string
  /** The representative item's settings (read-only convenience). */
  settings: Record<string, unknown>
  /** `{ value, mixed }` for one field across the live edit selection. */
  common: <T>(read: (settings: any) => T) => { value: T; mixed: boolean }
  /** Broadcast the same patch to every selected plot (one undo step). */
  update: (patch: Record<string, unknown>) => void
}

/** `showWhen` gate: every edited plot reads `value` through `read`. */
export const commonIs =
  (read: (settings: any, ctx: SectionFieldCtx) => unknown, value: unknown) =>
  (ctx: SectionFieldCtx) => {
    const c = ctx.common(s => read(s, ctx))
    return !c.mixed && c.value === value
  }

/** An edit-link rendered under a field's control (e.g. "Edit stimulus library"). */
export type SectionFieldAction = {
  label: string
  onclick: (ctx: SectionFieldCtx) => void
}

/**
 * THE pane layout cap — deliberately this small so section definitions stay
 * short and memorable. A section is a vertical stack of full-width fields;
 * the only layout freedoms are a caption over consecutive fields (`group`),
 * two neighbors sharing a 1fr/1fr row (`pair`), and an edit-link row under a
 * field (`actions`). Nothing else: no spans, no widths, no styles. A pane
 * needing more is a bespoke component.
 */
export type SectionFieldPresentation = {
  /** Caption group: consecutive fields with the same caption render under it;
   *  the caption hides when every member is hidden. Function form for a field
   *  captioned in one mode only. */
  group?: string | ((ctx: SectionFieldCtx) => string | undefined)
  /** Share a 1fr/1fr row with the adjacent `pair` field. Consecutive paired
   *  fields chunk left-to-right, two per row. */
  pair?: boolean
  actions?: readonly SectionFieldAction[]
}

/**
 * One declarative control in a schema pane section. The generic renderer
 * (`SchemaSection`) owns everything the hand-written sections repeated: bulk
 * context + command provenance, Mixed display, `?? default` display fallbacks,
 * summary text, and keep-mounted visibility gating. Field kinds map 1:1 onto
 * the existing shared controls, including the two special write semantics
 * (`scaleRange` partial-bound merge, `stimulusColorRange` per-item keyed write).
 */
export type SectionField = SectionFieldPresentation & (
  | {
      /** Every enum renders as a labeled Select — one control, uniform panes
       *  (radios are a modal affordance, not a pane one). */
      kind: 'enum'
      key: string
      label?: string | ((ctx: SectionFieldCtx) => string)
      options:
        | readonly SectionFieldOption[]
        | ((ctx: SectionFieldCtx) => readonly SectionFieldOption[])
      /** Set when the setting stores a NUMBER (ids). Options always use string
       *  values; the control renders `String(value)` and commits
       *  `Number(detail)` so the setting's type never degrades to string. */
      valueKind?: 'number'
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
      label: string | ((ctx: SectionFieldCtx) => string)
      default?: boolean
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'number'
      key: string
      label: string | ((ctx: SectionFieldCtx) => string)
      min?: number
      max?: number
      /** Spinner step; function form for a step that follows the data's units. */
      step?: number | ((ctx: SectionFieldCtx) => number)
      /** Display fallback AND the value an emptied input commits; when absent,
       *  an emptied input recommits the current value. */
      default?: number
      /** Placeholder shown instead of the value while it equals `default`
       *  (e.g. "All" for 0); emptying the input commits `default`. */
      emptyLabel?: string
      /** Effective-value override replacing the plain `settings[key]` read —
       *  for controls whose displayed value is derived (e.g. the scangraph's
       *  edge share at the current threshold). Commits still write `key`. */
      read?: (settings: Record<string, unknown>, engine: DataEngine) => number
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      kind: 'color'
      key: string
      label: string | ((ctx: SectionFieldCtx) => string)
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
      kind: 'info'
      description: string
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
  | {
      /** The plot's metric-instance picker, filtered by its `consumesMetrics`
       *  contract. */
      kind: 'metrics'
      key: 'metricInstanceIds'
      showWhen?: (ctx: SectionFieldCtx) => boolean
    }
)

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
  /** Start expanded on a fresh pane (the accordion's persisted open-state
   *  takes over after the first toggle). */
  defaultOpen?: boolean
}

/**
 * One entry in a plot's ordered pane — DATA ONLY, never a Svelte component:
 *
 *   - a canonical shared-section key as a plain string ('stimulus',
 *     'participants', 'participant', 'metric', 'timelineRange', 'aoi', 'event',
 *     'eyeMovement');
 *   - `{ key, props }` to pass static overrides to that shared section — props
 *     for a component section (scarf's ordinal-mode wiring for
 *     'timelineRange'), entry-field overrides for a schema section
 *     (metric-correlation's plural `title` for 'metric');
 *   - or a schema section (`{ key, title, fields }`) rendered by
 *     `SchemaSection` under the pane layout cap.
 *
 * Shared sections live only in the `SHARED_SECTIONS` registry — schema
 * entries, plus the rare rightly-bespoke component. A plot needing a genuinely
 * new control argues for a schema field kind or a new shared section — never
 * inline Svelte.
 * The key is the section's stable identity: shared sections use the canonical
 * bare key; plot-specific schema sections use a namespaced key
 * (`scarf:visualization`) so they never count as common across types. The
 * multi-select Pane derives which sections to show purely by intersecting
 * these keys across the selection.
 */
export type PaneSectionEntry =
  | string
  | { key: string; props: Record<string, unknown> }
  | SchemaPaneSectionEntry

/** The stable section key of any entry shape. */
export function paneSectionKey(entry: PaneSectionEntry): string {
  return typeof entry === 'string' ? entry : entry.key
}

/** `TView`: the plot's own view type, so its sync offers read input and meta typed. */
export type PlotDefinition<
  TType extends string,
  TSettings,
  TView extends PlotView<object> = PlotView,
  TParams extends DefaultPlotParams = DefaultPlotParams,
> = {
  type: TType
  name: string
  /** One line under the name in the add-visualization menu; read nowhere else. */
  tagline: string
  /**
   * Taxonomy bucket: the plot's unit of analysis. Read in exactly one place,
   * the add-visualization menu, which groups plots by this field (group =
   * parent item, its plots = submenu). Never surfaced in the plot's own chrome.
   */
  group: PlotGroup
  getDefaultSettings: (params?: TParams) => TSettings
  /**
   * Grid sizing in grid units — pure data. Omitted values fall back to
   * {@link DEFAULT_PLOT_SIZE} (min 11×10, default 12×12); most plots omit
   * the whole field.
   */
  size?: {
    min?: { w: number; h: number }
    w?: number
    h?: number
  }
  requireCapabilities?: DataCapabilityRequirements
  /**
   * The single view derivation both hosts render from. There is no per-plot
   * component: the generic `PlotContainer` executes this for every plot.
   */
  view: PlotViewConfig<TSettings, TView>
  /** The plot's PLOT CURSOR port; omitted means the plot neither publishes nor reads one. */
  cursor?: PlotCursorSpec<TSettings>
  /** Cross-plot sync channels (screen only). */
  sync?: PlotSyncSpec<TSettings, TView>[]
  /** Gets its own playback clock and renders with the play bar (screen and export). */
  playback?: boolean
  /**
   * Maps the legend's `highlights` identifiers to shared entities, so a legend
   * click in a multi-selection highlights the same entity in the other
   * selected plots (`shared/highlightLink.ts`).
   */
  highlights?: PlotHighlightSpec<TSettings>
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
   * (e.g. stimulus, participant selection). Return undefined or an empty
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

/**
 * What the platform runs of a definition (screen container, export), over the
 * plot's own settings: the settings stay exact, the view type is widened.
 */
export type PlotRuntime<TSettings> = Pick<
  PlotDefinition<string, TSettings, PlotView<any, any>>,
  'view' | 'cursor' | 'sync' | 'playback' | 'highlights'
>

export function definePlot<
  TType extends string,
  TSettings,
  TView extends PlotView<object> = PlotView,
  TParams extends DefaultPlotParams = DefaultPlotParams,
>(definition: PlotDefinition<TType, TSettings, TView, TParams>) {
  return definition
}
