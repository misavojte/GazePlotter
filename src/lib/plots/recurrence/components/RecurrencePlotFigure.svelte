<script lang="ts">
  import { updateTooltip } from '$lib/tooltip'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { untrack } from 'svelte'
  import {
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    canvasLifecycleAction,
  } from '$lib/plots/shared/canvasUtils'
  import { RECURRENCE_LAYOUT } from '../const'
  import {
    drawPlotArea,
    useCanvasPlot,
    canvasBlockSelect,
    type BlockedRegion,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'
  import type {
    RecurrenceData,
    RecurrenceHighlight,
    RecurrenceMasking,
  } from '../types'

  let {
    data,
    highlight = 'none',
    masking = 'diagonal',
    highlightMask = null,
    width = 400,
    height = 400,
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  } = $props<{
    data: RecurrenceData
    highlight?: RecurrenceHighlight
    masking?: RecurrenceMasking
    highlightMask?: Uint8Array | null
    width?: number
    height?: number
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }>()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let hoveredCell = $state<{ row: number; col: number } | null>(null)

  const plot = useCanvasPlot({
    render: renderCanvas,
    getWidth: () => width,
    getHeight: () => height,
    getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
    getDpiOverride: () => dpiOverride,
  })

  $effect(() => plot.registerExportSource(() => canvas))

  const L = RECURRENCE_LAYOUT

  const layout = $derived.by(() => {
    const N = data.fixationCount

    const maxDigits = N.toString().length
    const approxCharWidth = L.tickFontSize * 0.6
    const tickLabelWidth = maxDigits * approxCharWidth + 4

    const yAxisSpace =
      L.leftMargin +
      L.labelFontSize +
      L.axisTitleGap +
      tickLabelWidth +
      L.tickLength +
      4

    const xAxisSpace =
      L.tickLength + L.tickFontSize + 6 + L.labelFontSize + L.axisTitleGap

    const availW = width - yAxisSpace - L.rightMargin
    const availH = height - L.topMargin - xAxisSpace

    const plotSize = Math.max(0, Math.min(availW, availH))
    const cellSize = N < 2 ? 0 : Math.max(L.minCellSize, plotSize / N)
    const gridSize = cellSize * N

    const xOffset = Math.floor(marginLeft + yAxisSpace + (availW - gridSize) / 2)
    const yOffset = Math.floor(marginTop + L.topMargin)

    const tickStep = N <= 20 ? 1 : Math.ceil(N / 10)

    return { N, cellSize, gridSize, xOffset, yOffset, tickStep }
  })

  // Recurrence matrix body is the only blocked region; no legend.
  const blockedRegions = $derived<BlockedRegion[]>([
    {
      x: layout.xOffset,
      y: layout.yOffset,
      w: layout.gridSize,
      h: layout.gridSize,
    },
  ])

  const maxDuration = $derived.by(() => {
    if (!data.durationMatrix) return 0
    let max = 0
    for (let i = 0; i < data.durationMatrix.length; i++) {
      if (data.durationMatrix[i] > max) max = data.durationMatrix[i]
    }
    return max
  })

  function rowToY(row: number): number {
    return layout.yOffset + (layout.N - 1 - row) * layout.cellSize
  }

  function colToX(col: number): number {
    return layout.xOffset + col * layout.cellSize
  }

  /**
   * Get the accent color for the current highlight mode.
   */
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

  function renderCanvas() {
    beginCanvasDrawing(plot.canvasState, true)
    const ctx = plot.canvasState.context
    if (!ctx) return

    const { N, cellSize, gridSize, xOffset, yOffset } = layout

    if (N < 2) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const cw = width + marginLeft + marginRight
      const ch = height + marginTop + marginBottom
      ctx.fillText('Not enough fixations', cw >> 1, ch >> 1)
      finishCanvasDrawing(plot.canvasState)
      return
    }

    // Grid background
    ctx.fillStyle = L.gridBgColor
    ctx.fillRect(xOffset, yOffset, gridSize, gridSize)

    // Grid lines
    ctx.strokeStyle = L.gridLineColor
    ctx.lineWidth = 0.5
    for (let i = 0; i <= N; i++) {
      const x = xOffset + i * cellSize
      ctx.beginPath()
      ctx.moveTo(x, yOffset)
      ctx.lineTo(x, yOffset + gridSize)
      ctx.stroke()
    }
    for (let i = 0; i <= N; i++) {
      const y = yOffset + i * cellSize
      ctx.beginPath()
      ctx.moveTo(xOffset, y)
      ctx.lineTo(xOffset + gridSize, y)
      ctx.stroke()
    }

    // Recurrence dots
    const hasDuration = data.durationMatrix !== null && maxDuration > 0
    const maxDotRadius = cellSize * 0.45
    const isHighlightActive = highlight !== 'none' && highlightMask !== null
    const accentColor = getHighlightColor()
    const maskDiagonal = masking === 'diagonal' || masking === 'diagonalLower'
    const maskLower = masking === 'diagonalLower'

    for (let i = 0; i < N; i++) {
      const rowOffset = i * N
      for (let j = 0; j < N; j++) {
        // Masking: gray out diagonal + visual lower triangle (i <= j)
        if (maskLower && i <= j) {
          ctx.fillStyle = L.diagonalColor
          ctx.fillRect(colToX(j), rowToY(i), cellSize, cellSize)
          continue
        }

        // Masking: diagonal cells rendered as gray squares
        if (maskDiagonal && i === j) {
          ctx.fillStyle = L.diagonalColor
          ctx.fillRect(
            colToX(j) + 1,
            rowToY(i) + 1,
            cellSize - 2,
            cellSize - 2
          )
          continue
        }

        if (!data.matrix[rowOffset + j]) continue

        const cx = colToX(j) + cellSize / 2
        const cy = rowToY(i) + cellSize / 2

        // Base color: use AOI color if available, otherwise default
        let dotColor: string = L.dotColor
        let dotAlpha = 1

        const aoiColor = data.fixationAoiColors[j]
        if (aoiColor) {
          dotColor = aoiColor
        }

        // Highlighting: accent for highlighted cells, dim the rest
        if (isHighlightActive && highlightMask) {
          const idx = rowOffset + j
          if (highlightMask[idx]) {
            // Highlighted: keep AOI color if present, otherwise use accent
            if (!aoiColor) dotColor = accentColor
          } else {
            dotColor = L.dimmedColor
            dotAlpha = L.dimmedAlpha
          }
        }

        // Duration weighting: always applied when available
        ctx.fillStyle = dotColor
        if (hasDuration && data.durationMatrix) {
          const durVal = data.durationMatrix[rowOffset + j]
          const ratio = Math.max(0.15, durVal / maxDuration)
          const r = maxDotRadius * Math.sqrt(ratio)

          ctx.globalAlpha = dotAlpha * (0.3 + 0.7 * ratio)
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = dotAlpha
          const r = Math.max(1.5, maxDotRadius * 0.6)
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalAlpha = 1
      }
    }

    // Hover crosshair highlight
    if (hoveredCell) {
      const hCol = hoveredCell.col
      const hRow = hoveredCell.row

      ctx.save()
      ctx.globalAlpha = 0.18
      ctx.fillStyle = '#007acc'
      ctx.fillRect(colToX(hCol), yOffset, cellSize, gridSize)
      ctx.fillRect(xOffset, rowToY(hRow), gridSize, cellSize)
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = '#007acc'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])

      const colX = colToX(hCol)
      const rowY = rowToY(hRow)

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

    // Plot outline
    drawPlotArea(ctx, {
      x: xOffset,
      y: yOffset,
      width: gridSize,
      height: gridSize,
    })

    // Axis labels
    drawAxisLabels(ctx)

    finishCanvasDrawing(plot.canvasState)
  }

  function drawAxisLabels(ctx: CanvasRenderingContext2D) {
    const { N, cellSize, gridSize, xOffset, yOffset, tickStep } = layout

    ctx.font = `${L.tickFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
    ctx.lineWidth = 1

    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (let i = 1; i <= N; i++) {
      if (tickStep > 1 && i % tickStep !== 0 && i !== 1 && i !== N) continue
      const x = xOffset + (i - 0.5) * cellSize
      const y = yOffset + gridSize

      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + L.tickLength)
      ctx.stroke()
      ctx.fillText(i.toString(), x, y + L.tickLength + 2)
    }

    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 1; i <= N; i++) {
      if (tickStep > 1 && i % tickStep !== 0 && i !== 1 && i !== N) continue
      const x = xOffset
      const y = rowToY(i - 1) + cellSize / 2

      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - L.tickLength, y)
      ctx.stroke()
      ctx.fillText(i.toString(), x - L.tickLength - 2, y)
    }

    ctx.font = `${L.labelFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(
      'Fixation j',
      xOffset + gridSize / 2,
      yOffset + gridSize + L.tickLength + L.tickFontSize + 6
    )

    ctx.save()
    ctx.translate(
      xOffset -
        L.tickLength -
        L.tickFontSize * layout.N.toString().length * 0.6 -
        14,
      yOffset + gridSize / 2
    )
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Fixation i', 0, 0)
    ctx.restore()
  }


  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return
    const { x: mouseX, y: mouseY } = getScaledMousePosition(plot.canvasState, event)

    const { N, cellSize, xOffset, yOffset } = layout

    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = N - 1 - Math.floor((mouseY - yOffset) / cellSize)

    const isOverCell = row >= 0 && row < N && col >= 0 && col < N

    if (isOverCell) {
      if (canvas) canvas.style.cursor = 'crosshair'
      if (!hoveredCell || hoveredCell.row !== row || hoveredCell.col !== col) {
        hoveredCell = { row, col }
        plot.scheduleRender()
      }

      const idx = row * N + col
      const isRecurrent = !!data.matrix[idx]
      const content: { key: string; value: string }[] = [
        { key: 'Fixation j', value: (col + 1).toString() },
        { key: 'Fixation i', value: (row + 1).toString() },
        { key: 'Recurrent', value: isRecurrent ? 'Yes' : 'No' },
      ]

      if (isRecurrent && data.durationMatrix) {
        const dur = data.durationMatrix[idx]
        content.push({ key: 'Duration sum', value: `${dur.toFixed(0)} ms` })
      }

      const tooltipPos = getTooltipPosition(
        plot.canvasState,
        colToX(col) + cellSize,
        rowToY(row) + cellSize / 2,
        { x: 10, y: 0 }
      )

      updateTooltip({
        id: 'recurrence-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content,
        visible: true,
        width: 140,
      })
    } else {
      if (canvas) canvas.style.cursor = 'default'
      if (hoveredCell) {
        hoveredCell = null
        plot.scheduleRender()
      }
      updateTooltip(null)
    }
  }

  function handleMouseLeave() {
    if (canvas) canvas.style.cursor = 'default'
    if (hoveredCell) {
      hoveredCell = null
      plot.scheduleRender()
    }
    updateTooltip(null)
  }

  $effect(() => {
    const _ = [data, highlight, masking, highlightMask, width, height, dpiOverride, marginTop, marginRight, marginBottom, marginLeft]
    untrack(() => plot.refresh())
  })
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={plot.actionOptions}
  use:canvasBlockSelect={{ regions: blockedRegions }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
></canvas>
