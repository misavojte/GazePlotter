---
description: Canvas rendering, GC optimization, and data structures for building or modifying plots in GazePlotter. MUST use when modifying anything under src/lib/plots.
---

# GazePlotter Plot / Canvas Guidelines

## DOs

- Use Canvas API (canvasState.context) for all data-heavy rendering instead of SVG or DOM nodes.
- Use requestAnimationFrame mechanics (via beginCanvasDrawing / finishCanvasDrawing).
- Pre-compute style lookups from Map into flat, dense Arrays (e.g., createStyleArrays) before the render loop for O(1) access.
- Data Structures: Always use flattened TypedArray objects (Float32Array, Float64Array, Int32Array) for rendering data and matrix math. Never use nested arrays (e.g., number[][]) as they destroy cache locality and trigger GC.
- Read data using stride logic (e.g., for (let i = 0; i < segmentCount; i++) { const idx = i \* RECT_STRIDE; const xNorm = buffer[idx]; }).
- Separate metrics (structural height depending only on data) from layout (dynamic logic based on available chartWidth / availableHeight).
- Utilize the Plot Registry (src/lib/plots/registry.ts) when creating a new plot (requires getDefaultConfig, getDefaultHeight, getDefaultWidth).
- Keep Svelte component boundaries fluid (width: 100%; height: 100%); actual dimensions are governed by the Grid Workspace.

## DONTs

- NO allocating objects or arrays inside Canvas render loops (for loops). Memory allocation here triggers heavy GC pauses with 10k+ data points.
- Do NOT use $derived or $effect for per-element transformations if the data array is massive. Do batch processing.
- Do NOT rely on .map(), .filter(), or .reduce() inside the renderCanvas() functions. Use traditional for loops.
- Do NOT hardcode colors in renderer.ts. Always respect the style arrays derived from data.stylingAndLegend with desaturateToWhite logic for dimmed highlight states.
- Do NOT use Math.round() inside loops when Math.floor() or bitwise (| 0) is sufficient. Hoist constants out of loops.

## CONTEXT

### Deep Data Flow & Memory Pooling

GazePlotter deals with massive, high-frequency eye-tracking data. Architecture relies on Zero Per-Frame Allocations and Unidirectional Flow.

1. The Binary Engine (src/lib/data/engine): Raw data lives in massive Float32Array internal buffers managed by DataEngine. It is intentionally kept out of Svelte $state to avoid proxy overhead.
2. The Collector Pattern (core/collector.ts): When reading from the binary engine, use a single-pass Collector that aggregates data.
3. Workspace Recycling (CollectorWorkspace pattern): For continuous updates (like timescale dragging), components use a stateful workspace object passed back and forth to reuse initialized typed arrays (e.g. diffBuffer, partialBuffer, valueBuffer). Never re-allocate typed arrays if you can recycle them by passing a workspace object.
4. The Transformer Pattern (core/transformer.ts): Transforms the Collector output into final presentation TypedArray (e.g., normalizing matrices or scaling event buckets). Transformers DO NOT map objects. They push purely numeric data into Float32GrowBuffer objects or return flat Float64Array matrices (never [][]).

### Strict Architectural Layers

When building or modifying a plot, strict layer separation must be maintained in the directory structure:

1. Transformer / Collector (core/transformer.ts, core/collector.ts): Pure functions taking stimulusId, participantIds, and parameters, reading from engine, outputting raw TypedArray buffers. No DOM/Canvas awareness here.
2. Layout (core/layout.ts): Pure functions calculating dimensions, margins, scales (scaleFactor), and detecting responsive states (isCompactMode). No data mapping here.
3. Component (components/PlotFigure.svelte): Svelte presentation layer. Wires up Svelte 5 Runes, handles mouse interactions/hoverTimeout, passes pre-computed data to Renderer.
4. Renderer (core/renderer.ts): Pure procedural Canvas API painting. Receives Canvas ctx, layout contexts, style arrays, flattened data buffers. No array iteration using .map() or .forEach() allowed; use raw for loops.

### Coordinate Normalization

Plot data coordinates (like xNorm, wNorm) are universally normalized to percentages (0.0 to 1.0) during Transformer phase. Renderer multiplies these by dynamic plotAreaWidth to get exact pixel coordinates. Never calculate absolute pixels in Transformer.
