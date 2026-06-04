<script lang="ts">
  import {
    useFramedPlot,
    canvasBlockSelect,
    NO_MARGINS,
    type CanvasExportProps,
    type PlotFrame,
    type PlotAreaTicks,
  } from '$lib/plots/shared'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { SCANPATH_COLORS, SCANPATH_LAYOUT } from '../const'
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
    margins = NO_MARGINS,
  }: Props = $props()

  const L = SCANPATH_LAYOUT

  function formatTick(v: number): string {
    if (!Number.isFinite(v)) return ''
    const abs = Math.abs(v)
    if (abs >= 1000) return Math.round(v).toString()
    if (abs >= 10) return v.toFixed(0)
    return v.toFixed(2)
  }

  function buildTicks(min: number, max: number, count: number): PlotAreaTicks {
    if (!(max > min)) return { positions: [0.5], labels: [formatTick(min)] }
    const positions: number[] = []
    const labels: string[] = []
    const last = count - 1
    for (let i = 0; i < count; i++) {
      const t = i / last
      positions.push(t)
      labels.push(formatTick(min + (max - min) * t))
    }
    return { positions, labels }
  }

  /** Padded data bounding box + its tick scales. */
  const scale = $derived.by(() => {
    const { minX, maxX, minY, maxY } = data.bbox
    const rawW = maxX - minX
    const rawH = maxY - minY
    const padX = rawW > 0 ? rawW * L.bboxPadding : 0.5
    const padY = rawH > 0 ? rawH * L.bboxPadding : 0.5
    const dataMinX = minX - (rawW > 0 ? padX : 0.5)
    const dataMaxX = maxX + (rawW > 0 ? padX : 0.5)
    const dataMinY = minY - (rawH > 0 ? padY : 0.5)
    const dataMaxY = maxY + (rawH > 0 ? padY : 0.5)
    return {
      dataMinX,
      dataMaxX,
      dataMinY,
      dataMaxY,
      dataW: dataMaxX - dataMinX,
      dataH: dataMaxY - dataMinY,
      xTicks: buildTicks(dataMinX, dataMaxX, L.tickCount),
      yTicks: buildTicks(dataMinY, dataMaxY, L.tickCount),
    }
  })

  const plot = useFramedPlot({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, showFixationOrder, showNumbers],
    gutters: () => ({
      left: { tickLabels: scale.yTicks.labels, title: 'Y' },
      bottom: { tickLabels: scale.xTicks.labels, title: 'X' },
      pad: {
        top: L.topSafetyPx,
        right: L.rightSafetyPx,
        bottom: L.bottomSafetyPx,
        left: L.leftSafetyPx,
      },
    }),
    drawData: drawScanpath,
    // Marks may slightly overflow the plot area (edge fixations); the axis
    // frame is drawn on top afterwards, matching the pre-frame behaviour.
    clipData: false,
    axes: () => ({
      bottom: { ticks: scale.xTicks, title: 'X' },
      left: { ticks: scale.yTicks, title: 'Y' },
    }),
  })

  function projectX(x: number, frame: PlotFrame): number {
    return frame.x + ((x - scale.dataMinX) / scale.dataW) * frame.width
  }

  function projectY(y: number, frame: PlotFrame): number {
    // Eye-tracker y already grows downward, as does canvas y — no flip.
    return frame.y + ((y - scale.dataMinY) / scale.dataH) * frame.height
  }

  function radiusFor(duration: number): number {
    // Area linear in duration → radius ∝ √duration (Tobii Pro Lab / BeGaze /
    // OGAMA convention).
    if (data.maxDuration <= 0) return (L.minRadius + L.maxRadius) / 2
    const t = Math.sqrt(Math.max(0, duration) / data.maxDuration)
    return L.minRadius + (L.maxRadius - L.minRadius) * t
  }

  function drawScanpath(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    // Polyline (under the circles).
    if (showFixationOrder && data.fixations.length > 1) {
      ctx.save()
      ctx.strokeStyle = SCANPATH_COLORS.polyline
      ctx.lineWidth = L.polylineWidth
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      const first = data.fixations[0]
      ctx.moveTo(projectX(first.x, frame), projectY(first.y, frame))
      for (let i = 1; i < data.fixations.length; i++) {
        const f = data.fixations[i]
        ctx.lineTo(projectX(f.x, frame), projectY(f.y, frame))
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
      const cx = projectX(f.x, frame)
      const cy = projectY(f.y, frame)
      ctx.beginPath()
      ctx.arc(cx, cy, radiusFor(f.duration), 0, Math.PI * 2)
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
        const r = radiusFor(f.duration)
        ctx.fillText(
          String(f.rank),
          projectX(f.x, frame) + r + L.numberOffset,
          projectY(f.y, frame) - r * 0.4
        )
      }
      ctx.restore()
    }
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
></canvas>
