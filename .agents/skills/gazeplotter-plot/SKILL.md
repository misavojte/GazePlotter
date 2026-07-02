---
name: gazeplotter-plot
description: How plots are defined, fed data (metric library + binary readers), and rendered (canvas via the usePlot harness) in GazePlotter. MUST use when modifying anything under src/lib/plots.
---

# GazePlotter Plots

Each plot is a folder `src/lib/plots/<name>/` with a `definition.ts` (the complete recipe), a `core/` (transformer, view, optional screen recipe, and sometimes layout/renderer/sync), and `components/<Name>PlotFigure.svelte`. There are NO per-plot container components: one generic host (`src/lib/plots/shared/components/PlotContainer.svelte`) executes every plot's definition. The rules below are verified against the code; the file:line anchors are the source of truth.

## Defining a plot (the definition IS the plot)

- A plot is a `definePlot<Type, Settings>({ ... })` object in `<name>/definition.ts`; the real contract is the `PlotDefinition` type in `src/lib/plots/definePlot.ts`.
- Required fields: `type`, `name`, `group` (PlotGroup), `getDefaultSettings`, `getDefaultHeight`, `getDefaultWidth`, `getMinSize`, `paneSections`, and `view`. There is NO `component` field and NO `getDefaultConfig`.
- `view: { deriveView, viewDependsOnWidth?, viewOnlySettings? }` — the single derivation both hosts render from. `deriveView(engine, settings, ctx?)` returns `{ component, props, hasData?, meta? } | null`; `ctx` is `{itemWidth, itemHeight}` (display budgets only). `viewDependsOnWidth: true` makes the screen re-derive on width resize (aoi-stream, evolving-metrics); `viewOnlySettings` lists keys `deriveView` never reads (e.g. `['highlights']`) so changing them never re-derives.
- `screen?: PlotScreenFactory` — screen-only behavior, declared in `<name>/core/screen.svelte.ts` (runes-capable; invoked once at container init). It returns `{ settings?, props? }`: `settings()` is the reactive settings the screen derives from (cross-plot sync merged in — export always derives from raw settings, so sync is screen-only by construction); `props(view)` overlays screen-only props (interaction handlers, sync overrides) on the view's props. `ctx` gives `item` (live getter — never capture the value), `engine`, `workspace`, and `view()` (valid in effects/deriveds/handlers, not synchronously in the factory body). `view.meta` is the screen-coordination surface (sync keys, data maxima) a recipe casts to its own meta type. Reference recipes: `bar/core/screen.svelte.ts` (sync only), `scarf/core/screen.svelte.ts` (drag state + tooltip + sync).
- Optional fields: `requireCapabilities`, `getSubtitle`, `consumesMetrics`, `onCommand`. Full example: `src/lib/plots/bar/definition.ts`.
- Register by hand-adding the definition to the static literal `plotRegistry` in `src/lib/plots/registry.ts:14`. It is intentionally static (feeds `type VisualizationType = keyof typeof plotRegistry`); do not convert it to a glob loader.

## Data: the metric library

Most plots do not compute their own metric; they consume the shared metric library.

- Plot settings carry `metricInstanceIds: string[]` referencing instances chosen in the workspace (`src/lib/plots/bar/types.ts:46`). Single-select plots read `metricInstanceIds[0]`.
- The transformer declares a contract and resolves the instance: `const CONTRACT = { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' } as const satisfies PlotMetricContract`, then `resolveMetric({ instances, id, contract: CONTRACT })` (`src/lib/plots/bar/core/transformer.ts:28,57`).
- `PlotMetricContract` (`src/lib/metrics/filters.ts:43`): `{ outputShape, windowing: 'forbidden'|'required'|'allowed', crossParticipant: CrossParticipantMode, multiSelect? }`. `CrossParticipantMode = 'reduce'|'distribution'|'per-participant'|'samples'|'group-axis'`.
- The definition declares the same contract via `consumesMetrics` to drive the pane/library filters.
- When resolution fails (missing/incompatible instance), the transformer returns `noMetric: true` and the figure paints the missing-metric placeholder (see Labels and export parity).

## The host boundary: PlotContainer + usePlotData (reactivity ends here)

The generic `PlotContainer` derives every plot's view through `usePlotData` (`src/lib/plots/shared/plotData.svelte.ts`). Runes stop at the host; `deriveView`, transforms and figures below it work on plain data. Do not re-create this wiring in plot code.

