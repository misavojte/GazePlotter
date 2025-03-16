<script lang="ts">
  import type { AOI } from '../types/AOI.js'
  import AoiTransitionMatrixLegend from './AoiTransitionMatrixLegend.svelte'

  // SVG layout constants
  const MARGIN = 40
  const LABEL_OFFSET = 25
  const LEGEND_HEIGHT = 40

  let {
    aoiTransitionMatrix = [],
    aoiLabels = [],
    height = 500,
    width = 500,
    cellSize = 30,
    colorScale = ['#f7fbff', '#08306b'],
    xLabel = 'From AOI',
    yLabel = 'To AOI',
    legendTitle = 'Transition Count',
  } = $props<{
    aoiTransitionMatrix: number[][]
    aoiLabels: string[]
    height?: number
    width?: number
    cellSize?: number
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
  }>()

  // Hover state for tooltip
  let hoverCell: {
    row: number
    col: number
    value: number
    x: number
    y: number
  } | null = $state(null)

  // Throttle mouse events
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 40

  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const mouseX = event.clientX - rect.left - xOffset
    const mouseY = event.clientY - rect.top - yOffset

    // Calculate grid size
    const gridWidth = cellSize * aoiLabels.length

    // Only process if mouse is within plot area
    if (
      mouseX >= 0 &&
      mouseX <= gridWidth &&
      mouseY >= 0 &&
      mouseY <= gridWidth
    ) {
      const col = Math.floor(mouseX / cellSize)
      const row = Math.floor(mouseY / cellSize)

      if (
        row >= 0 &&
        row < aoiTransitionMatrix.length &&
        col >= 0 &&
        col < aoiTransitionMatrix[0].length
      ) {
        hoverCell = {
          row,
          col,
          value: aoiTransitionMatrix[row][col],
          x: event.clientX,
          y: event.clientY,
        }
      } else {
        hoverCell = null
      }
    } else {
      hoverCell = null
    }
  }

  function handleMouseLeave() {
    hoverCell = null
  }

  // Calculate color based on value
  function getColor(value: number): string {
    if (value === 0) return colorScale[0]

    // Find max value in matrix for normalization
    const maxValue = Math.max(...aoiTransitionMatrix.flat())
    if (maxValue === 0) return colorScale[0]

    // Simple linear interpolation between colors
    const normalizedValue = value / maxValue

    // For simplicity, we just interpolate from light to dark
    return interpolateColor(colorScale[0], colorScale[1], normalizedValue)
  }

  // Simple color interpolation function
  function interpolateColor(
    color1: string,
    color2: string,
    factor: number
  ): string {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16)
    const g1 = parseInt(color1.slice(3, 5), 16)
    const b1 = parseInt(color1.slice(5, 7), 16)

    const r2 = parseInt(color2.slice(1, 3), 16)
    const g2 = parseInt(color2.slice(3, 5), 16)
    const b2 = parseInt(color2.slice(5, 7), 16)

    // Interpolate
    const r = Math.round(r1 + factor * (r2 - r1))
    const g = Math.round(g1 + factor * (g2 - g1))
    const b = Math.round(b1 + factor * (b2 - b1))

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Get max value for legend
  const maxValue = $derived.by(() => {
    const flatMatrix = aoiTransitionMatrix.flat()
    return flatMatrix.length > 0 ? Math.max(...flatMatrix) : 0
  })

  // Compute offsets and sizes
  const gridSize = $derived.by(() => cellSize * aoiLabels.length)
  const xOffset = $derived.by(
    () => MARGIN + (width - 2 * MARGIN - gridSize) / 2
  )
  const yOffset = $derived.by(
    () => MARGIN + (height - 2 * MARGIN - LEGEND_HEIGHT - gridSize) / 2
  )
</script>

<div class="plot-container">
  <svg
    {width}
    {height}
    style="background: transparent;"
    viewBox="0 0 {width} {height}"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="AOI Transition Matrix Plot"
  >
    <!-- Y-axis label -->
    <text
      x={xOffset - LABEL_OFFSET}
      y={yOffset + gridSize / 2}
      text-anchor="middle"
      font-size="12"
      transform={`rotate(-90 ${xOffset - LABEL_OFFSET} ${yOffset + gridSize / 2})`}
    >
      {yLabel}
    </text>

    <!-- X-axis label -->
    <text
      x={xOffset + gridSize / 2}
      y={yOffset + gridSize + LABEL_OFFSET}
      text-anchor="middle"
      font-size="12"
    >
      {xLabel}
    </text>

    <!-- Grid and cells -->
    {#each aoiTransitionMatrix as row, rowIndex}
      {#each row as cell, colIndex}
        <rect
          x={xOffset + colIndex * cellSize}
          y={yOffset + rowIndex * cellSize}
          width={cellSize}
          height={cellSize}
          fill={getColor(cell)}
          stroke="#666"
          stroke-width="1"
        />
        {#if cell > 0}
          <text
            x={xOffset + colIndex * cellSize + cellSize / 2}
            y={yOffset + rowIndex * cellSize + cellSize / 2}
            text-anchor="middle"
            dominant-baseline="central"
            font-size="10"
            fill={getColor(cell) === colorScale[0] ? '#000' : '#fff'}
          >
            {cell}
          </text>
        {/if}
      {/each}
    {/each}

    <!-- Y-axis labels (AOI names) -->
    {#each aoiLabels as label, index}
      <text
        x={xOffset - 5}
        y={yOffset + index * cellSize + cellSize / 2}
        text-anchor="end"
        dominant-baseline="middle"
        font-size="12"
      >
        {label}
      </text>
    {/each}

    <!-- X-axis labels (AOI names) - rotated for better fit -->
    {#each aoiLabels as label, index}
      <text
        x={xOffset + index * cellSize + cellSize / 2}
        y={yOffset + gridSize + 5}
        text-anchor="start"
        font-size="12"
        transform={`rotate(45 ${xOffset + index * cellSize + cellSize / 2} ${yOffset + gridSize + 5})`}
      >
        {label}
      </text>
    {/each}

    <!-- Legend -->
    <AoiTransitionMatrixLegend
      {width}
      height={LEGEND_HEIGHT}
      y={yOffset + gridSize + LABEL_OFFSET + 10}
      {colorScale}
      {maxValue}
      title={legendTitle}
    />
  </svg>

  <!-- Tooltip -->
  {#if hoverCell}
    <div style="position: fixed; top: 0; left: 0; pointer-events: none;">
      <div
        class="tooltip"
        style="
          transform: translate3d({Math.min(
          hoverCell.x + 15,
          window.innerWidth - 120
        )}px, 
            {Math.min(hoverCell.y + 15, window.innerHeight - 80)}px, 
            0
          )
        "
      >
        <div class="tooltip-content">
          <strong>From: {aoiLabels[hoverCell.col]}</strong><br />
          <strong>To: {aoiLabels[hoverCell.row]}</strong><br />
          Count: {hoverCell.value}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .plot-container {
    position: relative;
  }

  .tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 10000;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .tooltip-content {
    white-space: normal;
    word-wrap: break-word;
    font-size: 10px;
  }
</style>
