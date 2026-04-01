<script lang="ts">
  import { getColorForValue, getContrastTextColor } from '$lib/color/utility'
  import { updateTooltip } from '$lib/tooltip'
  import {
    truncateTextToPixelWidth,
    SYSTEM_SANS_SERIF_STACK,
  } from '$lib/shared/utils/textUtils'
  import { getContext, untrack } from 'svelte'
  import {
    createCanvasState,
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    alignToPixelCenter,
    createRenderScheduler,
    canvasLifecycleAction,
    refreshCanvasLifecycle,
  } from '$lib/plots/shared/canvasUtils'
  import type { CanvasState } from '$lib/plots/shared/canvasUtils'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
    registerCanvasExportSource,
  } from '$lib/data/export'
  import { SIMILARITY_MATRIX_LAYOUT } from '../const'
  import { computeSimilarityMatrixLayout } from '../core/layout'
  import {
    computeGradientLegendGeometry,
    drawGradientLegend,
    drawPlotOutline,
  } from '$lib/plots/shared'
  import { UI_COLORS } from '$lib/color'

  let {
    matrix = new Float64Array(0),
    labels = [],
    height = 500,
    width = 500,
    colorScale = ['#f7fbff', '#08306b'],
    colorValueRange = [0, 1],
    dpiOverride = null,
    marginTop = 0,
    marginRight = 0,
    marginBottom = 0,
    marginLeft = 0,
  } = $props<{
    matrix: Float64Array
    labels: string[]
    height?: number
    width?: number
    colorScale?: string[]
    colorValueRange: [number, number]
    dpiOverride?: number | null
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
  }>()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    return registerCanvasExportSource(exportRegistrar, () => canvas)
  })

  const getCanvasDimensions = () => ({
    width: width + marginLeft + marginRight,
    height: height + marginTop + marginBottom,
  })
  const scheduleRender = createRenderScheduler(renderCanvas)

  const effectiveMaxValue = $derived.by(() => {
    if (colorValueRange[1] !== 0) return colorValueRange[1]
    let maxValue = 0
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] > maxValue) maxValue = matrix[i]
    }
    return Math.ceil(maxValue * 100) / 100
  })

  const layout = $derived.by(() =>
    computeSimilarityMatrixLayout({
      width: width + marginLeft + marginRight,
      height: height + marginTop + marginBottom,
      labels,
      effectiveMaxValue,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    })
  )

  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)
    const ctx = canvasState.context
    if (!ctx) return

    if (labels.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const cw = width + marginLeft + marginRight
      const ch = height + marginTop + marginBottom
      ctx.fillText('No participant data available', cw >> 1, ch >> 1)
      finishCanvasDrawing(canvasState)
      return
    }

    drawGrid(ctx)
    drawCells(ctx)
    drawPlotOutline(
      ctx,
      layout.xOffset,
      layout.yOffset,
      layout.gridWidth,
      layout.gridHeight
    )
    drawLegend(ctx)
    setUpFont(ctx)
    drawAxisLabels(ctx)
    const labelFontSize = setUpLabelFont(ctx)
    drawRowLabels(ctx, labelFontSize)
    drawColumnLabels(ctx, labelFontSize)
    drawCellsText(ctx)
    finishCanvasDrawing(canvasState)
  }

  function setUpFont(ctx: CanvasRenderingContext2D) {
    ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
  }

  function drawAxisLabels(ctx: CanvasRenderingContext2D) {
    setUpFont(ctx)
    const unitText = layout.isCompactMode ? '[indices]' : '[names]'
    const {
      xOffset,
      yOffset,
      gridWidth,
      gridHeight,
      xAxisLabelHeight,
      yAxisLabelWidth,
      axisTitleGap,
    } = layout

    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const xTitleY = yOffset - xAxisLabelHeight - axisTitleGap
    ctx.fillText(
      `Participant ${unitText}`,
      xOffset + gridWidth * 0.5,
      xTitleY
    )

    ctx.save()
    const yTitleX = xOffset - yAxisLabelWidth - axisTitleGap
    const yTitleY = yOffset + gridHeight * 0.5
    ctx.translate(yTitleX, yTitleY)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`Participant ${unitText}`, 0, 0)
    ctx.restore()
  }

  function setUpLabelFont(ctx: CanvasRenderingContext2D): number {
    ctx.font = `${layout.fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    return layout.fontSize
  }

  function drawRowLabels(ctx: CanvasRenderingContext2D, labelFontSize: number) {
    if (!layout.showAxisLabels) return
    ctx.textAlign = 'end'
    ctx.textBaseline = 'middle'
    for (let row = 0; row < labels.length; row++) {
      if (layout.isUltraCompactMode && row % layout.thinFactor !== 0) continue
      if (
        layout.isCompactMode &&
        !layout.isUltraCompactMode &&
        (row + 1) % layout.thinFactor !== 0
      )
        continue

      const x = layout.xOffset - layout.individualLabelMargin
      const y =
        layout.yOffset + row * layout.cellSize + layout.cellSize * 0.5 + 1

      if (layout.isUltraCompactMode) {
        ctx.beginPath()
        ctx.moveTo(layout.xOffset, y - 1)
        ctx.lineTo(layout.xOffset - 4, y - 1)
        ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
        ctx.stroke()
      }

      const labelText = layout.isCompactMode
        ? layout.isUltraCompactMode
          ? row.toString()
          : (row + 1).toString()
        : truncateTextToPixelWidth(
            labels[row],
            SIMILARITY_MATRIX_LAYOUT.maxLabelLength,
            labelFontSize,
            SYSTEM_SANS_SERIF_STACK,
            '...'
          )

      ctx.fillText(labelText, x, y)
    }
  }

  function drawColumnLabels(
    ctx: CanvasRenderingContext2D,
    labelFontSize: number
  ) {
    if (!layout.showAxisLabels) return
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (let col = 0; col < labels.length; col++) {
      if (layout.isUltraCompactMode && col % layout.thinFactor !== 0) continue
      if (
        layout.isCompactMode &&
        !layout.isUltraCompactMode &&
        (col + 1) % layout.thinFactor !== 0
      )
        continue

      const x = layout.xOffset + col * layout.cellSize + layout.cellSize * 0.5
      const y = layout.yOffset - layout.individualLabelMargin

      if (layout.isUltraCompactMode) {
        ctx.beginPath()
        ctx.moveTo(x, layout.yOffset)
        ctx.lineTo(x, layout.yOffset - 4)
        ctx.strokeStyle = UI_COLORS.TEXT_SECONDARY
        ctx.stroke()
      }

      ctx.save()
      ctx.translate(x, y)
      if (!layout.isCompactMode) {
        ctx.rotate(-Math.PI / 4)
      } else {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
      }

      const labelText = layout.isCompactMode
        ? layout.isUltraCompactMode
          ? col.toString()
          : (col + 1).toString()
        : truncateTextToPixelWidth(
            labels[col],
            SIMILARITY_MATRIX_LAYOUT.maxLabelLength * 1.5,
            labelFontSize,
            SYSTEM_SANS_SERIF_STACK,
            '...'
          )

      ctx.fillText(labelText, 0, 0)
      ctx.restore()
    }
  }

  function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = UI_COLORS.BORDER_DEFAULT
    ctx.lineWidth = 0.5
    const { xOffset, yOffset, cellSize, gridWidth, gridHeight } = layout
    const size = labels.length

    for (let col = 0; col <= size; col++) {
      const x = alignToPixelCenter(xOffset + col * cellSize)
      ctx.beginPath()
      ctx.moveTo(x, yOffset)
      ctx.lineTo(x, yOffset + gridHeight)
      ctx.stroke()
    }

    for (let row = 0; row <= size; row++) {
      const y = alignToPixelCenter(yOffset + row * cellSize)
      ctx.beginPath()
      ctx.moveTo(xOffset, y)
      ctx.lineTo(xOffset + gridWidth, y)
      ctx.stroke()
    }
  }

  function drawCells(ctx: CanvasRenderingContext2D) {
    const { xOffset, yOffset, cellSize } = layout
    const size = labels.length

    for (let row = 0; row < size; row++) {
      const rowOffset = row * size
      for (let col = 0; col < size; col++) {
        const value = matrix[rowOffset + col] ?? 0
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize
        ctx.fillStyle = getColor(value)
        ctx.fillRect(x, y, cellSize, cellSize)
      }
    }
  }

  function drawCellsText(ctx: CanvasRenderingContext2D) {
    if (!layout.showCellValues) return
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const { xOffset, yOffset, cellSize, cellValueFontSize } = layout
    ctx.font = `${cellValueFontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    const size = labels.length

    for (let row = 0; row < size; row++) {
      const rowOffset = row * size
      for (let col = 0; col < size; col++) {
        const value = matrix[rowOffset + col] ?? 0
        const displayValue = value.toFixed(2)
        ctx.fillStyle = getContrastTextColor(getColor(value))
        const x = xOffset + col * cellSize
        const y = yOffset + row * cellSize
        ctx.fillText(displayValue, x + cellSize * 0.5, y + cellSize * 0.5 + 1)
      }
    }
  }

  function getColor(value: number): string {
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  const legendGeometry = $derived.by(() => {
    const { gridWidth, xOffset, matrixBottom } = layout
    const canvasHeight = height + marginTop + marginBottom
    const availableLegendSpace = canvasHeight - matrixBottom - 10

    return computeGradientLegendGeometry({
      x: xOffset,
      y: matrixBottom + 5,
      availableWidth: gridWidth,
      availableHeight: availableLegendSpace,
      colorScale,
      valueRange: colorValueRange,
      effectiveMaxValue,
      title: 'Similarity',
    })
  })

  function drawLegend(ctx: CanvasRenderingContext2D) {
    if (legendGeometry) {
      drawGradientLegend(ctx, legendGeometry, {
        x: 0,
        y: 0,
        availableWidth: 0,
        availableHeight: 0,
        colorScale,
        valueRange: colorValueRange,
        effectiveMaxValue,
        title: 'Similarity',
      })
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return
    const { x: mouseX, y: mouseY } = getScaledMousePosition(canvasState, event)
    const { xOffset, yOffset, cellSize } = layout
    const col = Math.floor((mouseX - xOffset) / cellSize)
    const row = Math.floor((mouseY - yOffset) / cellSize)
    const size = labels.length
    const isOverCell =
      row >= 0 && row < size && col >= 0 && col < size

    if (isOverCell) {
      const value = matrix[row * size + col] ?? 0
      const x = xOffset + col * cellSize
      const y = yOffset + row * cellSize
      const tooltipPos = getTooltipPosition(
        canvasState,
        x + cellSize,
        y + (cellSize >> 1),
        { x: 10, y: 0 }
      )
      updateTooltip({
        id: 'similarity-matrix-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'Row', value: labels[row] },
          { key: 'Column', value: labels[col] },
          { key: 'Similarity', value: value.toFixed(3) },
        ],
        visible: true,
        width: 160,
      })
    } else {
      updateTooltip(null)
    }

    if (canvas) {
      canvas.style.cursor = isOverCell ? 'pointer' : 'default'
    }
  }

  function handleMouseLeave() {
    updateTooltip(null)
    if (canvas) canvas.style.cursor = 'default'
  }

  $effect(() => {
    const _ = [
      matrix,
      labels,
      width,
      height,
      colorScale,
      colorValueRange,
      dpiOverride,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    ]

    untrack(() => {
      refreshCanvasLifecycle({
        getState: () => canvasState,
        setState: newState => {
          canvasState = newState
        },
        getDimensions: getCanvasDimensions,
        getDpiOverride: () => dpiOverride,
        scheduleRender,
      })
    })
  })
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={{
    getState: () => canvasState,
    setState: newState => {
      canvasState = newState
    },
    getDimensions: getCanvasDimensions,
    getDpiOverride: () => dpiOverride,
    render: renderCanvas,
    scheduleRender,
  }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
></canvas>
