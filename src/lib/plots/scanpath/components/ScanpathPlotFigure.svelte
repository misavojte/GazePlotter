<script lang="ts">
  import {
    beginCanvasDrawing,
    finishCanvasDrawing,
  } from '$lib/plots/shared/canvasUtils'
  import {
    drawPlotArea,
    usePlot,
    toCanvasMargins,
    canvasBlockSelect,
    drawXAxisLabel,
    drawYAxisMainLabel,
    type BlockedRegion,
    type CanvasExportProps,
  } from '$lib/plots/shared'
  import { FONT_PRIMARY } from '$lib/plots/shared/const'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import {
    PLOT_AREA_TICK_LABEL_GAP_PX,
    SCANPATH_COLORS,
    SCANPATH_LAYOUT,
  } from '../const'
  import type { ScanpathData } from '../types'

  interface Props extends CanvasExportProps {
    data: ScanpathData
    showFixationOrder?: boolean
    showNumbers?: boolean
  }

  let {
    data,
    showFixationOrder = true,
    showNumbers = true,
    width = 400,
    height = 400,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  }: Props = $props()

  const L = SCANPATH_LAYOUT
  const TICK_FONT = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
  const TITLE_FONT = TICK_FONT // drawXAxisLabel / drawYAxisMainLabel use FONT_PRIMARY

  /** Lazy offscreen canvas for text measurement (browser only). */
  let measureCtx: CanvasRenderingContext2D | null = null
  function getMeasureCtx(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null
    if (measureCtx) return measureCtx
    const c = document.createElement('canvas')
    measureCtx = c.getContext('2d')
    return measureCtx
  }

  interface TextBox {
    width: number
    height: number
  }

  function measure(font: string, text: string): TextBox {
    const ctx = getMeasureCtx()
    if (!ctx || !text) {
      // SSR / context-unavailable fallback: approximate (0.6 × fontSize per char).
      const px = parseFontPx(font)
      return { width: text.length * px * 0.6, height: px }
    }
    ctx.font = font
    const m = ctx.measureText(text)
    const ascent = m.actualBoundingBoxAscent
    const descent = m.actualBoundingBoxDescent
    const height =
      Number.isFinite(ascent) && Number.isFinite(descent)
        ? ascent + descent
        : parseFontPx(font)
    return { width: m.width, height }
  }

  function parseFontPx(font: string): number {
    const match = font.match(/(\d+(?:\.\d+)?)px/)
    return match ? parseFloat(match[1]) : 12
  }

  function formatTick(v: number): string {
    if (!Number.isFinite(v)) return ''
    const abs = Math.abs(v)
    if (abs >= 1000) return Math.round(v).toString()
    if (abs >= 10) return v.toFixed(0)
    return v.toFixed(2)
  }

  function buildTicks(min: number, max: number, count: number) {
    const positions: number[] = []
    const labels: string[] = []
    if (!(max > min)) {
      positions.push(0.5)
      labels.push(formatTick(min))
      return { positions, labels }
    }
    const last = count - 1
    for (let i = 0; i < count; i++) {
      const t = i / last
      positions.push(t)
      labels.push(formatTick(min + (max - min) * t))
    }
    return { positions, labels }
  }

  /**
   * Layout pipeline:
   *   1. Pad the data bounding box.
   *   2. Materialise the actual tick-label strings.
   *   3. Measure every label and the axis titles with the real font.
   *   4. Derive the four margins from the measurements + visible gaps.
   *   5. Derive plot extent (xOffset, yOffset, plotW, plotH).
   *
   * Every number that affects margins is either measured or sourced from
   * `SCANPATH_LAYOUT`. No fixed-pixel guesses.
   */
  const layout = $derived.by(() => {
    const { minX, maxX, minY, maxY } = data.bbox
    const rawW = maxX - minX
    const rawH = maxY - minY
    const padX = rawW > 0 ? rawW * L.bboxPadding : 0.5
    const padY = rawH > 0 ? rawH * L.bboxPadding : 0.5
    const dataMinX = rawW > 0 ? minX - padX : minX - 0.5
    const dataMaxX = rawW > 0 ? maxX + padX : maxX + 0.5
    const dataMinY = rawH > 0 ? minY - padY : minY - 0.5
    const dataMaxY = rawH > 0 ? maxY + padY : maxY + 0.5

    const xTicks = buildTicks(dataMinX, dataMaxX, L.tickCount)
    const yTicks = buildTicks(dataMinY, dataMaxY, L.tickCount)

    // Measured worst-case dimensions.
    let xLabelMaxHeight = 0
    let firstXLabelHalfWidth = 0
    let lastXLabelHalfWidth = 0
    for (let i = 0; i < xTicks.labels.length; i++) {
      const m = measure(TICK_FONT, xTicks.labels[i])
      if (m.height > xLabelMaxHeight) xLabelMaxHeight = m.height
      if (i === 0) firstXLabelHalfWidth = m.width / 2
      if (i === xTicks.labels.length - 1) lastXLabelHalfWidth = m.width / 2
    }
    let yLabelMaxWidth = 0
    for (const lbl of yTicks.labels) {
      const m = measure(TICK_FONT, lbl)
      if (m.width > yLabelMaxWidth) yLabelMaxWidth = m.width
    }

    const xTitle = measure(TITLE_FONT, 'X')
    const yTitle = measure(TITLE_FONT, 'Y')
    // The Y title is drawn rotated -90°, so its un-rotated *height* becomes
    // its on-canvas *width* — that's what carves out the left margin.
    const yTitleCanvasWidth = yTitle.height

    // axisLabelOffsetX = distance from plot bottom to the TOP of the X title.
    //   tick-label gap + tick-label height + visible gap to the title.
    const axisLabelOffsetX =
      PLOT_AREA_TICK_LABEL_GAP_PX + xLabelMaxHeight + L.titleTickGapPx

    // axisLabelOffsetY = distance from plot left to the RIGHT edge of the
    // rotated Y title (the rotated baseline). The title then extends
    // `yTitleCanvasWidth` further left.
    const axisLabelOffsetY =
      PLOT_AREA_TICK_LABEL_GAP_PX + yLabelMaxWidth + L.titleTickGapPx

    // Y-axis chrome footprint vs the X-tick label that extends LEFT past
    // plotLeft (the leftmost X tick is centred on plotLeft). Left margin
    // must cover whichever side is wider.
    const yAxisChrome = axisLabelOffsetY + yTitleCanvasWidth + L.leftSafetyPx
    const leftMargin = Math.max(
      yAxisChrome,
      firstXLabelHalfWidth + L.leftSafetyPx
    )

    const bottomMargin =
      axisLabelOffsetX + xTitle.height + L.bottomSafetyPx
    const topMargin = L.topSafetyPx
    // drawPlotArea already clamps the LAST X tick label inward, so the right
    // margin only needs visual breathing room beyond that clamp.
    const rightMargin = Math.max(
      L.rightSafetyPx,
      // If the last label happens to be wider than its half-clearance, give
      // it a little more so the clamp is barely visible.
      lastXLabelHalfWidth * 0.25 + L.rightSafetyPx
    )

    // plot.plotAreaWidth/Height are the content area (total minus export margins);
    // carve the axis margins out of it so the export margins become outer padding.
    const xOffset = marginLeft + leftMargin
    const yOffset = marginTop + topMargin
    const plotW = Math.max(1, plot.plotAreaWidth - leftMargin - rightMargin)
    const plotH = Math.max(1, plot.plotAreaHeight - topMargin - bottomMargin)

    return {
      xOffset,
      yOffset,
      plotW,
      plotH,
      dataMinX,
      dataMaxX,
      dataMinY,
      dataMaxY,
      dataW: dataMaxX - dataMinX,
      dataH: dataMaxY - dataMinY,
      xTicks,
      yTicks,
      axisLabelOffsetX,
      axisLabelOffsetY,
    }
  })

  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: layout.xOffset,
      y: layout.yOffset,
      w: layout.plotW,
      h: layout.plotH,
    },
  ])

  function projectX(x: number): number {
    return layout.xOffset + ((x - layout.dataMinX) / layout.dataW) * layout.plotW
  }

  function projectY(y: number): number {
    // Eye-tracker y already grows downward; canvas y also grows downward.
    // No vertical flip — fixations render where the eye was on the screen.
    return layout.yOffset + ((y - layout.dataMinY) / layout.dataH) * layout.plotH
  }

  function radiusFor(duration: number): number {
    // Area linear in duration → radius ∝ √duration. Convention matches Tobii
    // Pro Lab, BeGaze, OGAMA. Stevens' law for area is sublinear (ψ ∝ φ^0.7),
    // so long fixations are slightly underweighted perceptually — accepted as
    // the cross-tool convention rather than re-derived per plot.
    if (data.maxDuration <= 0) {
      return (L.minRadius + L.maxRadius) / 2
    }
    const t = Math.sqrt(Math.max(0, duration) / data.maxDuration)
    return L.minRadius + (L.maxRadius - L.minRadius) * t
  }

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    const { xOffset, yOffset, plotW, plotH } = layout

    // Polyline (under the circles).
    if (showFixationOrder && data.fixations.length > 1) {
      ctx.save()
      ctx.strokeStyle = SCANPATH_COLORS.polyline
      ctx.lineWidth = L.polylineWidth
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      const first = data.fixations[0]
      ctx.moveTo(projectX(first.x), projectY(first.y))
      for (let i = 1; i < data.fixations.length; i++) {
        const f = data.fixations[i]
        ctx.lineTo(projectX(f.x), projectY(f.y))
      }
      ctx.stroke()
      ctx.restore()
    }

    // Fixation circles.
    ctx.save()
    ctx.fillStyle = SCANPATH_COLORS.fixationFill
    ctx.strokeStyle = SCANPATH_COLORS.fixationStroke
    ctx.lineWidth = L.circleStrokeWidth
    for (const f of data.fixations) {
      const cx = projectX(f.x)
      const cy = projectY(f.y)
      const r = radiusFor(f.duration)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()

    // Number labels (above the circles).
    if (showNumbers) {
      ctx.save()
      ctx.fillStyle = SCANPATH_COLORS.numberLabel
      ctx.font = `${L.numberFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (const f of data.fixations) {
        const cx = projectX(f.x)
        const cy = projectY(f.y)
        const r = radiusFor(f.duration)
        ctx.fillText(String(f.rank), cx + r + L.numberOffset, cy - r * 0.4)
      }
      ctx.restore()
    }

    // Axis chrome + frame (last, so it sits on top of overflowing strokes).
    drawPlotArea(ctx, {
      x: xOffset,
      y: yOffset,
      width: plotW,
      height: plotH,
      ticks: { bottom: layout.xTicks, left: layout.yTicks },
    })

    drawXAxisLabel(ctx, 'X', xOffset, plotW, yOffset + plotH, layout.axisLabelOffsetX)
    drawYAxisMainLabel(ctx, 'Y', xOffset, yOffset, plotH, layout.axisLabelOffsetY)

    finishCanvasDrawing(plot.canvasState)
  }

  const plot = usePlot({
    render: renderCanvas,
    width: () => width,
    height: () => height,
    margins: () => toCanvasMargins({ marginTop, marginRight, marginBottom, marginLeft }),
    dpiOverride: () => dpiOverride,
    deps: () => [data, showFixationOrder, showNumbers],
  })

</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: blockedRegions }}
></canvas>
