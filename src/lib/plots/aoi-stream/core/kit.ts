/**
 * The AOI Timeline kit: one AOI metric over time bins, as a streamgraph
 * (default), a zero-based distribution stack, offset ridgelines or a heatmap
 * (one row per AOI). The scene carries the stream coordinates, so the draw,
 * the marks above the axes and the hover all read one geometry.
 */
import { desaturateToWhite } from '$lib/color'
import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
import { AXIS_CONFIG, drawRowLabels, truncatedRowLabels } from '$lib/plots/shared/axisUtils'
import {
  alignToPixelCenter,
  fillCrosshairBand,
  strokeCrosshairGuides,
} from '$lib/plots/shared/canvasUtils'
import {
  AREA_DIVIDER,
  FONT_PRIMARY,
  GRIDLINE_PRIMARY,
  GRIDLINE_SECONDARY,
  PLOT_BORDER_PX,
  PLOT_EDGE_PAD_TOP,
  PLOT_LEGEND_GAP,
} from '$lib/plots/shared/const'
import { timeCursor, type TimeAxis } from '$lib/plots/shared/cursorMarks'
import {
  METRIC_MISSING_MESSAGE,
  cannotFitPlaceholder,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import type { FrameAxes, FrameHit, GradientLegendSlot } from '$lib/plots/shared/frame'
import { defineKit, memoByRef } from '$lib/plots/shared/kit'
import { withQualifiers } from '$lib/plots/shared/labels'
import {
  LEGEND_CONFIG,
  calculateFlatLegendHeight,
  computeFlatLegendGeometry,
  drawLegend,
  type LegendItem,
  type LegendItemGeometry,
} from '$lib/plots/shared/legendRendering'
import {
  TICK_LENGTH,
  bottomOriginYTicks,
  centeredYTicks,
  niceTimelineTicks,
  paintRowCells,
} from '$lib/plots/shared/plotArea'
import { RIDGELINE_CONTENT_FILL } from '../const'
import type { AoiStreamPlotResult, AoiStreamPlotSettings } from '../types'
import {
  computeAoiStreamYAxis,
  createRenderBuckets,
  resolveHeatRange,
  transformStreamDataToCoordinates,
} from './layout'
import { drawCatmullRom } from './path'
import type { AoiStreamInput } from './view'

type Alignment = NonNullable<AoiStreamPlotSettings['alignment']>

export type AoiStreamHover = {
  kind: 'legend' | 'bin'
  item?: LegendItemGeometry
  binIndex?: number
  x?: number
}

const MIN_SERIES_ROW_HEIGHT = 8
const MIN_STREAM_HEIGHT = 40

/**
 * The coordinate transform's scratch buffers, one set per result: it rewrites
 * them in place on every scene, so a resize or a highlight change allocates no
 * new set. One result is drawn by one host (export derives its own).
 */
const bucketsOf = memoByRef(createRenderBuckets)

/**
 * Left edge per mode: mirrored value ticks + title (stream/distribution), the
 * scale-bar strip + title (ridgeline), or AOI row labels (heatmap; its metric
 * name is in the gradient legend). No axes without bins: the empty result's
 * timeline is fabricated.
 */
function streamAxes(
  data: AoiStreamPlotResult,
  alignment: Alignment,
  heatmapAoiLabels: string[]
): FrameAxes | null {
  if (data.binCount <= 0) return null
  // Pixel-independent axis domains; `yDomain` is the one the stream coordinates scale by.
  const xAxisTicks = niceTimelineTicks(data.timeline)
  // Time is the main axis here, so the binning window is a mid-dot qualifier on
  // the time label (e.g. "Elapsed time / ms · 500 ms window / 100 ms step"); no
  // time-range qualifier — the axis itself shows the range.
  const bottom = { ticks: xAxisTicks, title: withQualifiers('Elapsed time / ms', data.windowLabel) }
  const top = { ticks: { positions: xAxisTicks.positions } }
  if (alignment === 'heatmap') return { bottom, top, left: { reserve: heatmapAoiLabels } }
  if (alignment === 'ridgeline') {
    // Whole percents only, so '100' is the widest scale-bar label.
    return { bottom, top, left: { title: data.yAxisLabel, reserve: ['0', '100'] } }
  }
  const yDomain = computeAoiStreamYAxis(data, alignment)
  const left =
    alignment === 'stream'
      ? centeredYTicks(yDomain.axisTicks, yDomain.axisHalfRange)
      : bottomOriginYTicks(yDomain.axisTicks, yDomain.yAxisMax)
  return {
    bottom,
    top,
    left: { ticks: left, title: data.yAxisLabel },
    right: { ticks: { positions: left.positions } },
  }
}

/** Highlighted AOI ids; null when nothing is highlighted (nothing dims). */
function highlightMask(highlights: readonly string[]): Map<number, boolean> | null {
  if (highlights.length === 0) return null
  const mask = new Map<number, boolean>()
  for (const h of highlights) {
    const id = parseInt(h)
    if (!isNaN(id)) mask.set(id, true)
  }
  return mask
}

export const aoiStreamKit = defineKit<AoiStreamInput, AoiStreamHover, AoiStreamPlotSettings>()({
  label: 'AOI Timeline visualization',

  chrome: (input, size) => {
    const { data, settings } = input
    const alignment = settings.alignment ?? 'stream'
    const plotAreaWidth = Math.max(1, size.width - size.margin * 2)

    const legendItems: LegendItem[] = data.series.map(s => ({
      identifier: s.id.toString(),
      name: s.label,
      color: s.color,
      type: 'fixation' as const,
    }))
    // The heatmap's gradient legend is the harness's `gradientLegend` band.
    const legendHeight =
      alignment === 'heatmap'
        ? 0
        : calculateFlatLegendHeight(legendItems, Math.max(0, plotAreaWidth), LEGEND_CONFIG)

    // Heatmap AOI row labels, capped + pre-truncated (truncatedRowLabels owns the
    // budget rule). Reads the canvas WIDTH, not the frame; the frame depends on
    // the reserved width.
    const heatmapAoiLabels =
      alignment === 'heatmap' ? truncatedRowLabels(data.series.map(s => s.label), size.width) : []

    // Same range resolver as the cells, so the colorbar ends match the gradient.
    const gradientLegend: GradientLegendSlot | null =
      alignment !== 'heatmap'
        ? null
        : {
            colorScale: resolvePalette(settings.colorScale, PRESET_PALETTES.HEAT.colors),
            valueRange: input.colorValueRange,
            effectiveMaxValue: resolveHeatRange(input.colorValueRange, data.maxValue)[1],
            title: data.yAxisLabel,
            belowMinColor: settings.belowMinColor,
            aboveMaxColor: settings.aboveMaxColor,
          }

    // Stream/distribution mirror their value ticks on the right edge.
    const rightPad =
      alignment === 'ridgeline' || alignment === 'heatmap'
        ? PLOT_BORDER_PX
        : PLOT_BORDER_PX + TICK_LENGTH

    return {
      placeholder: data.noMetric ? METRIC_MISSING_MESSAGE : null,
      axes: streamAxes(data, alignment, heatmapAoiLabels),
      // PLOT_LEGEND_GAP is folded into the legend block; the legend anchors at
      // frame.legendY + PLOT_LEGEND_GAP.
      gutters: {
        pad: { top: PLOT_EDGE_PAD_TOP, right: rightPad },
        legendHeight: legendHeight > 0 ? PLOT_LEGEND_GAP + legendHeight : 0,
      },
      gradientLegend,
      legendItems,
      legendHeight,
      plotAreaWidth,
      heatmapAoiLabels,
    }
  },

  scene: (input, { frame, size, chrome }) => {
    const { data, settings } = input
    const alignment = settings.alignment ?? 'stream'
    const highlights = input.highlights ?? []

    const legendGeometry = computeFlatLegendGeometry(
      chrome.legendItems,
      LEGEND_CONFIG,
      size.margin,
      frame.legendY + PLOT_LEGEND_GAP,
      Math.max(0, chrome.plotAreaWidth)
    )

    // The frame arrives floored (resolveFrameLayout floors the rect).
    let coords: ReturnType<typeof transformStreamDataToCoordinates> | null = null
    if (frame.width > 0 && frame.height > 0 && data.binCount > 0) {
      coords = transformStreamDataToCoordinates(
        {
          data,
          alignment,
          floorLeft: frame.x,
          floorTop: frame.y,
          floorWidth: frame.width,
          floorHeight: frame.height,
          floorBottom: frame.bottom,
          syncedMTopOverride: input.syncedMTopOverride ?? null,
          highlightMaskById: highlightMask(highlights),
          ridgelineScale: settings.ridgelineScale,
          colorScale: settings.colorScale,
          colorValueRange: input.colorValueRange,
          belowMinColor: settings.belowMinColor,
          aboveMaxColor: settings.aboveMaxColor,
        },
        bucketsOf(data)
      )
    }

    // x is absolute ms in all four alignments. Gated on real bins: the empty
    // result carries a fabricated 0–100 ms timeline (`emptyAoiStreamResult`)
    // that this plot never draws. No rows: every series is group-aggregated.
    const timeAxis: TimeAxis = { band: data.binCount > 0 ? frame : null, timeline: data.timeline }

    return {
      data,
      alignment,
      highlights,
      frame,
      timeAxis,
      coords,
      legendGeometry,
      legendHeight: chrome.legendHeight,
      heatmapAoiLabels: chrome.heatmapAoiLabels,
    }
  },

  fit: ({ data, alignment }, { frame }) => {
    const n = data.series.length
    if (n === 0) return null
    const fits =
      alignment === 'ridgeline' || alignment === 'heatmap'
        ? frame.height >= n * MIN_SERIES_ROW_HEIGHT
        : frame.height >= MIN_STREAM_HEIGHT
    if (fits) return null
    return cannotFitPlaceholder(
      'height',
      alignment === 'ridgeline' || alignment === 'heatmap'
        ? ['Merge some AOIs in Plot Settings > Areas of Interest']
        : []
    )
  },

  draw: (ctx, scene, frame) => {
    const { coords, data, alignment } = scene
    if (coords === null) return
    const { buckets, seriesPaint, seriesRanks } = coords
    const { xPositions, seriesBuckets } = buckets
    const binCount = data.binCount
    const seriesCount = data.series.length
    const renderBinCount = binCount + 2

    // Heatmap: one row per AOI, one cell per bin (render index i is bin i − 1).
    if (alignment === 'heatmap') {
      return paintRowCells(ctx, frame, seriesCount, [0, binCount], (s, put) => {
        const colors = seriesPaint[s].heatmapBinColors!
        for (let i = 1; i <= binCount; i++) {
          if (colors[i] !== 'transparent') put(i - 1, i, colors[i])
        }
      })
    }

    for (let s = 0; s < seriesCount; s++) {
      const bucket = seriesBuckets[s]
      const paint = seriesPaint[s]

      if (alignment === 'distribution' && seriesRanks) {
        const binWidth = frame.width / binCount
        ctx.fillStyle = paint.color
        ctx.strokeStyle = AREA_DIVIDER.COLOR
        ctx.lineWidth = AREA_DIVIDER.WIDTH

        let runStart = 1
        while (runStart <= binCount) {
          const startRank = seriesRanks[s * renderBinCount + runStart]
          let runEnd = runStart
          while (runEnd < binCount) {
            if (seriesRanks[s * renderBinCount + (runEnd + 1)] !== startRank) break
            runEnd++
          }
          ctx.beginPath()
          for (let j = runStart; j <= runEnd; j++) {
            const x = frame.x + (j - 1) * binWidth
            ctx.lineTo(x, bucket.topY[j])
            ctx.lineTo(x + binWidth, bucket.topY[j])
          }
          for (let j = runEnd; j >= runStart; j--) {
            const x = frame.x + (j - 1) * binWidth
            ctx.lineTo(x + binWidth, bucket.bottomY[j])
            ctx.lineTo(x, bucket.bottomY[j])
          }
          ctx.closePath()
          ctx.fill()
          if (binWidth >= 5) ctx.stroke()
          runStart = runEnd + 1
        }
      } else {
        ctx.beginPath()
        ctx.moveTo(xPositions[0], bucket.topY[0])
        drawCatmullRom(ctx, xPositions, bucket.topY, true, renderBinCount)
        drawCatmullRom(ctx, xPositions, bucket.bottomY, false, renderBinCount)
        ctx.closePath()
        ctx.fillStyle = paint.color
        ctx.fill()
        ctx.strokeStyle = AREA_DIVIDER.COLOR
        ctx.lineWidth = AREA_DIVIDER.WIDTH
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      if (alignment === 'ridgeline' && paint.stripBottom !== undefined) {
        ctx.beginPath()
        ctx.moveTo(alignToPixelCenter(frame.x), paint.stripBottom)
        ctx.lineTo(alignToPixelCenter(frame.x + frame.width), paint.stripBottom)
        ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
        ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
        ctx.stroke()
      }
    }

    // Ridgeline relief effect
    if (alignment === 'ridgeline') {
      ctx.save()
      for (let s = 0; s < seriesCount - 1; s++) {
        const currentBucket = seriesBuckets[s]
        for (let cover = s + 1; cover < seriesCount; cover++) {
          const coverBucket = seriesBuckets[cover]
          const coverPaint = seriesPaint[cover]
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(xPositions[0], coverBucket.topY[0])
          drawCatmullRom(ctx, xPositions, coverBucket.topY, true, renderBinCount)
          drawCatmullRom(ctx, xPositions, coverBucket.bottomY, false, renderBinCount)
          ctx.closePath()
          ctx.clip()
          ctx.fillStyle = desaturateToWhite(coverPaint.color, 0.3)
          ctx.beginPath()
          ctx.moveTo(xPositions[0], currentBucket.topY[0])
          drawCatmullRom(ctx, xPositions, currentBucket.topY, true, renderBinCount)
          drawCatmullRom(ctx, xPositions, currentBucket.bottomY, false, renderBinCount)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      ctx.restore()
    }

    ctx.globalAlpha = 1.0
  },

  // Gutter marks the axes don't draw: heatmap row labels, ridgeline scale bar, legend.
  drawAboveAxes: (ctx, scene, frame) => {
    const { coords, data, alignment } = scene
    if (coords === null) return
    const { seriesPaint } = coords
    ctx.font = `${AXIS_CONFIG.fontSize}px ${AXIS_CONFIG.fontFamily}`
    ctx.fillStyle = AXIS_CONFIG.color

    if (alignment === 'heatmap') {
      ctx.save()
      drawRowLabels(ctx, scene.heatmapAoiLabels, frame.x, frame.y, frame.height / data.series.length)
      ctx.restore()
    }

    if (alignment === 'ridgeline') {
      const centerY = frame.y + frame.height / 2
      const referenceHeight = seriesPaint[0]?.referenceHeight ?? 0
      // Whole percents only: the left axis reserves '100', the widest label.
      const heightAt = (v: number) => (referenceHeight * RIDGELINE_CONTENT_FILL * v) / 100
      let scaleMaxValue = 100
      while (heightAt(scaleMaxValue) > frame.height && scaleMaxValue > 1) {
        scaleMaxValue = Math.max(1, Math.floor(scaleMaxValue / 2))
      }
      const scaleHeight = heightAt(scaleMaxValue)
      const scaleTop = alignToPixelCenter(centerY - scaleHeight / 2)
      const scaleBottom = alignToPixelCenter(centerY + scaleHeight / 2)
      const scaleX = alignToPixelCenter(frame.x - 5)
      const tickXStart = alignToPixelCenter(scaleX - 5)
      ctx.save()
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `${AXIS_CONFIG.fontSize - 2}px ${FONT_PRIMARY.FAMILY}`
      ctx.fillText('0', tickXStart - 3, scaleBottom)
      ctx.fillText(scaleMaxValue.toString(), tickXStart - 3, scaleTop)
      ctx.beginPath()
      ctx.strokeStyle = GRIDLINE_PRIMARY.COLOR
      ctx.lineWidth = 1
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(scaleX, scaleTop)
      ctx.moveTo(scaleX, scaleBottom)
      ctx.lineTo(tickXStart, scaleBottom)
      ctx.moveTo(scaleX, scaleTop)
      ctx.lineTo(tickXStart, scaleTop)
      ctx.stroke()
      ctx.restore()
    }

    if (alignment !== 'heatmap' && scene.legendGeometry.items.length > 0 && scene.legendHeight > 0) {
      drawLegend(ctx, scene.legendGeometry, LEGEND_CONFIG, scene.highlights)
    }
  },

  overlay: {
    key: timeCursor.key,
    draw: (ctx, scene, frame, { hover, cursor }) => {
      const { data } = scene
      // Before the local-hover early return below: the remote mark must survive it.
      timeCursor.draw(ctx, scene, cursor)
      const hoveredBinIndex = hover?.kind === 'bin' ? (hover.binIndex ?? null) : null
      const mouseXPx = hover?.kind === 'bin' ? (hover.x ?? null) : null
      if (hoveredBinIndex === null && mouseXPx === null) return
      if (frame.width <= 0 || frame.height <= 0 || data.binCount <= 0) return

      ctx.save()
      ctx.beginPath()
      ctx.rect(frame.x, frame.y, frame.width, frame.height)
      ctx.clip()

      if (hoveredBinIndex !== null) {
        const binWidth = frame.width / data.binCount
        const binX = frame.x + hoveredBinIndex * binWidth

        // Window highlight stays in the SAME bin-index space as the step so the two
        // stay concentric (time space would slide the band off the step for sliding
        // windows). The window spans windowSize / stepSize bins, centred on the bin.
        const windowBins = data.stepSize > 0 ? data.windowSize / data.stepSize : 1
        const binCenterX = binX + binWidth / 2
        const halfWindowPx = (windowBins * binWidth) / 2
        const xStart = Math.max(frame.x, binCenterX - halfWindowPx)
        const xEnd = Math.min(frame.x + frame.width, binCenterX + halfWindowPx)
        const rectWidth = xEnd - xStart

        if (rectWidth > 0) fillCrosshairBand(ctx, xStart, frame.y, rectWidth, frame.height, 0.08)
        fillCrosshairBand(ctx, binX, frame.y, binWidth, frame.height, 0.15)
      }

      if (mouseXPx !== null) {
        const x = alignToPixelCenter(mouseXPx)
        strokeCrosshairGuides(ctx, [x, frame.y, x, frame.bottom])
      }

      ctx.restore()
    },
  },

  hit: ({ data }, mx, my, frame) => {
    // No bins means the blank empty-result shell: no axis was drawn, so there is
    // nothing to report a position in.
    if (data.binCount <= 0) return null
    const binWidth = frame.width / data.binCount
    const binIndex = Math.max(0, Math.min(data.binCount - 1, Math.floor((mx - frame.x) / binWidth)))

    const binStartTime = data.timeline.minValue + binIndex * data.stepSize
    const binEndTime = binStartTime + data.windowSize
    const content: FrameHit['content'] = [
      { key: 'Window', value: `${Math.round(binStartTime)} ms – ${Math.round(binEndTime)} ms` },
      { key: 'Bin', value: `${binIndex + 1} of ${data.binCount}` },
    ]

    // Show each AOI's value in the metric's native unit, matching the y-axis.
    // (Do NOT synthesise a "%" — `values` are ms/count/% group-aggregated
    // values, not participant shares.)
    const unitSuffix = data.unit ? ` ${data.unit}` : ''
    const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unitSuffix}`
    const aoiValues: { label: string; value: number }[] = []
    for (const seriesItem of data.series) {
      const value = seriesItem.values[binIndex]
      if (Number.isFinite(value) && value > 0) {
        aoiValues.push({ label: seriesItem.label, value })
      }
    }
    aoiValues.sort((a, b) => b.value - a.value)
    for (const aoi of aoiValues.slice(0, 4)) {
      content.push({ key: aoi.label, value: fmt(aoi.value) })
    }
    if (aoiValues.length > 4) {
      const remaining = aoiValues.slice(4)
      const otherSum = remaining.reduce((sum, aoi) => sum + aoi.value, 0)
      content.push({ key: `Other ${remaining.length} AOIs`, value: fmt(otherSum) })
    }

    return {
      content,
      anchorX: mx,
      anchorY: my,
      offset: { x: 15, y: 15 },
      data: { kind: 'bin' as const, binIndex, x: mx },
    }
  },

  // Published through the TIME map (the one the axis ticks and areas use), NOT
  // the bin-index map the hovered-bin bands use; they differ once
  // stepSize !== windowSize. A legend hover clears it, like the local CROSSHAIR.
  hover: (hover, act) => timeCursor.publish(act, hover?.kind === 'bin' ? (hover.x ?? null) : null),

  // The host tracks the hovered legend item, so click needs no coords.
  click: (hover, act) => {
    if (hover?.kind === 'legend' && hover.item) act.toggle('highlights', hover.item.identifier)
  },

  legend: {
    geometry: scene =>
      scene.alignment === 'heatmap' || scene.legendHeight === 0 ? null : scene.legendGeometry,
    config: LEGEND_CONFIG,
    highlights: input => input.highlights ?? [],
    hitData: item => ({ kind: 'legend' as const, item }),
  },
})
