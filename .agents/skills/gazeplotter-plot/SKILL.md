---
name: gazeplotter-plot
description: How plots are defined, fed data (metric library + binary readers), and rendered (pure plot kits drawn by one canvas host) in GazePlotter. MUST use when modifying anything under src/lib/plots.
---

# GazePlotter Plots

Plot = folder `src/lib/plots/<name>/` of PLAIN TS (no `.svelte`, no `.svelte.ts`; enforced): `definition.ts` (the complete recipe, behaviour declared as data) + `core/` (transformer, view, `kit.ts`, optional layout / renderer) — UNLESS a shared kit covers the plot family (square matrices: `shared/matrixKit.ts`; comparison plots: `shared/distribution/beeswarm/kit.ts`). Every rune lives in the shared platform: `PlotContainer.svelte` (derive + `plotHost.svelte.ts` services), `PlotViewFigure.svelte`, `PlotCanvas.svelte` (the engine `usePlot.svelte.ts` over the pure pipeline `plotRender.ts`), `PlaybackFigure.svelte`.

Comparison plots (one distribution per category slot of a vector metric: `aoi-comparison`, `eye-movement-comparison`, `event-comparison`) are ONE `definition.ts` each: `defineDistributionPlot<Type, Settings>({ contract, axis, disclosures, categoryOrder, selectionSection, defaults, syncValueAxis? })` from `shared/distribution/plot.ts` (import it by that path, never the distribution barrel). The plot contributes only its contract and its category axis; pane section, defaults, collection, kit and sync are shared. `def.collect(engine, settings)` gives the data for tests.

## Definition = the plot

`definePlot<Type, Settings>({...})` in `definition.ts`. Contract type: `PlotDefinition` in `definePlot.ts`. Example: `transition-matrix/definition.ts`.

- Required: `type, name, group, getDefaultSettings, paneSections, view`. Optional: `size` ({min?, w?, h?} in grid units — omit for the standard 11×10/12×12, see `DEFAULT_PLOT_SIZE`), `requireCapabilities, getSubtitle, consumesMetrics, onCommand`, and the declared behaviour below (`cursor`, `sync`, `playback`). NO `component` field, NO sizing functions.
- `view.deriveView(engine, settings, ctx?) → plotView(kit, input, { hasData?, meta? }) | null` — the ONE derivation for screen AND export. `input` is ONE plain object the kit draws from; engine lookups a kit needs later (tooltip builders) are closures over the non-reactive engine built here. `ctx = {itemWidth, itemHeight}` (grid units; display budgets only).
- `view.viewDependsOnWidth: true` → screen re-derives on width resize (aoi-stream, evolving-metrics). Height never re-derives.
- `view.viewOnly = { settings: ['highlights'], input: (settings, engine) => ({ highlights }) }` — keys deriveView never reads: changes repaint, never re-derive; `input` maps them into the input on screen and in export (the view must not compute them itself).
- Behaviour is DECLARED; the platform (`shared/plotHost.svelte.ts`) implements it once for every plot:
  - `cursor?: { time?(s), stimulus?(s), publishes? }` → the PLOT CURSOR port (see Host boundary). `time` = this plot's stimulus while its x axis is absolute time, else null.
  - `sync?: [{ channel, offer({ settings, view, item, engine }) → { key, own } | null, settings?(s, max) | input?(view, max) }]` → `useSyncedMax`, screen only (export never syncs). `key` is what comparable plots match on (grid size included); `null` opts out (a user-set range wins).
  - `playback?: true` → playback clock membership + the `PlaybackFigure` shell, on screen and in export.
  - Interaction goes through the kit's `act` (see Kit): `act.toggle(key, value)`, `act.draft(patch)` / `act.commit(patch?)` (a drag: live preview, one undo step), `act.publish(cursor)`.
