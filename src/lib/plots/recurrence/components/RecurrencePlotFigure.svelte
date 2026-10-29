<script lang="ts">
  import {
    usePlot,
    indexTicks,
    cachedRaster,
    trackOnlyHit,
    packRgb,
    alignToPixelCenter,
    strokeCrosshairGuides,
    GRIDLINE_SECONDARY,
    FONT_PRIMARY,
    PLOT_TICK_LABEL_GAP,
    type CanvasExportProps,
    type PlotFrame,
    type PlotPlaceholderContent,
  } from '$lib/plots/shared'
  import type { PlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
  import { hexToRgb, convertToHex } from '$lib/color'
  import {
    buildRecurrenceTooltipContent,
    fixationAt,
    fixationMidpoint,
    latticeOffset,
    latticeStep,
    nearestFixation,
    rasterizeRecurrenceTexture,
  } from '../core'
  import { RECURRENCE_LAYOUT } from '../const'
  import type {
    RecurrenceData,
    RecurrenceHighlight,
    RecurrenceMasking,
  } from '../types'

  interface Props extends CanvasExportProps {
    data: RecurrenceData | null
    highlight?: RecurrenceHighlight
    masking?: RecurrenceMasking
    highlightMask?: Uint8Array | null
    /** Replaces the matrix when it carries no information (an AOI in every fixation). */
    warning?: PlotPlaceholderContent | null
    /** The one participant this panel is about. */
    participantId?: number
    /** Shared PLOT CURSOR (screen-only; export renders without one). */
    plotCursor?: PlotCursorPort | null
  }

  const props: Props = $props()
  const {
    data,
    highlight = 'none',
    masking = 'diagonal',
    highlightMask = null,
    warning = null,
    participantId,
    plotCursor = null,
  } = $derived(props)

  /**
   * The fixation the cursor's instant lands in, or -1.
   *
   * Gated on the cursor naming THIS participant, which is what makes the mark
   * honest: absolute time is zeroed per participant, so another person's clock
   * must never be read against this person's fixations. A publisher that carries a
   * time but no participant (an AOI stream, whose series are group-aggregated)
   * therefore marks nothing here, correctly.
   */
  const cursorFixations = $derived.by(() => {
    if (!data || participantId === undefined) return []
    if (!(plotCursor?.participants ?? []).includes(participantId)) return []
    const found: number[] = []
    for (const t of plotCursor?.times ?? []) {
      const i = fixationAt(data, t)
      if (i >= 0) found.push(i)
    }
    return found
  })
  const cursorFixationsKey = $derived(cursorFixations.join(','))

  /**
   * The instants a hovered cell designates: fixation i and fixation j, deduped on
   * the diagonal. A masked cell (row -1) has no datum, so it publishes the
   * participant but no time.
   */
  function cellTimes(cell: { row: number; col: number }): number[] {
    if (!data || cell.row < 0) return []
    const both =
      cell.row === cell.col
        ? [fixationMidpoint(data, cell.row)]
        : [fixationMidpoint(data, cell.row), fixationMidpoint(data, cell.col)]
    return both.filter(Number.isFinite).sort((a, b) => a - b)
  }

  const L = RECURRENCE_LAYOUT
  // Below this fixation spacing individual dots stop resolving; the matrix is
  // drawn as a pixel-accurate texture instead (drawTexture) so its pattern still
  // reads at thousands of fixations.
  const DOT_MODE_MIN = 5
  // The matrix can be N×N for N in the thousands, so it is rasterised ONCE per
  // data/appearance change into a capped-resolution texture, then scaled on
  // resize. This bounds the cache and keeps the one-time rebuild manageable.
  const MAX_TEXTURE_PX = 1600

  const DOT_RGB = packRgb(hexToRgb(L.dotColor))
  const DIAGONAL_RGB = packRgb(hexToRgb(L.diagonalColor))
  const DIMMED_RGB = packRgb(hexToRgb(L.dimmedColor))

  // Cached recurrence texture: rebuilt only when the data/appearance change
  // (the keys drawTexture passes), then scale-blitted on resize
  // so a drag never re-scans the matrix. Mirrors the evolving-metrics blit.
  const texRaster = cachedRaster()
  let texAlpha: Uint8Array | null = null

  const N = $derived(data?.fixationCount ?? 0)
  // Fixation k sits ON its tick: 1 at the axis line, N on the opposite border.
  // The axes share fixation 1 at the origin, so neither labels it: one "1" sits
  // off the corner instead (drawOriginLabel).
  const xTicks = $derived(indexTicks(N, L.tickCount, { labelFirst: false }))
  const yTicks = $derived(indexTicks(N, L.tickCount, { invert: true, labelFirst: false }))

  const maxDuration = $derived.by(() => {
    if (!data?.durationMatrix) return 0
    let max = 0
    for (let i = 0; i < data.durationMatrix.length; i++) {
      if (data.durationMatrix[i] > max) max = data.durationMatrix[i]
    }
    return max
  })

  // Per-column base colour (fixation j's AOI colour, else the default dot
  // colour) packed as RGB, plus whether the column has an AOI colour (highlight
  // keeps AOI colours and only recolours non-AOI cells). Recomputed on data
  // change and shared by the dot and texture paths.
  const columnColors = $derived.by(() => {
    const n = N
    const rgb = new Uint32Array(n)
    const hasAoi = new Uint8Array(n)
    for (let j = 0; j < n; j++) {
      const c = data?.fixationAoiColors[j]
      if (c) {
        rgb[j] = packRgb(hexToRgb(convertToHex(c)))
        hasAoi[j] = 1
      } else {
        rgb[j] = DOT_RGB
      }
    }
    return { rgb, hasAoi }
  })

  // A masked cell has no datum, but the panel is still this participant: a
  // track-only hit with STABLE identity keeps the cursor published and repaints
  // nothing. `row: -1` marks it, so the local guide lines skip it.
  const MASKED_HIT = trackOnlyHit({ row: -1, col: -1 }, 'default')

  // The square frame as the fixation lattice. Fixation i counts upward (rows
  // are bottom-origin), fixation j rightward.
  const stepOf = (f: PlotFrame) => latticeStep(N, f.width)
  const xOf = (f: PlotFrame, j: number) => f.x + latticeOffset(N, f.width, j)
  const yOf = (f: PlotFrame, i: number) => f.y + f.width - latticeOffset(N, f.width, i)
  const dotRadiusOf = (f: PlotFrame) => Math.min(L.maxDotRadius, stepOf(f) * L.dotSpacingRatio)
  const isDense = (f: PlotFrame) => stepOf(f) < DOT_MODE_MIN

  const plot = usePlot<{ row: number; col: number }>({
    props: () => props,
    // No fit guard: the recurrence matrix is rendered as a texture (drawRaster)
    // at any density, so hundreds of fixations stay legible as a pattern. The
    // placeholders are the "no data" case and a matrix that is recurrent everywhere.
    placeholder: () =>
      N < 2
        ? {
            message: 'Fewer than 2 fixations to compare.',
            steps: ['Pick another Participant or Stimulus'],
          }
        : warning,
    gutters: () => {
      if (N < 2) return {}
      return { aspect: 1, pad: { top: L.edgePadPx, right: L.edgePadPx } }
    },
    drawData: drawMatrix,
    axes: () => {
      if (N < 2) return {}
      // The opposite edges mirror the ticks without labels. '1' reserves room for
      // the origin label drawAboveAxes puts in both gutters.
      return {
        bottom: { ticks: xTicks, title: 'Fixation j', reserve: ['1'] },
        left: { ticks: yTicks, title: 'Fixation i', reserve: ['1'] },
        top: { ticks: { positions: xTicks.positions } },
        right: { ticks: { positions: yTicks.positions } },
      }
    },
    // Edge fixations sit ON the axis lines, so their dots go above the border.
    drawAboveAxes: (ctx, frame) => {
      drawOriginLabel(ctx, frame)
      drawDots(ctx, frame)
    },
    drawOverlay: drawRecurrenceOverlay,
    // One publish per fixation pair, not per pointer move.
    hoverKey: cell => cell.row * N + cell.col,
    // This panel IS one participant, so a hover anywhere in it means that person.
    // A CELL additionally means two moments — "they looked here at t1 and again at
    // t2" — which is the datum the time plots can show and this one cannot.
    onHover: cell =>
      plotCursor?.publish(
        cell !== null && participantId !== undefined
          ? {
              participants: () => [participantId],
              times: () => cellTimes(cell),
            }
          : null
      ),
    overlayDeps: (): string => cursorFixationsKey,
    hitTest: (x, y, frame) => {
      if (!data || N < 2) return null
      // Snap to the nearest fixation pair (the harness hit-tests inside the rect).
      const side = frame.width
      const col = nearestFixation(N, side, x - frame.x, 0)
      const row = nearestFixation(N, side, frame.y + side - y, 0)
      if (col < 0 || row < 0) return null
      const maskDiagonal = masking === 'diagonal' || masking === 'diagonalLower'
      const maskLower = masking === 'diagonalLower'
      if ((maskLower && col >= row) || (maskDiagonal && col === row)) return MASKED_HIT

      return {
        content: buildRecurrenceTooltipContent(data, row, col),
        // Below-right of the dot, the shared matrix figure's placement.
        anchorX: xOf(frame, col) + dotRadiusOf(frame),
        anchorY: yOf(frame, row) + dotRadiusOf(frame),
        offset: { x: 10, y: 10 },
        tooltipWidth: 140,
        data: { row, col },
      }
    },
  })

  function getHighlightColor(): string {
    switch (highlight) {
      case 'diagonal':
        return L.highlightDiagonal
      case 'horizontal':
        return L.highlightHorizontal
      case 'vertical':
        return L.highlightVertical
      default:
        return L.dotColor
    }
  }

  /**
   * Under the axes: the line of identity as a guide, then the masking marks in
   * the readable regime, or the whole matrix as a texture in the dense one. No
   * cell grid: a fixation is a line through the lattice, not a cell.
   */
  function drawMatrix(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    const { x, y, width: side } = frame
    ctx.strokeStyle = GRIDLINE_SECONDARY.COLOR
    ctx.lineWidth = GRIDLINE_SECONDARY.WIDTH
    ctx.beginPath()
    ctx.moveTo(x, y + side)
    ctx.lineTo(x + side, y)
    ctx.stroke()

    if (isDense(frame)) {
      drawTexture(ctx, frame)
      return
    }
    if (masking === 'diagonalLower') {
      // The diagonal and the visual lower triangle (i < j) as one grey region.
      ctx.fillStyle = L.diagonalColor
      ctx.beginPath()
      ctx.moveTo(x, y + side)
      ctx.lineTo(x + side, y + side)
      ctx.lineTo(x + side, y)
      ctx.closePath()
      ctx.fill()
    }
  }

  /**
   * The single "1" both axes share: in the left labels' column (right-aligned
   * the tick-label gap left of the axis) and the bottom labels' row.
   */
  function drawOriginLabel(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (N < 2) return
    ctx.save()
    ctx.font = `${FONT_PRIMARY.SIZE}px ${FONT_PRIMARY.FAMILY}`
    ctx.fillStyle = FONT_PRIMARY.COLOR
    ctx.textAlign = 'right'
    ctx.textBaseline = 'hanging'
    ctx.fillText('1', frame.x - PLOT_TICK_LABEL_GAP, frame.y + frame.width + PLOT_TICK_LABEL_GAP)
    ctx.restore()
  }

  /** Readable regime: one dot per recurrent pair, duration-scaled radius. */
  function drawDots(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data || isDense(frame)) return
    const hasDuration = data.durationMatrix !== null && maxDuration > 0
    const maxDotRadius = dotRadiusOf(frame)
    const plainRadius = Math.max(1.5, maxDotRadius * 0.75)
    const isHighlightActive = highlight !== 'none' && highlightMask !== null
    const accentColor = getHighlightColor()
    const maskDiagonal = masking === 'diagonal' || masking === 'diagonalLower'
    const maskLower = masking === 'diagonalLower'

    // Guard against redundant fillStyle string re-assignment (a per-run cost).
    let lastFill = ''
    for (let i = 0; i < N; i++) {
      const rowOffset = i * N
      const cy = yOf(frame, i)
      // Masking the lower half keeps only the visual upper triangle (j < i).
      const jEnd = maskLower ? i : N
      for (let j = 0; j < jEnd; j++) {
        if (maskDiagonal && i === j) continue
        if (!data.matrix[rowOffset + j]) continue

        const cx = xOf(frame, j)

        let dotColor: string = L.dotColor
        let dotAlpha = 1
        const aoiColor = data.fixationAoiColors[j]
        if (aoiColor) dotColor = aoiColor

        if (isHighlightActive && highlightMask) {
          if (highlightMask[rowOffset + j]) {
            if (!aoiColor) dotColor = accentColor
          } else {
            dotColor = L.dimmedColor
            dotAlpha = L.dimmedAlpha
          }
        }

        if (lastFill !== dotColor) {
          ctx.fillStyle = dotColor
          lastFill = dotColor
        }
        if (hasDuration && data.durationMatrix) {
          const ratio = Math.max(0.15, data.durationMatrix[rowOffset + j] / maxDuration)
          ctx.globalAlpha = dotAlpha * (0.3 + 0.7 * ratio)
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(1, maxDotRadius * Math.sqrt(ratio)), 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = dotAlpha
          ctx.beginPath()
          ctx.arc(cx, cy, plainRadius, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    }
  }

  /**
   * Dense regime: blit the cached recurrence texture, scaled to the (square)
   * frame and widened half a fixation spacing past each edge, so every
   * fixation's texels centre on its lattice line (the data clip trims the
   * overhang). The texture is rebuilt (a single matrix scan) only when the data or
   * appearance changes — a resize just re-scales it, so dragging a huge matrix
   * costs one drawImage, not an N² rescan. Downscaling averages (smoothing on)
   * into a clean recurrence-density texture; upscaling stays crisp (nearest).
   */
  function drawTexture(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const d = data
    if (!d) return
    const res = Math.max(1, Math.min(N, MAX_TEXTURE_PX))
    const activeMask =
      highlight !== 'none' && highlightMask !== null ? highlightMask : null
    // null = unsafe size or canvas-less environment (tests): skip the texture
    const tex = texRaster([d, highlight, masking, activeMask], res, res, layer => {
      if (texAlpha?.length !== res * res) texAlpha = new Uint8Array(res * res)
      const { rgb: colRgb, hasAoi } = columnColors
      rasterizeRecurrenceTexture(
        {
          n: N,
          res,
          matrix: d.matrix,
          columnRgb: colRgb,
          columnHasAoi: hasAoi,
          highlightMask: activeMask,
          accentRgb: packRgb(hexToRgb(getHighlightColor())),
          diagonalRgb: DIAGONAL_RGB,
          dimmedRgb: DIMMED_RGB,
          dimmedByte: Math.round(L.dimmedAlpha * 255),
          maskDiagonal: masking === 'diagonal' || masking === 'diagonalLower',
          maskLower: masking === 'diagonalLower',
        },
        layer.pixels,
        texAlpha
      )
    })
    if (!tex) return

    const step = stepOf(frame)
    const side = frame.width + step // N spacings: N-1 inside plus half at each end
    const prevSmoothing = ctx.imageSmoothingEnabled
    ctx.imageSmoothingEnabled = res > side // smooth on downscale only
    ctx.drawImage(
      tex.canvas as CanvasImageSource,
      0,
      0,
      res,
      res,
      frame.x - step / 2,
      frame.y - step / 2,
      side,
      side
    )
    ctx.imageSmoothingEnabled = prevSmoothing
  }

  /**
   * A designated fixation is its line through the lattice, marked with the
   * dashed guide the time plots use: the hovered pair's row i and column j, and
   * the cursor's fixation as both its row and its column (every other fixation
   * that recurred with it lies on them).
   */
  function drawRecurrenceOverlay(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    const side = frame.width
    const segments: number[] = []
    const rowLine = (i: number) => {
      const y = alignToPixelCenter(yOf(frame, i))
      segments.push(frame.x, y, frame.x + side, y)
    }
    const colLine = (j: number) => {
      const x = alignToPixelCenter(xOf(frame, j))
      segments.push(x, frame.y, x, frame.y + side)
    }
    for (const k of cursorFixations) {
      rowLine(k)
      colLine(k)
    }
    const hovered = plot.hover.data
    // A masked point (row -1) publishes the cursor only, with no local lines.
    if (hovered && hovered.row >= 0) {
      rowLine(hovered.row)
      colLine(hovered.col)
    }
    if (segments.length > 0) strokeCrosshairGuides(ctx, segments)
  }
</script>

<canvas
  use:plot.plotAction
  aria-label="Recurrence Plot visualization"
></canvas>
