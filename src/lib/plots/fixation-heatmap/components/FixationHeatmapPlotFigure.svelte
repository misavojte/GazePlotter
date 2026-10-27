<script lang="ts">
  import {
    usePlot,
    canvasBlockSelect,
    pixelLayer,
    trackOnlyHit,
    strokeCrosshairRing,
    bottomGradientLegendGeometry,
    drawGradientLegend,
    getGradientLegendRequiredHeight,
    PLOT_BORDER_PX,
    PLOT_LEGEND_GAP,
    GRIDLINE_PRIMARY,
    strokeCrispRect,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
    type PixelLayer,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { AXIS_CONFIG, axisTitleLineHeight } from '$lib/plots/shared/axisUtils'
  import { linearTicks } from '$lib/plots/shared/ticks'
  import { estimateTextWidth } from '$lib/shared/textMeasure'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { fitView, type Rect, type View } from '$lib/data/media/mediaAlignment'
  import { mediaRegionOf } from '$lib/data/media/stimulusMedia'
  import { useMediaElements } from '../../shared/mediaElements.svelte'
  import type { StimulusMedia } from '$lib/data/types'
  import { bucketFixations, cellCentreOf, fixationsWithin, type FixationBuckets } from '../core/density'
  import { heatLut, legendRamp, paintHeat } from '../core/heatImage'
  import { formatAmount } from '../core/view'
  import { formatGaze } from '$lib/plots/shared/labels'
  import { FIXATION_HEATMAP_COLORS as C, FIXATION_HEATMAP_LAYOUT as L } from '../const'
  import type {
    FixationHeatmapAccumulate,
    FixationHeatmapBackground,
    FixationHeatmapData,
    FixationHeatmapNormalization,
  } from '../types'

  interface Props extends CanvasExportProps {
    data: FixationHeatmapData | null
    colorScale?: string[]
    /** Heat overlay opacity, 0..1. */
    opacity?: number
    /** Value at the top colour (the rounded peak when auto). */
    scaleTop?: number
    /** An explicit Scale max: values above it take the top colour, shown as the legend cap. */
    fixedMax?: boolean
    showFixations?: boolean
    /** How the image is drawn; 'none' never reaches here (the view passes no image). */
    background?: FixationHeatmapBackground
    legendTitle?: string
    /** What the map leaves out; shown on hovering the legend title. */
    notes?: string[]
    accumulate?: FixationHeatmapAccumulate
    normalization?: FixationHeatmapNormalization
    unavailableMessage?: PlotPlaceholderContent | null
    /** The stimulus's reference image, drawn under the heat (videos are never passed). */
    media?: StimulusMedia | null
    mediaStimulusId?: number
    /** Shared PLOT CURSOR, publish-only: the participants with fixations within R. */
    plotCursor?: PlotCursorPort | null
  }

  let {
    data,
    colorScale = undefined,
    opacity = 0.7,
    scaleTop = 0,
    fixedMax = false,
    showFixations = false,
    background = 'image',
    legendTitle = '',
    notes = [],
    accumulate = 'duration',
    normalization = 'share',
    width = 400,
    height = 400,
    margin = 0,
    unavailableMessage = null,
    media = null,
    mediaStimulusId,
    plotCursor = null,
  }: Props = $props()

  const mediaElements = useMediaElements()
  const mediaElement = $derived.by(() => {
    if (!media || mediaStimulusId === undefined) return null
    void mediaElements.version
    return mediaElements.getReadyElement(mediaStimulusId, media)
  })

  const stops = $derived(
    colorScale && colorScale.length >= 2 ? colorScale : [...PRESET_PALETTES.YL_OR_RD.colors]
  )
  const lut = $derived(heatLut(stops, opacity))
  const ramp = $derived(legendRamp(lut))

  // Frame size mirror for the equal-aspect fit (Scanpath's pattern): written in
  // an effect so the derived never reads `plot` during init.
  let frameW = $state(0)
  let frameH = $state(0)
  $effect(() => {
    frameW = plot.frame.width
    frameH = plot.frame.height
  })

  const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

  /** Gaze rect framed by the plot: the media, or the fixation extent with its kernel margin. */
  const world = $derived.by((): Rect | null => {
    if (!data) return null
    if (data.clip) return data.clip
    const r = data.radius
    const e = data.extent
    return { x: e.x - r, y: e.y - r, width: e.width + 2 * r, height: e.height + 2 * r }
  })

  /** Equal-aspect view (frame-relative) + ticks over the visible gaze range. */
  const space = $derived.by(() => {
    if (!world) return null
    const view: View = fitView(world, Math.max(1, frameW), Math.max(1, frameH), NO_INSETS)
    const minX = -view.offsetX / view.scale
    const minY = -view.offsetY / view.scale
    const maxX = minX + Math.max(1, frameW) / view.scale
    const maxY = minY + Math.max(1, frameH) / view.scale
    return {
      view,
      xTicks: linearTicks(minX, maxX, L.tickCount),
      yTicks: linearTicks(minY, maxY, L.tickCount),
    }
  })

  const projX = (x: number, frame: PlotFrame) => frame.x + x * space!.view.scale + space!.view.offsetX
  const projY = (y: number, frame: PlotFrame) => frame.y + y * space!.view.scale + space!.view.offsetY

  const gradientHeight = getGradientLegendRequiredHeight(AXIS_CONFIG.fontSize)
  const legendBlockHeight = $derived(
    data && !unavailableMessage
      ? PLOT_LEGEND_GAP + gradientHeight
      : 0
  )

  // ── Cached heat texture: one pixel per grid cell, rebuilt only when the data
  // or its colouring changes; resizes just re-blit it (the recurrence pattern).
  let tex: PixelLayer | null = null
  let texKey: { data: FixationHeatmapData; lut: Uint32Array; top: number } | null = null

  function heatTexture(d: FixationHeatmapData): PixelLayer | null {
    if (texKey && texKey.data === d && texKey.lut === lut && texKey.top === scaleTop && tex) return tex
    tex = pixelLayer(tex, d.grid.cols, d.grid.rows)
    if (!tex) return null
    paintHeat(d.values, scaleTop, lut, tex.pixels)
    tex.ctx.putImageData(tex.image, 0, 0)
    texKey = { data: d, lut, top: scaleTop }
    return tex
  }

  function clipToRect(ctx: CanvasRenderingContext2D, r: Rect, frame: PlotFrame) {
    const s = space!.view.scale
    ctx.beginPath()
    ctx.rect(projX(r.x, frame), projY(r.y, frame), r.width * s, r.height * s)
    ctx.clip()
  }

  function drawHeatmap(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data || !space) return
    const s = space.view.scale
    const imageDrawn = !!(media && mediaElement)
    if (media && mediaElement) {
      const r = mediaRegionOf(media)
      const [mx, my, mw, mh] = [projX(r.x, frame), projY(r.y, frame), r.width * s, r.height * s]
      const desaturated = background === 'grayscale' || background === 'dimmed'
      if (desaturated) {
        // Opaque underlay: 'saturation' would turn transparent image pixels grey.
        ctx.fillStyle = C.paper
        ctx.fillRect(mx, my, mw, mh)
      }
      ctx.drawImage(mediaElement, mx, my, mw, mh)
      if (desaturated) {
        // Zero saturation keeps the image's luminosity: grayscale without a filter or a copy.
        ctx.save()
        clipToRect(ctx, r, frame)
        ctx.globalCompositeOperation = 'saturation'
        ctx.fillStyle = C.desaturate
        ctx.fillRect(mx, my, mw, mh)
        if (background === 'dimmed') {
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = C.dimAlpha
          ctx.fillStyle = C.paper
          ctx.fillRect(mx, my, mw, mh)
        }
        ctx.restore()
      }
    } else if (data.clip) {
      // No image under clipped heat (None, a video, or still decoding): white, as the legend assumes.
      ctx.fillStyle = C.paper
      ctx.fillRect(projX(data.clip.x, frame), projY(data.clip.y, frame), data.clip.width * s, data.clip.height * s)
    }

    const layer = heatTexture(data)
    if (layer) {
      const g = data.grid
      ctx.save()
      if (data.clip) clipToRect(ctx, data.clip, frame)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // Texel edges on cell edges, so texel centres land on the cell centres the splat used.
      ctx.drawImage(layer.canvas, projX(g.x0, frame), projY(g.y0, frame), g.cols * g.cell * s, g.rows * g.cell * s)
      ctx.restore()
    }

    // The edge the heat is clipped to stays visible when no image shows it.
    if (data.clip && !imageDrawn) {
      const c = data.clip
      strokeCrispRect(ctx, projX(c.x, frame), projY(c.y, frame), c.width * s, c.height * s, GRIDLINE_PRIMARY.COLOR, 1)
    }

    if (showFixations) drawFixationDots(ctx, frame, data)
  }

  function drawFixationDots(ctx: CanvasRenderingContext2D, frame: PlotFrame, d: FixationHeatmapData) {
    const { scale, offsetX, offsetY } = space!.view
    const ox = frame.x + offsetX
    const oy = frame.y + offsetY
    const { xs, ys } = d
    ctx.save()
    ctx.globalAlpha = C.dotAlpha
    // Every halo before any dot, so overlapping dots never erase each other.
    ctx.fillStyle = C.dotHalo
    for (let k = 0; k < xs.length; k++) {
      ctx.fillRect(Math.round(ox + xs[k] * scale) - 2, Math.round(oy + ys[k] * scale) - 2, 5, 5)
    }
    ctx.fillStyle = C.dot
    for (let k = 0; k < xs.length; k++) {
      ctx.fillRect(Math.round(ox + xs[k] * scale) - 1, Math.round(oy + ys[k] * scale) - 1, 3, 3)
    }
    ctx.restore()
  }

  const legendGeometry = $derived.by(() =>
    bottomGradientLegendGeometry(plot, margin, gradientHeight, {
      colorScale: ramp,
      // A non-zero range max is what turns on the above-max cap.
      valueRange: [0, fixedMax ? scaleTop : 0],
      effectiveMaxValue: scaleTop,
      title: legendTitle,
      aboveMaxColor: fixedMax ? ramp[ramp.length - 1] : null,
    })
  )

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (!data || unavailableMessage) return
    drawGradientLegend(ctx, legendGeometry)
  }

  /** The legend title's box, where hovering shows the notes. */
  function overLegendTitle(x: number, y: number): boolean {
    const t = legendGeometry.title
    if (!t) return false
    const lineHeight = axisTitleLineHeight(AXIS_CONFIG.fontSize)
    let half = 0
    for (const line of t.lines) {
      half = Math.max(half, estimateTextWidth(line, AXIS_CONFIG.fontSize, AXIS_CONFIG.fontFamily) / 2)
    }
    return Math.abs(x - t.x) <= half && y >= t.y && y <= t.y + t.lines.length * lineHeight
  }

  // ── Hover: what lies within R of the hovered cell's centre.
  type HeatmapHit = { cell: number }
  type CellInfo = { rows: Array<{ key: string; value: string }>; ids: number[] }

  let buckets: { data: FixationHeatmapData; index: FixationBuckets; out: Uint32Array; sums: Float64Array } | null = null
  let memo: { data: FixationHeatmapData; cell: number; info: CellInfo } | null = null

  function cellInfo(d: FixationHeatmapData, cell: number): CellInfo {
    if (memo && memo.data === d && memo.cell === cell) return memo.info
    if (!buckets || buckets.data !== d) {
      buckets = {
        data: d,
        index: bucketFixations(d.xs, d.ys, d.xs.length, d.grid, d.radius),
        out: new Uint32Array(d.xs.length),
        sums: new Float64Array(d.participants.length),
      }
    }
    const { x: cx, y: cy } = cellCentreOf(d.grid, cell)
    const n = fixationsWithin(buckets.index, d.xs, d.ys, cx, cy, d.radius, buckets.out)
    const share = normalization === 'share'
    const sums = buckets.sums
    sums.fill(0)
    let rawSum = 0
    let shareSum = 0
    for (let o = 0; o < n; o++) {
      const k = buckets.out[o]
      const p = d.participantIndex[k]
      const own = d.raw[k] / d.participants[p].total
      rawSum += d.raw[k]
      shareSum += own
      // Contributions in the map's own weighting: equal per person in share mode.
      sums[p] += share ? own : d.raw[k]
    }
    const ids: number[] = []
    let top = -1
    let contribution = 0
    for (let p = 0; p < sums.length; p++) {
      if (sums[p] <= 0) continue
      ids.push(d.participants[p].id)
      contribution += sums[p]
      if (top < 0 || sums[p] > sums[top]) top = p
    }
    const N = d.participants.length
    const duration = accumulate === 'duration'
    const unit = share ? ' %' : duration ? ' ms per participant' : ' fixations per participant'
    const rows = [
      { key: 'Map value', value: `${formatAmount(d.values[cell])}${unit}` },
      {
        key: `Within R = ${formatGaze(d.radius)}`,
        value: `${n} fixation${n === 1 ? '' : 's'}${duration ? `, ${formatAmount(rawSum)} ms` : ''}`,
      },
      {
        key: duration ? 'Share of fixation time' : 'Share of fixations',
        value: `${formatAmount((100 * shareSum) / N)} %`,
      },
      { key: 'Participants', value: `${ids.length} of ${N}` },
    ]
    if (top >= 0) {
      rows.push({
        key: 'Largest contributor',
        value: `${d.participants[top].name}, ${Math.round((100 * sums[top]) / contribution)} %`,
      })
    }
    rows.push({ key: 'X', value: formatGaze(cx) }, { key: 'Y', value: formatGaze(cy) })
    const info = { rows, ids }
    memo = { data: d, cell, info }
    return info
  }

  function cellAt(x: number, y: number, frame: PlotFrame): number {
    if (!data || !space) return -1
    const wx = (x - frame.x - space.view.offsetX) / space.view.scale
    const wy = (y - frame.y - space.view.offsetY) / space.view.scale
    const c = data.clip
    if (c && (wx < c.x || wx > c.x + c.width || wy < c.y || wy > c.y + c.height)) return -1
    const g = data.grid
    const i = Math.floor((wx - g.x0) / g.cell)
    const j = Math.floor((wy - g.y0) / g.cell)
    return i < 0 || j < 0 || i >= g.cols || j >= g.rows ? -1 : j * g.cols + i
  }

  function cellCentre(cell: number, frame: PlotFrame): { x: number; y: number } {
    const c = cellCentreOf(data!.grid, cell)
    return { x: projX(c.x, frame), y: projY(c.y, frame) }
  }

  function drawHeatmapOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const cell = plot.hover.data?.cell ?? -1
    if (cell < 0 || !data || !space) return
    const c = cellCentre(cell, frame)
    // The overlay is unclipped: keep the ring inside the plot area, off the axes.
    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.clip()
    strokeCrosshairRing(ctx, c.x, c.y, data.radius * space.view.scale)
    ctx.restore()
  }

  const hasPlot = $derived(!unavailableMessage && data !== null)

  const plot = usePlot<HeatmapHit>({
    width: () => width,
    height: () => height,
    margin: () => margin,
    deps: (): unknown[] => [data, lut, scaleTop, fixedMax, showFixations, background, legendTitle, notes, media, mediaElement, unavailableMessage, space],
    placeholder: () => unavailableMessage,
    gutters: () => {
      if (!hasPlot || !space) return {}
      return {
        left: { tickLabels: space.yTicks.labels, title: 'Y' },
        bottom: { tickLabels: space.xTicks.labels, title: 'X' },
        pad: { right: PLOT_BORDER_PX },
        legendHeight: legendBlockHeight,
      }
    },
    drawData: drawHeatmap,
    drawAboveAxes: drawLegend,
    drawOverlay: drawHeatmapOverlay,
    hitTest: (x, y, frame): FrameHit<HeatmapHit> | null => {
      if (!data) return null
      const cell = cellAt(x, y, frame)
      if (cell < 0 || !(data.values[cell] > 0)) return trackOnlyHit({ cell })
      const c = cellCentre(cell, frame)
      return {
        content: cellInfo(data, cell).rows,
        anchorX: c.x,
        anchorY: c.y - data.radius * space!.view.scale,
        tooltipWidth: L.tooltipWidth,
        data: { cell },
      }
    },
    hitTestChrome: (x, y): FrameHit<HeatmapHit> | null => {
      if (!data || notes.length === 0 || !overLegendTitle(x, y)) return null
      return {
        content: notes.map(value => ({ key: 'Note', value })),
        anchorX: x,
        anchorY: legendGeometry.title!.y,
        tooltipWidth: L.tooltipWidth,
        cursor: 'help',
        data: { cell: -1 },
      }
    },
    hoverKey: d => d.cell,
    onHover: hit => {
      const ids = hit && hit.cell >= 0 && data && data.values[hit.cell] > 0 ? cellInfo(data, hit.cell).ids : []
      plotCursor?.publish(ids.length ? { participants: () => ids } : null)
    },
    overlayDeps: () => {
      void plot.hover.data?.cell
      return null
    },
    axes: () => {
      if (!hasPlot || !space) return {}
      return {
        bottom: { ticks: space.xTicks, title: 'X' },
        left: { ticks: space.yTicks, title: 'Y' },
      }
    },
  })
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
  aria-label="Fixation Heatmap visualization"
></canvas>