- `getSubtitle`: pass the shared factories `stimulusGroupSubtitle` / `stimulusParticipantSubtitle` (`shared/subtitles.ts`) directly — never hand-roll the stimulus/group/participant parts.
- Pane sections are DATA ONLY — a definition never imports or authors a Svelte section. Each `paneSections` entry is one of:
  - a shared-section key string: `'stimulus' | 'group' | 'participant' | 'metric' | 'timelineRange' | 'aoi' | 'event' | 'eyeMovement'` (all live solely in the `SHARED_SECTIONS` registry, `shared/components/sections/index.ts` — schema entries plus the rightly-bespoke `timelineRange` component; the shared `HIDE_NO_AOI_FIELD` constant covers the bar/stream/matrix "Hide data" checkbox);
  - `{ key, props }` for a shared section with static overrides — component props (scarf passes `ordinalMode` to `'timelineRange'`) or schema entry-field overrides (`{ key: 'metric', props: { title: 'Metrics' } }`);
  - a schema section `{ key: '<type>:<name>', title, fields, summary?, defaultOpen? }` rendered by `SchemaSection`. Field kinds: `enum` (always a labeled Select — radios are a modal affordance, not a pane one; `valueKind: 'number'` for numeric id settings), `boolean`, `number`, `color`, `colorScale`, `scaleRange`, `stimulusColorRange`, `info` (display-only prose), `metrics` (contract-filtered instance picker). Hooks are plain functions: `showWhen(ctx)`, function-form `options(ctx)`, `read(settings, engine)`, `actions` (edit-link row: `{ label, onclick(ctx) }`); `ctx.common()` is the bulk-aware read (gate mode-dependent fields on `!mixed && value === …`), `ctx.update()` the bulk-aware write.
  - LAYOUT CAP (hard rule): a section is a vertical stack of full-width fields, plus `group: 'Caption'` (captioned run), `pair: true` (two neighbors share a 1fr/1fr row), and `actions` (edit-link row). Nothing else — no spans, widths, styles, `:global`. A pane needing more must become a new field kind or shared section, never inline Svelte.
  - Validation: `assertSettingsSchema` (registry.ts) throws on first use — field keys unique; every keyed field in `getDefaultSettings()` or carrying `default`; static enum defaults ∈ options; schema keys namespaced. Shared schemas are pinned against every referencing plot's defaults in `tests/paneSectionsRegistry.test.ts`.
- Register: hand-add to static literal `plotRegistry` (`registry.ts`). Intentionally static (feeds `VisualizationType`); never convert to glob loader.

## Metric library

- Settings carry `metricInstanceIds: string[]`; single-select plots read `[0]`.
- Transformer: `const CONTRACT = {...} as const satisfies PlotMetricContract` then `resolveMetric({instances, id, contract})` (see `transition-matrix/core/transformer.ts`). `PlotMetricContract` (`metrics/filters.ts`): `{outputShape, windowing: 'forbidden'|'required'|'allowed', crossParticipant: 'reduce'|'distribution'|'per-participant'|'samples'|'group-axis', multiSelect?}`.
- Definition declares the same contract via `consumesMetrics` (drives pane + library filters).
- Resolution failure → transformer returns `noMetric: true` → the kit's chrome returns the missing-metric placeholder.

## Host boundary (plotHost + usePlotData) — reactivity ends here

`PlotContainer.svelte` is markup only. `usePlotHost` (`shared/plotHost.svelte.ts`) resolves the definition, runs its declarations and derives the view via `usePlotData` (`shared/plotData.svelte.ts`). Below it: plain data only. Never re-create this wiring in plot code.

- Generic code over all plots resolves with `resolvePlotRuntime(item.type)` (`registry.ts`) and stays generic in `K extends PlotType` with `item: GridItemMap[K]`: the definition is then typed for that item's own settings. NEVER cast a definition to a hand-written shape (a cast hides renamed fields and wrong settings).

