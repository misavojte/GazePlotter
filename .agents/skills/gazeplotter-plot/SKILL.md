---
name: gazeplotter-plot
description: How plots are defined, fed data (metric library + binary readers), and rendered (canvas via the usePlot harness) in GazePlotter. MUST use when modifying anything under src/lib/plots.
---

# GazePlotter Plots

Plot = folder `src/lib/plots/<name>/`: `definition.ts` (the complete recipe) + `core/` (transformer, view, optional screen.svelte.ts / layout / renderer / sync.svelte.ts) + `components/<Name>PlotFigure.svelte` — UNLESS a shared generic figure covers the plot family (square matrices use `shared/components/MatrixPlotFigure.svelte`; see Figure section). NO per-plot container components — generic host `shared/components/PlotContainer.svelte` executes every definition.

## Definition = the plot

`definePlot<Type, Settings>({...})` in `definition.ts`. Contract type: `PlotDefinition` in `definePlot.ts`. Example: `bar/definition.ts`.

- Required: `type, name, group, getDefaultSettings, getDefaultHeight, getDefaultWidth, getMinSize, paneSections, view`. Optional: `screen, requireCapabilities, getSubtitle, consumesMetrics, onCommand`. NO `component` field, NO `getDefaultConfig`.
- `view.deriveView(engine, settings, ctx?) → { component, props, hasData?, meta? } | null` — the ONE derivation for screen AND export. `ctx = {itemWidth, itemHeight}` (grid units; display budgets only).
- `view.viewDependsOnWidth: true` → screen re-derives on width resize (aoi-stream, evolving-metrics). Height never re-derives.
- `view.viewOnlySettings` (e.g. `['highlights']`) — keys deriveView never reads: changes repaint, never re-derive.
- `screen?: PlotScreenFactory` — screen-only behavior, in `core/screen.svelte.ts` (runes OK; runs once at container init). Returns `{ settings?, props? }`:
  - `settings()` = reactive screen settings, cross-plot sync merged in. Export derives from RAW settings → sync is screen-only by construction.
  - `props(view)` = overlay on `view.props` (interaction handlers, sync overrides). Runs inside $derived; reactive reads tracked.
  - ctx: `item` (live getter — NEVER capture the value: items are replaced wholesale on every settings update), `engine`, `workspace`, `view()` (valid in effects/deriveds/handlers; NOT synchronously in factory body). `view.meta` = screen-coordination payload (sync keys, dataMax); recipe casts to its own meta type.
  - Reference recipes: `bar/core/screen.svelte.ts` (sync only), `scarf/core/screen.svelte.ts` (drag state + tooltip + sync).
- `getSubtitle`: pass the shared factories `stimulusGroupSubtitle` / `stimulusParticipantSubtitle` (`shared/subtitles.ts`) directly — never hand-roll the stimulus/group/participant parts.
- Pane sections: repeated control groups are shared components in `shared/components/sections/` taking the section's `bulk` context — `ScaleRangePair` (min/max, "0 = Auto"), `StimulusColorRange` (per-stimulus color range via `buildValueRangePatch`), `ColorScalePickerControl` (keep-mounted picker; its `show` prop replaces the display-gating div — never toggle the picker with `{#if}`), `HideNoAoiCheck`. Don't re-inline these in a plot's section.
- Register: hand-add to static literal `plotRegistry` (`registry.ts`). Intentionally static (feeds `VisualizationType`); never convert to glob loader.

## Metric library

- Settings carry `metricInstanceIds: string[]`; single-select plots read `[0]`.
- Transformer: `const CONTRACT = {...} as const satisfies PlotMetricContract` then `resolveMetric({instances, id, contract})` (see `bar/core/transformer.ts`). `PlotMetricContract` (`metrics/filters.ts`): `{outputShape, windowing: 'forbidden'|'required'|'allowed', crossParticipant: 'reduce'|'distribution'|'per-participant'|'samples'|'group-axis', multiSelect?}`.
- Definition declares the same contract via `consumesMetrics` (drives pane + library filters).
- Resolution failure → transformer returns `noMetric: true` → figure paints missing-metric placeholder.

## Host boundary (PlotContainer + usePlotData) — reactivity ends here

Generic host derives via `usePlotData` (`shared/plotData.svelte.ts`). Below it: plain data only. Never re-create this wiring in plot code.

- Dependency surface is EXACTLY: `epoch` (item.redrawTimestamp), settings snapshot, `item.w` iff `viewDependsOnWidth`. `derive` runs untracked — nothing discovered implicitly.
- Settings reach deriveView as plain, deeply-frozen, deep-equal-gated snapshots. Transforms NEVER see a $state proxy. Mutating settings input throws.
- NEVER watch `engine.metadata`: all metadata mutations are workspace commands (epoch bump); dataset loads rebuild all grid items after engine load.
- Cross-plot sync: push-based `PlotSyncRegistry` subclasses only (`shared/PlotSyncRegistry.svelte.ts`). Screen recipe registers own contribution (`usePlotSync`) + merges synced value into `settings()` BEFORE deriving. NEVER scan `grid.items` for sibling state. Export never syncs.
- Metric-library edits = `updateMetricInstances` workspace command (full-array payload, one undo step, epoch bump on ALL items). Components use `metricInstanceHandlers` factories (take `workspace`); `engine.setMetricInstances` is reserved for the command handler.
- NEVER hold transform results in `$state`/`$state.raw` or call transforms from raw `$derived`/`$effect`.
- Export modal (`modals/export/export-figures/view.ts`) applies same boundary via `snapshotSettings`.