- The derivation's reactive dependency surface is EXACTLY three declared inputs — nothing is discovered implicitly inside the transform, because `derive` runs untracked:
  - `epoch: () => item.redrawTimestamp` — "engine data changed, re-derive". Every engine-data command bumps it on all items; settings updates bump it on the item.
  - settings (the recipe's `settings()` or raw `item.settings`) — handed to `deriveView` as a plain, deeply-frozen, deep-equal-gated snapshot. Transforms NEVER see a `$state` proxy; noise (rebuilt-but-equal objects, `viewOnlySettings` keys) keeps a stable reference and does not re-derive.
  - `item.w`, only when the definition declares `viewDependsOnWidth`. NEVER watch `engine.metadata`: every metadata mutation is a workspace command (epoch bump), and dataset loads rebuild all grid items after the engine loads, so a live container cannot observe a metadata transition.
- Cross-plot sync is uniformly push-based via `PlotSyncRegistry` subclasses (`src/lib/plots/shared/PlotSyncRegistry.svelte.ts`): each participating plot's screen recipe registers its own contribution with `usePlotSync` and merges the synced value into `settings()` BEFORE deriving (scarf timeline, bar value axis, transition-matrix color, aoi-stream timeline + ridgeline mTop). Never scan `grid.items` for sibling state. Export derives from raw settings and never syncs.
- Metric-library edits are workspace commands: every mutation of `metadata.metricInstances` dispatches `updateMetricInstances` (full-array payload; one atomic undo step; bumps the redraw epoch on ALL items, so `epoch` covers metric edits). Components go through the `metricInstanceHandlers` factories (which take `workspace`); nothing calls a direct engine mutator — `engine.setMetricInstances` is reserved for the command handler.
- Do NOT hold transform results in `$state`/`$state.raw` or call transforms from raw `$derived`/`$effect`; the host owns result storage (never deep-proxied) and the re-derive policy.
- The export modal applies the same boundary: `deriveItemView` snapshots settings via `snapshotSettings` before calling a plot's `deriveView` (`src/lib/modals/export/export-figures/view.ts`).
- Consequences: transforms receive frozen input (mutating settings throws), and settings reads inside transforms are plain property access (the old "hoist `settings.*` out of hot loops" reactivity cost no longer exists — hoisting remains a micro-optimization only).

## Rendering: the usePlot harness

All canvas figures render through `usePlot(options): UsePlotHandle` (`src/lib/plots/shared/usePlot.svelte.ts:424`); a figure calls it once and applies `plot.plotAction` to its `<canvas>`. Reference: `src/lib/plots/scarf/components/ScarfPlotFigure.svelte:193`.

- Implement `drawData(ctx, frame)` (required) for the data layer and `drawOverlay(ctx, frame)` for hover/crosshair visuals. `frame: PlotFrame` gives the floored data rect (`x,y,width,height,right,bottom`), `mouseX/mouseY`, and title offsets.
- Hover: supply `hitTest(x,y,frame)`/`onHoverChange`, or the lower-level `pointer` handlers. The harness owns the tooltip and cursor.
- PERFORMANCE-CRITICAL: when a figure has `drawOverlay`, hover repaints call `scheduleOverlayRender()`, which blits the cached data layer and repaints only the overlay. Do NOT re-run `drawData` on mouse move (doing so was a ~2050ms regression). Put hover visuals in `drawOverlay`.
- Draw with `canvasState.context` (the property is `context`, not `ctx`). The harness wraps frames in `beginCanvasDrawing(canvasState)`/`finishCanvasDrawing(canvasState)` (`src/lib/plots/shared/canvasUtils.ts:524,544`), which clear, scale by `pixelRatio`, and save/restore. You implement `drawData`/`drawOverlay`; you do not call begin/finish yourself.

## Hot-path discipline (render loops and transformers)

- No per-frame allocation inside draw/transform loops; reuse buffers. GC pauses dominate at 10k+ points.
- Read render-bound data from flat TypedArrays (Float32Array/Float64Array/Int32Array) with stride indexing (`idx = i * STRIDE`, e.g. scarf's `RECT_STRIDE = 8`), not nested arrays. Transformers may build object arrays before the typed-array step, but the render loop must read flat buffers.
- Use plain `for` loops, not `.map/.filter/.reduce`, in draw loops. Hoist constants; prefer `| 0`/`Math.floor` over `Math.round` in loops.
- Do not put large raw buffers in `$state`; do not use `$derived`/`$effect` for per-element transforms.
- Transforms receive plain snapshotted settings via `usePlotData` (see the container boundary section), so `settings.*` reads carry no proxy cost. In hot loops still index `reader.segmentBufferRaw` directly instead of calling `getSegment*(i)` per segment.
- Normalize coordinates to 0..1 in the transformer and multiply by pixel width in the draw step; do not compute absolute pixels in the transformer.
- For dimmed/highlight states use `desaturateToWhite` (`src/lib/color/interpolation.ts`, imported via `$lib/color`), not hardcoded colors.

## Reading engine data (binary, non-reactive)

Engine buffers are binary and deliberately kept out of `$state`. Read them through readers, never through reactive metadata.

- `engine.getReader()` -> `BinaryBufferReader` (segments): raw access `reader.segmentBufferRaw`; per-segment `getSegmentStart/End/Category/Id/AoiCount` (`src/lib/data/binary/reader.segment.ts`).
- `engine.getAoiGroupReader()` -> `AoiGroupReader`.
- `engine.getEventReader()` -> `EventBufferReader`: `getOccurrences(stimulusId, channelId, participantId)` returns a stride-2 `[start, duration, ...]` view (`src/lib/data/binary/reader.event.ts:118`).
- NEVER read `metadata.eventData.events` in a transformer/render path; it is reactive and reserved for ingest/export.
- A plot re-derives from the engine when `item.redrawTimestamp` changes (`definePlot.ts:27`); it means "engine data changed". Layout move/resize must NOT bump it, or you re-trigger a full re-transform.

## Labels and export parity

- All axis/legend/colorbar text goes through `src/lib/plots/shared/labels.ts` (`buildMetricLabel(...)` is the single builder). Grammar: `Quantity / unit · qualifier · qualifier`. Never brackets or parens.
- Placeholders/annotations must paint onto the canvas via `drawCanvasPlaceholder(ctx, width, height, message)` (`src/lib/plots/shared/drawCanvasPlaceholder.ts`), not separate DOM, so PNG/SVG exports include them. Missing-metric messages: `METRIC_MISSING_MESSAGE`, `METRIC_MISSING_MULTI_MESSAGE`.

## Verify

In-code only: `npm run check` (svelte-check) and `npm test` (vitest). Do not start a dev server or Playwright to verify (see the gazeplotter-svelte skill).