- Dependency surface is EXACTLY: `epoch` (item.redrawTimestamp), settings snapshot, `item.w` iff `viewDependsOnWidth`. `derive` runs untracked — nothing discovered implicitly.
- Settings reach deriveView as plain, deeply-frozen, deep-equal-gated snapshots. Transforms NEVER see a $state proxy. Mutating settings input throws.
- NEVER watch `engine.metadata`: all metadata mutations are workspace commands (epoch bump); dataset loads rebuild all grid items after engine load.
- Shared HOVER POSITION is NOT sync — it is THE PLOT CURSOR (`shared/plotCursor.svelte.ts`): two channels, TIME (scope-gated by stimulus) and PARTICIPANTS (a SET, because a similarity cell is a PAIR). Declare `cursor` on the definition (the platform builds the self-retracting port), publish LIVE accessors from the kit's `hover` via `act.publish` (read `act.scene()` when called, never index blindly — read back empty), repaint through the kit's `overlay.key` over a JOINED KEY of marked positions (the host reads the port into a plain `CursorRead`; `shared/cursorMarks.ts` has `timeCursor` (`key` / `draw` / `publish` for every time-axis plot), `cursorRows`, `drawTimeGuides`), and mark with the dashed OUTLINE (`strokeCrosshairRect` / `strokeCrosshairRing`) — the local CROSSHAIR fills, the cursor outlines. NEVER `useSyncedMax`: that is a monotone max over SETTINGS, and `0` is a real cursor position.
- Cross-plot SETTINGS sync: declared `sync` on the definition (the platform runs `useSyncedMax`, `shared/plotSync.svelte.ts`); no per-plot registry files. `key` is the tuple comparable plots match on (grid size included), `null` opts out. The returned reader gives the group max when it beats `own`, else null; declare where it lands: `settings` (BEFORE deriving) or `input` (after). NEVER scan `grid.items` for sibling state. Export never syncs.
- Metric-library edits = `updateMetricInstances` workspace command (full-array payload, one undo step, epoch bump on ALL items). Components use `metricInstanceHandlers` factories (take `workspace`); `engine.setMetricInstances` is reserved for the command handler.
- NEVER hold transform results in `$state`/`$state.raw` or call transforms from raw `$derived`/`$effect`.
- Export modal (`modals/export/export-figures/view.ts`) resolves the same way and applies the same boundary via `snapshotSettings`.

## Kit (pure drawing, one host)

A kit is plain functions over plain values: `export const xKit = defineKit<Input, Hover, Settings?>()({ label, chrome?, scene, fit?, clip?, draw, drawAboveAxes?, overlay?: { key?, draw }, hit?, hitChrome?, hoverKey?, hover?, click?, legend?, blockedRegions?, pointer? })` (contract: `shared/kit.ts`; reference: `shared/matrixKit.ts` + `tests/matrixKit.test.ts`). The engine `usePlot(kit, sources)` consumes the kit directly: the pure pipeline (`plotRender.ts`: `resolveLayout`, `buildScene`, `paintPlot`, `hitPlot`, `renderPlot` for headless/tests) cached in two object-returning stages (`plotStages.svelte.ts`).