## Figure (usePlot harness)

Figure calls `usePlot(options)` once, applies `plot.plotAction` to its `<canvas>`.

- `drawData(ctx, frame)` required; `drawOverlay(ctx, frame)` for hover visuals. `frame: PlotFrame` = floored data rect + `mouseX/mouseY` + title offsets.
- Placeholders DECLARED: `placeholder: () => ...` = data-level (noMetric → `METRIC_MISSING_MESSAGE`, empty data); `fit: frame => ...` = size guard, return `cannotFitPlaceholder(axis, extraSteps)` or null. Harness evaluates `fit` with resolved frame. NEVER read `plot.frame` to build placeholders; NEVER put placeholder values in `deps`.
- Hover HARNESS-OWNED: `hitTest(x,y,frame)` returns `FrameHit` with typed `data` payload; read back via `plot.hover.data` in drawOverlay/click handlers (embed pointer coords in payload if overlay needs them). `hoverKey`/`onHover` = deduped side effect. NO per-figure $state mirrors of the hit. `onHoverChange` = escape hatch only; scarf's `pointer`-driven hover is custom by design.
- PERF: with `drawOverlay`, hover repaints blit the cached data layer (`scheduleOverlayRender`). NEVER re-run drawData on mouse move (~2050ms regression once).
- Draw via `canvasState.context` (property is `context`). Harness owns begin/finishCanvasDrawing (clear, dpr scale, save/restore) — never call them yourself.
- Matrix plots (transition matrix, similarity matrix, correlation heatmap, SPLOM) have NO per-plot figure: `deriveView` returns `shared/components/MatrixPlotFigure.svelte` with a per-plot prop spec. Color mapping is DECLARATIVE (`colorScale` + `colorValueRange` + `belowMinColor`/`aboveMaxColor`/`nonFiniteColor`) so screen recipes can override `colorValueRange` without invalidating a closure; only value formatting (`formatCellValue`), tooltip rows (`getCellTooltip`), and custom cell content (`drawCells`, e.g. the SPLOM painter in `metric-correlation/core/splom.ts`) are function props. `legendTitle: null` hides the gradient legend. Never re-introduce a per-plot matrix figure or a closure-valued color prop.
- Matrix primitives: `computeSquareMatrixLayout`, `renderMatrixContent`, `drawMatrixCrosshair(ctx, layout, cell)`, `matrixCellAt(layout, mx, my, size)` from `shared/matrixRenderer.ts` (cell = display space; recurrence keeps its own figure — texture cache + bottom-origin rows).

## Hot path (draw/transform loops)

- No per-frame allocation; reuse buffers. GC dominates at 10k+ points.
- Render-bound data = flat TypedArrays, stride indexing. Render loops read flat buffers, plain `for` (no map/filter/reduce). Hoist constants; `|0`/`Math.floor` over `Math.round`.
- No large buffers in `$state`; no `$derived`/`$effect` per-element.
- Hot loops index `reader.segmentBufferRaw` directly, not `getSegment*(i)` per segment.
- Transformer outputs normalized 0..1 coords; draw multiplies by pixel size. Never absolute pixels in transformer (must cache across resizes).
- Dimmed/highlight colors: `desaturateToWhite` from `$lib/color`, never hardcoded.

## Engine data (binary, non-reactive)

- `engine.getReader()` → `BinaryBufferReader` (segments; `segmentBufferRaw`, `getSegmentStart/End/Category/Id/AoiCount`); `engine.getAoiGroupReader()`; `engine.getEventReader()` → `getOccurrences(stimulusId, channelId, participantId)` stride-2 `[start, duration, ...]`.
- NEVER read `metadata.eventData.events` in transform/render (ingest/export only).
- `item.redrawTimestamp` = "engine data changed, re-derive". Layout move/resize must NOT bump it (would re-trigger full re-transform).

## Labels + export parity

- All axis/legend/colorbar text via `shared/labels.ts` (`buildMetricLabel`). Grammar: `Quantity / unit · qualifier`. Never brackets/parens.
- Placeholders paint ON CANVAS (`drawCanvasPlaceholder`), never separate DOM — exports must include them. Constants: `METRIC_MISSING_MESSAGE`, `METRIC_MISSING_MULTI_MESSAGE`, `cannotFitPlaceholder`.
- Placeholder steps name REAL pane section titles: "Areas of Interest" (not "AOIs"), "Metrics", "Participant group", "Visualisation", "Time range".
