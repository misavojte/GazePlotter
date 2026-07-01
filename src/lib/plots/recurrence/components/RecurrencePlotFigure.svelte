<script lang="ts">
  import {
    usePlot,
    categoryTicks,
    canvasBlockSelect,
    NO_MARGINS,
    type CanvasExportProps,
    type PlotFrame,
    type FrameHit,
  } from '$lib/plots/shared'
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

  const plot = usePlot<{ row: number; col: number }>({
    width: () => width,
    height: () => height,
    margins: () => margins,
    dpiOverride: () => dpiOverride,
    deps: () => [data, highlight, masking, highlightMask],
    placeholder: () => (N < 2 ? 'Not enough fixations' : null),
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
    const gridSize = frame.width
    const { x: xOffset, y: yOffset } = frame
    const colToX = (col: number) => xOffset + col * cellSize
    const rowToY = (row: number) => yOffset + (N - 1 - row) * cellSize

    // Grid background + lines. Batched into one path (was 2·(N+1) separate
    // stroke composites), and skipped once cells are too small to resolve a line
    // — below that the lines would merge into a solid wash over the background.
    ctx.fillStyle = L.gridBgColor
    ctx.fillRect(xOffset, yOffset, gridSize, gridSize)
    if (cellSize >= RECURRENCE_LAYOUT.minCellSize) {
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
    }

    // Recurrence dots
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
