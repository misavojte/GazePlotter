---
name: gazeplotter-plot
description: How plots are defined, fed data (metric library + binary readers), and rendered (canvas via the usePlot harness) in GazePlotter. MUST use when modifying anything under src/lib/plots.
---

# GazePlotter Plots

Each plot is a folder `src/lib/plots/<name>/` with a `definition.ts`, a `core/` (transformer, view, and sometimes layout/renderer/collector), and `components/<Name>PlotFigure.svelte`. The rules below are verified against the code; the file:line anchors are the source of truth. Do not assume a fixed `core/` file set: `core/transformer.ts` and `core/view.ts` are near-universal, but `collector.ts`, `layout.ts`, and `renderer.ts` exist only in some plots (`renderer.ts` is scarf-only).

## Defining a plot

- A plot is a `definePlot<Type, Settings, ...>({ ... })` object in `<name>/definition.ts` (`src/lib/plots/definePlot.ts:181`). `definePlot` is an identity helper; the real contract is the `PlotDefinition` type (`definePlot.ts:114-179`).
- Required fields: `type`, `name`, `group` (PlotGroup), `component`, `getDefaultSettings`, `getDefaultHeight`, `getDefaultWidth`, `getMinSize`, `paneSections`. There is NO `getDefaultConfig` (it does not exist).
- Optional fields: `requireCapabilities`, `export`, `getSubtitle`, `consumesMetrics`, `onCommand`. Full example: `src/lib/plots/bar/definition.ts`.
- Register by hand-adding the definition to the static literal `plotRegistry` in `src/lib/plots/registry.ts:14`. It is intentionally static (feeds `type VisualizationType = keyof typeof plotRegistry`); do not convert it to a glob loader.

## Data: the metric library

Most plots do not compute their own metric; they consume the shared metric library.

- Plot settings carry `metricInstanceIds: string[]` referencing instances chosen in the workspace (`src/lib/plots/bar/types.ts:46`). Single-select plots read `metricInstanceIds[0]`.
- The transformer declares a contract and resolves the instance: `const CONTRACT = { outputShape: 'aoi-vector', windowing: 'forbidden', crossParticipant: 'distribution' } as const satisfies PlotMetricContract`, then `resolveMetric({ instances, id, contract: CONTRACT })` (`src/lib/plots/bar/core/transformer.ts:28,57`).
- `PlotMetricContract` (`src/lib/metrics/filters.ts:43`): `{ outputShape, windowing: 'forbidden'|'required'|'allowed', crossParticipant: CrossParticipantMode, multiSelect? }`. `CrossParticipantMode = 'reduce'|'distribution'|'per-participant'|'samples'|'group-axis'`.
- The definition declares the same contract via `consumesMetrics` to drive the pane/library filters.
- When resolution fails (missing/incompatible instance), the transformer returns `noMetric: true` and the figure paints the missing-metric placeholder (see Labels and export parity).

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
- Hoist `settings.*` reads out of per-segment loops (each is a deep `$state` proxy `get`, ~190ms in a real trace); in hot loops index `reader.segmentBufferRaw` directly instead of calling `getSegment*(i)` per segment.
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