- WHY stages: Svelte re-runs a derived on EVERY read once an input was replaced by an equal-but-new value and the derived returned an EQUAL value (number, same reference) — measured on 5.47 and 5.57; a per-cell read of a matrix-scan derived froze a 130-AOI matrix for 18 s. A fresh object gets a new version and caches. So: expensive work happens ONLY inside `chrome`/`scene`, which return fresh objects; kits never touch runes.
- `chrome(input, size)` → `{ axes?, gutters?, gradientLegend?, placeholder?, ...extra }` (what the frame needs; extra fields reach the scene as `ctx.chrome`). `placeholder` = data-level (noMetric → `METRIC_MISSING_MESSAGE`); while set, no scene is built.
- `scene(input, ctx)` → ONE fresh object with every geometry, colour and lookup the draw/hit/overlay need. `ctx = { frame, size, chrome, pixelRatio, gradientLegend }`. Declare `chrome` and `scene` FIRST in the literal (inference order). The host shallow-freezes it: draw/hit must not write into it.
- `fit(scene, ctx)` = size guard → `cannotFitPlaceholder(axis, extraSteps)` or null. `clip: false` for plots drawing labels outside the data rect.
- `draw(ctx, scene, frame)`; `drawAboveAxes` for marks the axis border would slice.
- Overlay: `overlay.key(scene, cursor, input)` = equality-stable repaint key (positions, not cursor arrays); `overlay.draw(ctx, scene, frame, { hover, cursor, input })`. With an overlay, hover repaints blit the cached data layer — NEVER re-run draw on mouse move (~2050ms regression once).
- Hover HARNESS-OWNED: `hit(scene, x, y, frame, input)` returns `FrameHit<Hover>`; the payload comes back as `hover` in `overlay.draw`/`click`. `hoverKey`/`hover` = deduped side effect. `hitChrome(scene, x, y, frame, ctx)` for chrome outside the data rect (a legend title's notes).
- Interaction: `hover(h, act)`, `click(h, act)`, `pointer(act)` (made once; may keep closure-local drag state). `act` = live reads `scene()`, `input()`, `frame()`, `settings()` + `publish`, `toggle`, `draft`, `commit`. Export hands an inert host.
- Caches that must survive resizes (textures, scratch buffers, force layouts): `memoByRef(fn)` (kit.ts) keyed by the immutable data object, or `cachedRaster`; never rebuilt per scene.
- Kits import NO `svelte` runtime and no value from a `.svelte`/`.svelte.ts` module (`import type` is fine), and never the `$lib/plots/shared` barrel: import submodules by path (`shared/frame`, `shared/canvasUtils`, `shared/cursorMarks`, …). `tests/plotKitBoundary.test.ts` checks it transitively, and that only `PlotCanvas` calls `usePlot`.
- Playback plots (`playback: true`) render through `shared/components/PlaybackFigure.svelte`: it owns the player, the media element and the play bar and merges their live state into the input (`input.player`); the trail draft is a writable `$derived`. Pure stimulus-space math is in `shared/stimulusSpace.ts`.
- Drafts (a pan, a dragged trail) are writable `$derived` (Svelte ≥ 5.25): `let x = $derived(committed)`, assigned while dragging, re-derived on commit. Never a `$state` draft merged over the committed value.
- Colorbar under the x-axis: `chrome.gradientLegend`; the harness reserves the band (title's real line count), places and draws it; `ctx.gradientLegend` is the placed geometry for title hit-tests. Palette fallback: `resolvePalette(colorScale, PRESET_PALETTES.X.colors)` from `$lib/color`.
- Matrix plots (transition matrix, similarity matrix, correlation heatmap, SPLOM, metric matrix) share `matrixKit`. R×C: square plots pass a single `labels`; a rectangular plot (metric matrix: participants × stimuli) passes independent `rowLabels`/`colLabels`. Color mapping is DECLARATIVE (`colorScale` + `colorValueRange` + `belowMinColor`/`aboveMaxColor`/`nonFiniteColor`) so screen recipes can override `colorValueRange` in the input; only value formatting (`formatCellValue`), tooltip rows (`getCellTooltip`), and custom cell content (`drawCells`, e.g. the SPLOM painter in `metric-correlation/core/splom.ts`, plus `drawCellsCursor`) are functions, built in `view.ts` from plain data. Matrix primitives live in `shared/matrixRenderer.ts` / `shared/matrixLayout.ts`.
- Tests: a `tests/<plot>Kit.test.ts` builds a scene from a fixture and asserts on it; draw into `recordingContext()` (`tests/helpers/canvasRecorder.ts`, a Proxy that counts every call).

## Hot path (draw/transform loops)

- No per-frame allocation; reuse buffers. GC dominates at 10k+ points.
- Render-bound data = flat TypedArrays, stride indexing. Render loops read flat buffers, plain `for` (no map/filter/reduce). Hoist constants; `|0`/`Math.floor` over `Math.round`.
- No large buffers in `$state`; no `$derived`/`$effect` per-element; no reactive read in a draw (kits make that impossible).
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
- Placeholder steps name REAL pane section titles: "Areas of Interest" (not "AOIs"), "Metrics", "Participant group", "Visualization", "Time range".
