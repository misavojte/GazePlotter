<script lang="ts">
  import {
    usePlot,
    cachedRaster,
    trackOnlyHit,
    strokeCrosshairRing,
    PLOT_BORDER_PX,
    type CanvasExportProps,
    type FrameHit,
    type PlotFrame,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
  import { AXIS_CONFIG, axisTitleLineHeight } from '$lib/plots/shared/axisUtils'
  import { estimateTextWidth } from '$lib/shared/textMeasure'
  import { PRESET_PALETTES, resolvePalette } from '$lib/color/palettes'
  import type { Rect } from '$lib/data/media/mediaAlignment'
  import { drawStimulusBackground, stimulusSpace, worldAspect, type StimulusBackground } from '$lib/plots/shared/stimulusBackground'
  import { useMediaElements } from '../../shared/mediaElements.svelte'
  import type { StimulusMedia } from '$lib/data/types'
  import { bucketFixations, cellCentreOf, fixationsWithin, type FixationBuckets } from '../core/density'
  import { heatLut, legendRamp, paintHeat } from '../core/heatImage'
  import { buildHeatmapTooltipContent } from '../core/tooltip'
  import { FIXATION_HEATMAP_COLORS as C, FIXATION_HEATMAP_LAYOUT as L } from '../const'
  import type {
    FixationHeatmapAccumulate,
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
    background?: StimulusBackground
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

  const props: Props = $props()
  const {
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
    unavailableMessage = null,
    media = null,
    mediaStimulusId,
    plotCursor = null,
  } = $derived(props)

  const mediaElements = useMediaElements()
  const mediaElement = $derived.by(() => {
    if (!media || mediaStimulusId === undefined) return null
    void mediaElements.version
    return mediaElements.getReadyElement(mediaStimulusId, media)
  })

  const stops = $derived(resolvePalette(colorScale, PRESET_PALETTES.YL_OR_RD.colors))
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

  /** Gaze rect framed by the plot: the media, or the fixation extent with its kernel margin. */
  const world = $derived.by((): Rect | null => {
    if (!data) return null
    if (data.clip) return data.clip
    const r = data.radius
    const e = data.extent
    return { x: e.x - r, y: e.y - r, width: e.width + 2 * r, height: e.height + 2 * r }
  })

  const space = $derived(world ? stimulusSpace(world, frameW, frameH, L.tickCount) : null)

  const projX = (x: number, frame: PlotFrame) => frame.x + x * space!.view.scale + space!.view.offsetX
  const projY = (y: number, frame: PlotFrame) => frame.y + y * space!.view.scale + space!.view.offsetY

  // ── Cached heat texture: one pixel per grid cell, rebuilt only when the data
  // or its colouring changes; resizes just re-blit it (the recurrence pattern).
  const heatRaster = cachedRaster()

  const heatTexture = (d: FixationHeatmapData) =>
    heatRaster([d, lut, scaleTop], d.grid.cols, d.grid.rows, layer =>
      paintHeat(d.values, scaleTop, lut, layer.pixels)
    )

  function clipToRect(ctx: CanvasRenderingContext2D, r: Rect, frame: PlotFrame) {
    const s = space!.view.scale
    ctx.beginPath()
    ctx.rect(projX(r.x, frame), projY(r.y, frame), r.width * s, r.height * s)
    ctx.clip()
  }

  function drawHeatmap(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data || !space) return
    const s = space.view.scale
    // The clip is the media rect; without an image there (None, a video, still decoding) it is white, as the legend assumes.
    const c = data.clip
    if (c) drawStimulusBackground(ctx, mediaElement, projX(c.x, frame), projY(c.y, frame), c.width * s, c.height * s, background)

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

  /** The legend title's box, where hovering shows the notes. */
  function overLegendTitle(x: number, y: number): boolean {
    const t = plot.gradientLegend?.title
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
    const rows = buildHeatmapTooltipContent(
      {
        value: d.values[cell],
        x: cx,
        y: cy,
        radius: d.radius,
        fixations: n,
        rawSum,
        share: shareSum / d.participants.length,
        participants: ids.length,
        ofParticipants: d.participants.length,
        top: top >= 0 ? { name: d.participants[top].name, share: sums[top] / contribution } : null,
      },
      accumulate,
      normalization
    )
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
    props: () => props,
    deps: (): unknown[] => [mediaElement, space],
    placeholder: () => unavailableMessage,
    gutters: () => {
      if (!hasPlot || !space) return {}
      return {
        pad: { right: PLOT_BORDER_PX },
        // The data rect takes the world's shape, so the axes span exactly the image (or extent).
        aspect: worldAspect(world!),
      }
    },
    gradientLegend: () =>
      !hasPlot || !space
        ? null
        : {
            colorScale: ramp,
            // A non-zero range max is what turns on the above-max cap.
            valueRange: [0, fixedMax ? scaleTop : 0],
            effectiveMaxValue: scaleTop,
            title: legendTitle,
            aboveMaxColor: fixedMax ? ramp[ramp.length - 1] : null,
          },
    drawData: drawHeatmap,
    drawOverlay: drawHeatmapOverlay,
    hitTest: (x, y, frame): FrameHit<HeatmapHit> | null => {
      if (!data) return null
      const cell = cellAt(x, y, frame)
      if (cell < 0 || !(data.values[cell] > 0)) return trackOnlyHit({ cell })
      const c = cellCentre(cell, frame)
      // The ring's bottom-right corner, as other plots anchor at their mark's.
      const r = data.radius * space!.view.scale
      return {
        content: cellInfo(data, cell).rows,
        anchorX: c.x + r,
        anchorY: c.y + r,
        tooltipWidth: L.tooltipWidth,
        data: { cell },
      }
    },
    hitTestChrome: (x, y): FrameHit<HeatmapHit> | null => {
      if (!data || notes.length === 0 || !overLegendTitle(x, y)) return null
      return {
        content: notes.map(value => ({ key: 'Note', value })),
        anchorX: x,
        anchorY: plot.gradientLegend!.title!.y,
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
  aria-label="Fixation Heatmap visualization"
></canvas>
