<script lang="ts">
  import {
    usePlot,
    categoryTicks,
    canvasBlockSelect,
    NO_MARGINS,
    packRgb,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
  import { hexToRgb, convertToHex } from '$lib/color'
  import { rasterizeRecurrenceTexture } from '../core'
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
  }

  let {
    data,
    highlight = 'none',
    masking = 'diagonal',
    highlightMask = null,
    width = 400,
    height = 400,
    dpiOverride = null,
    margins = NO_MARGINS,
  }: Props = $props()

  const L = RECURRENCE_LAYOUT
  // Below this cell size individual dots stop resolving; the matrix is drawn as
  // a pixel-accurate texture instead (drawTexture) so its pattern still reads at
  // thousands of fixations.
  const DOT_MODE_MIN = 5
  // The matrix can be N×N for N in the thousands, so it is rasterised ONCE per
  // data/appearance change into a capped-resolution texture, then scaled on
  // resize. This bounds the cache and keeps the one-time rebuild manageable.
  const MAX_TEXTURE_PX = 1600

  const DOT_RGB = packRgb(hexToRgb(L.dotColor))
  const DIAGONAL_RGB = packRgb(hexToRgb(L.diagonalColor))
  const DIMMED_RGB = packRgb(hexToRgb(L.dimmedColor))

  // Cached recurrence texture: rebuilt only when the data/appearance change
  // (see the invalidation guard in drawTexture), then scale-blitted on resize
  // so a drag never re-scans the matrix. Mirrors the evolving-metrics blit.
  let texCanvas: OffscreenCanvas | HTMLCanvasElement | null = null
  let texCtx:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null = null
  let texImg: ImageData | null = null
  let texU32: Uint32Array | null = null
  let texAlpha: Uint8Array | null = null
  let texRes = 0
  let texData: RecurrenceData | null = null
  let texHighlight: RecurrenceHighlight | null = null
  let texMasking: RecurrenceMasking | null = null
  let texMask: Uint8Array | null = null

  let hoveredCell = $state<{ row: number; col: number } | null>(null)

  const N = $derived(data?.fixationCount ?? 0)
  const tickStep = $derived(N <= 20 ? 1 : Math.ceil(N / 10))

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

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, highlight, masking, highlightMask, placeholderMessage],
    placeholder: () => placeholderMessage,
    gutters: () => {
      if (N < 2) return {}
      return {
        square: true,
        left: { tickLabels: [String(N)], title: 'Fixation i' },
        bottom: { tickLabels: [String(N)], title: 'Fixation j' },
      }
    },
    drawData: drawGrid,
    axes: () => {
      if (N < 2) return {}
      return {
        bottom: {
          ticks: categoryTicks(N, { step: tickStep, edgesAlways: true }),
          title: 'Fixation j',
        },
        left: {
          ticks: categoryTicks(N, { step: tickStep, edgesAlways: true, invert: true }),
          title: 'Fixation i',
        },
      }
    },
    drawOverlay: drawHoverCrosshair,
    hitTest: (x, y, frame) => {
      if (!data || N < 2) return null
      const cell = cellAt(x, y, frame)
      if (!cell) return null
      const idx = cell.row * N + cell.col
      const isRecurrent = !!data.matrix[idx]
      const content: FrameHit['content'] = [
        { key: 'Fixation j', value: (cell.col + 1).toString() },
        { key: 'Fixation i', value: (cell.row + 1).toString() },
        { key: 'Recurrent', value: isRecurrent ? 'Yes' : 'No' },
      ]
      if (isRecurrent && data.durationMatrix) {
        content.push({
          key: 'Duration sum',
          value: `${data.durationMatrix[idx].toFixed(0)} ms`,
        })
      }
      const cellSize = frame.width / N
      return {
        tooltipId: 'recurrence-tooltip',
        content,
        anchorX: frame.x + (cell.col + 1) * cellSize,
        anchorY: frame.y + (N - 1 - cell.row) * cellSize + cellSize / 2,
        offset: { x: 10, y: 0 },
        tooltipWidth: 140,
        data: cell,
      }
    },
    onHoverChange: (hit) => {
      const cell = hit?.data ?? null
      const changed =
        (cell?.row ?? null) !== (hoveredCell?.row ?? null) ||
        (cell?.col ?? null) !== (hoveredCell?.col ?? null)
      hoveredCell = cell
      return changed
    },
  })

  // No fit guard: the recurrence matrix is rendered as a texture (drawRaster) at
  // any density, so hundreds of fixations stay legible as a pattern. The only
  // placeholder is the genuine "no data" case.
  const placeholderMessage = $derived(N < 2 ? 'Not enough fixations' : null)

  /** Map an absolute canvas position to a recurrence cell, or null if outside. */
  function cellAt(
    x: number,
    y: number,
    frame: PlotFrame
  ): { row: number; col: number } | null {
    const cellSize = frame.width / N
    const col = Math.floor((x - frame.x) / cellSize)
    const row = N - 1 - Math.floor((y - frame.y) / cellSize)
    if (row < 0 || row >= N || col < 0 || col >= N) return null
    return { row, col }
  }

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

  function drawGrid(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    const cellSize = frame.width / N

    // Grid background (both render modes paint their marks over it).
    ctx.fillStyle = L.gridBgColor
    ctx.fillRect(frame.x, frame.y, frame.width, frame.width)

    if (cellSize >= DOT_MODE_MIN) drawDots(ctx, frame, cellSize)
    else drawTexture(ctx, frame)
  }

  /** Readable regime: circular dots with grid lines, duration-scaled radius. */
  function drawDots(
    ctx: CanvasRenderingContext2D,
    frame: PlotFrame,
    cellSize: number
  ) {
    if (!data) return
    const gridSize = frame.width
    const { x: xOffset, y: yOffset } = frame
    const colToX = (col: number) => xOffset + col * cellSize
    const rowToY = (row: number) => yOffset + (N - 1 - row) * cellSize

    // Grid lines. Batched into one path (was 2·(N+1) separate stroke composites).
    ctx.strokeStyle = L.gridLineColor
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const x = xOffset + i * cellSize
      ctx.moveTo(x, yOffset)
      ctx.lineTo(x, yOffset + gridSize)
      const y = yOffset + i * cellSize
      ctx.moveTo(xOffset, y)
      ctx.lineTo(xOffset + gridSize, y)
    }
    ctx.stroke()

    const hasDuration = data.durationMatrix !== null && maxDuration > 0
    const maxDotRadius = cellSize * 0.45
    const isHighlightActive = highlight !== 'none' && highlightMask !== null
    const accentColor = getHighlightColor()
    const maskDiagonal = masking === 'diagonal' || masking === 'diagonalLower'
    const maskLower = masking === 'diagonalLower'

    // diagonalLower masks the entire upper triangle (i ≤ j). Paint it as ONE rect
    // per row (cols i..N-1) instead of N²/2 individual cell fills, colour set once.
    if (maskLower) {
      ctx.fillStyle = L.diagonalColor
      for (let i = 0; i < N; i++) {
        ctx.fillRect(colToX(i), rowToY(i), (N - i) * cellSize, cellSize)
      }
    }

    // Guard against redundant fillStyle string re-assignment (a per-run cost).
    let lastFill = ''
    for (let i = 0; i < N; i++) {
      const rowOffset = i * N
      // Skip the upper triangle already painted above when masking the lower half.
      const jStart = maskLower ? i + 1 : 0
      for (let j = jStart; j < N; j++) {
        if (maskDiagonal && i === j) {
          if (lastFill !== L.diagonalColor) {
            ctx.fillStyle = L.diagonalColor
            lastFill = L.diagonalColor
          }
          ctx.fillRect(colToX(j) + 1, rowToY(i) + 1, cellSize - 2, cellSize - 2)
          continue
        }
        if (!data.matrix[rowOffset + j]) continue

        const cx = colToX(j) + cellSize / 2
        const cy = rowToY(i) + cellSize / 2

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
        const halfCell = cellSize / 2
        if (hasDuration && data.durationMatrix) {
          const ratio = Math.max(0.15, data.durationMatrix[rowOffset + j] / maxDuration)
          ctx.globalAlpha = dotAlpha * (0.3 + 0.7 * ratio)
          ctx.beginPath()
          ctx.arc(cx, cy, Math.min(halfCell, maxDotRadius * Math.sqrt(ratio)), 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = dotAlpha
          ctx.beginPath()
          ctx.arc(cx, cy, Math.min(halfCell, Math.max(1.5, maxDotRadius * 0.6)), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    }
  }

  /**
   * Dense regime: blit the cached recurrence texture, scaled to the (square)
   * frame. The texture is rebuilt (a single matrix scan) only when the data or
   * appearance changes — a resize just re-scales it, so dragging a huge matrix
   * costs one drawImage, not an N² rescan. Downscaling averages (smoothing on)
   * into a clean recurrence-density texture; upscaling stays crisp (nearest).
   */
  function drawTexture(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!data) return
    const res = Math.max(1, Math.min(N, MAX_TEXTURE_PX))
    const activeMask =
      highlight !== 'none' && highlightMask !== null ? highlightMask : null
    const stale =
      texData !== data ||
      texHighlight !== highlight ||
      texMasking !== masking ||
      texMask !== activeMask ||
      texRes !== res ||
      !texCanvas

    if (stale) {
      if (!texU32 || texRes !== res) {
        if (typeof OffscreenCanvas !== 'undefined') {
          texCanvas = new OffscreenCanvas(res, res)
        } else if (typeof document !== 'undefined') {
          texCanvas = Object.assign(document.createElement('canvas'), {
            width: res,
            height: res,
          })
        } else {
          return // canvas-less environment (tests)
        }
        texCtx = texCanvas.getContext('2d') as
          | OffscreenCanvasRenderingContext2D
          | CanvasRenderingContext2D
          | null
        texImg = texCtx ? texCtx.createImageData(res, res) : null
        texU32 = texImg ? new Uint32Array(texImg.data.buffer) : null
        texAlpha = new Uint8Array(res * res)
        texRes = res
      }
      if (!texCtx || !texImg || !texU32 || !texAlpha) return

      const { rgb: colRgb, hasAoi } = columnColors
      rasterizeRecurrenceTexture(
        {
          n: N,
          res,
          matrix: data.matrix,
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
        texU32,
        texAlpha
      )
      texCtx.putImageData(texImg, 0, 0)
      texData = data
      texHighlight = highlight
      texMasking = masking
      texMask = activeMask
    }
    if (!texCanvas) return

    const prevSmoothing = ctx.imageSmoothingEnabled
    ctx.imageSmoothingEnabled = texRes > frame.width // smooth on downscale only
    ctx.drawImage(
      texCanvas as CanvasImageSource,
      0,
      0,
      texRes,
      texRes,
      frame.x,
      frame.y,
      frame.width,
      frame.width
    )
    ctx.imageSmoothingEnabled = prevSmoothing
  }

  function drawHoverCrosshair(ctx: CanvasRenderingContext2D, frame: PlotFrame) {
    if (!hoveredCell) return
    const cellSize = frame.width / N
    const gridSize = frame.width
    const { x: xOffset, y: yOffset } = frame
    const colX = xOffset + hoveredCell.col * cellSize
    const rowY = yOffset + (N - 1 - hoveredCell.row) * cellSize

    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#007acc'
    ctx.fillRect(colX, yOffset, cellSize, gridSize)
    ctx.fillRect(xOffset, rowY, gridSize, cellSize)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = '#007acc'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(colX, yOffset)
    ctx.lineTo(colX, yOffset + gridSize)
    ctx.moveTo(colX + cellSize, yOffset)
    ctx.lineTo(colX + cellSize, yOffset + gridSize)
    ctx.moveTo(xOffset, rowY)
    ctx.lineTo(xOffset + gridSize, rowY)
    ctx.moveTo(xOffset, rowY + cellSize)
    ctx.lineTo(xOffset + gridSize, rowY + cellSize)
    ctx.stroke()
    ctx.restore()
  }
</script>

<canvas
  use:plot.plotAction
  use:canvasBlockSelect={{ regions: plot.blockedRegions }}
></canvas>
