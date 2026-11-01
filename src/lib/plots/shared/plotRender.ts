/**
 * The plot render pipeline as plain functions: a kit, its input and a canvas
 * size go in, a layout, a scene, pixels and hits come out. The engine
 * (`usePlot.svelte.ts`) caches each step in a derived and adds interaction;
 * `renderPlot` runs the whole pipeline once, with no Svelte (tests, headless).
 */
import { drawXAxisLabel, drawYAxisMainLabel } from './axisUtils'
import { PLOT_LEGEND_GAP } from './const'
import { drawCanvasPlaceholder, type PlotPlaceholderContent } from './drawCanvasPlaceholder'
import {
  gradientBandHeight,
  resolveCanvasFrame,
  type CanvasSize,
  type FrameHit,
  type PlotFrame,
} from './frame'
import type { KitChrome, PlotKit, SceneContext } from './kit'
import {
  computeGradientLegendGeometry,
  drawGradientLegend,
  gradientCapHit,
  type GradientLegendGeometry,
} from './legendGradient'
import {
  getLegendTooltipContent,
  getLegendTooltipPosition,
  hitTestLegend,
} from './legendRendering'
import { drawPlotArea } from './plotArea'

const NO_CHROME: KitChrome = Object.freeze({})

/** The frame and its chrome for one input at one canvas size. */
export interface PlotLayout<C extends KitChrome = KitChrome> {
  chrome: C
  size: CanvasSize
  frame: PlotFrame
  /** The placed colorbar, or null. */
  gradientLegend: GradientLegendGeometry | null
}

/** A built scene, or the placeholder shown instead of it. */
export interface PlotBuild<S, C extends KitChrome = KitChrome> {
  scene: S | null
  placeholder: PlotPlaceholderContent | null
  context: SceneContext<C>
}

export function resolveLayout<I, C extends KitChrome>(
  kit: PlotKit<I, C, any, any, any>,
  input: I,
  size: CanvasSize
): PlotLayout<C> {
  const chrome = kit.chrome ? kit.chrome(input, size) : (NO_CHROME as C)
  const slot = chrome.gradientLegend ?? null
  const bandHeight = gradientBandHeight(slot, size)
  const resolved = resolveCanvasFrame(size, chrome.gutters ?? {}, chrome.axes ?? {}, bandHeight)
  const frame: PlotFrame = {
    ...resolved.rect,
    leftTitleOffset: resolved.leftTitleOffset,
    bottomTitleOffset: resolved.bottomTitleOffset,
  }
  // The band directly below the x-axis gutter, across the content width.
  const gradientLegend =
    slot && bandHeight > 0
      ? computeGradientLegendGeometry({
          x: size.margin,
          y: frame.legendY + PLOT_LEGEND_GAP,
          availableWidth: Math.max(1, size.width - size.margin * 2),
          availableHeight: bandHeight,
          ...slot,
        })
      : null
  return { chrome, size, frame, gradientLegend }
}

export function buildScene<I, C extends KitChrome, S>(
  kit: PlotKit<I, C, S, any, any>,
  input: I,
  layout: PlotLayout<C>,
  pixelRatio: number
): PlotBuild<S, C> {
  const context: SceneContext<C> = {
    frame: layout.frame,
    size: layout.size,
    chrome: layout.chrome,
    pixelRatio,
    gradientLegend: layout.gradientLegend,
  }
  const placeholder = layout.chrome.placeholder ?? null
  if (placeholder) return { scene: null, placeholder, context }
  // Frozen so a draw or hit-test that writes into its scene throws instead of
  // silently changing what the next frame reads.
  const scene = Object.freeze(kit.scene(input, context)) as S
  return { scene, placeholder: kit.fit?.(scene, context) ?? null, context }
}

/** The data layer: marks (clipped unless `clip: false`), axis chrome, colorbar, marks above the axes. */
export function paintPlot<C extends KitChrome, S>(
  ctx: CanvasRenderingContext2D,
  kit: PlotKit<any, C, S, any, any>,
  layout: PlotLayout<C>,
  scene: S
): void {
  const f = layout.frame
  if (kit.clip !== false) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(f.x, f.y, f.width, f.height)
    ctx.clip()
    kit.draw(ctx, scene, f)
    ctx.restore()
  } else {
    kit.draw(ctx, scene, f)
  }

  const axes = layout.chrome.axes
  if (axes) {
    drawPlotArea(ctx, {
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      ticks: {
        bottom: axes.bottom?.ticks,
        top: axes.top?.ticks,
        left: axes.left?.ticks,
        right: axes.right?.ticks,
      },
    })
    if (axes.bottom?.title)
      drawXAxisLabel(ctx, axes.bottom.title, f.x, f.width, f.bottom, f.bottomTitleOffset)
    if (axes.left?.title)
      drawYAxisMainLabel(ctx, axes.left.title, f.x, f.y, f.height, f.leftTitleOffset)
  }

  if (layout.gradientLegend) drawGradientLegend(ctx, layout.gradientLegend)
  kit.drawAboveAxes?.(ctx, scene, f)
}

/**
 * What the pointer is over: a legend item (the standard Highlight tooltip), a
 * colorbar cap, else the kit's own hit inside the frame or on its chrome.
 */
export function hitPlot<I, C extends KitChrome, S, H>(
  kit: PlotKit<I, C, S, H, any>,
  layout: PlotLayout<C>,
  build: PlotBuild<S, C>,
  input: I,
  x: number,
  y: number
): FrameHit<H> | null {
  const scene = build.scene
  if (scene === null || build.placeholder) return null
  const band = kit.legend
  const geometry = band?.geometry(scene)
  if (band && geometry && geometry.items.length > 0) {
    const item = hitTestLegend(geometry, band.config, x, y)
    if (item) {
      const pos = getLegendTooltipPosition(item, band.config)
      return {
        content: getLegendTooltipContent(item, band.highlights(input).includes(item.identifier)),
        anchorX: pos.x,
        anchorY: pos.y,
        offset: { x: 0, y: 7 },
        cursor: 'pointer',
        data: band.hitData?.(item),
      }
    }
  }
  const cap = gradientCapHit(layout.gradientLegend, x, y)
  if (cap) return cap
  const f = layout.frame
  const inside = x >= f.x && x <= f.right && y >= f.y && y <= f.bottom
  return inside
    ? (kit.hit?.(scene, x, y, f, input) ?? null)
    : (kit.hitChrome?.(scene, x, y, f, build.context) ?? null)
}

/** Paint a placeholder card over the whole canvas. */
export function paintPlaceholder(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  placeholder: PlotPlaceholderContent
): void {
  drawCanvasPlaceholder(ctx, size.width, size.height, placeholder)
}

/**
 * The whole pipeline once, into a context the caller has prepared (cleared,
 * scaled to its pixel ratio): the placeholder, else the data layer.
 */
export function renderPlot<I, C extends KitChrome, S>(
  ctx: CanvasRenderingContext2D,
  kit: PlotKit<I, C, S, any, any>,
  input: I,
  size: CanvasSize,
  pixelRatio = 1
): PlotBuild<S, C> {
  const layout = resolveLayout(kit, input, size)
  const build = buildScene(kit, input, layout, pixelRatio)
  if (build.placeholder || build.scene === null) {
    paintPlaceholder(ctx, size, build.placeholder ?? '')
  } else {
    paintPlot(ctx, kit, layout, build.scene)
  }
  return build
}
