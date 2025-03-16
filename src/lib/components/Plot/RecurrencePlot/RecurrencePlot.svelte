<script lang="ts">
  import { computeRecurrenceMatrix } from '$lib/utils/recurrenceMatrix'
  import type { Fixation } from '$lib/type/Fixation/Fixation'
  import type { Snippet } from 'svelte'
  import RecurrencePlotLegend from './RecurrencePlotLegend.svelte'
  import type { MatrixGenerator } from '$lib/type/MatrixGenerator/MatrixGenerator'
  import { fade } from 'svelte/transition'

  // SVG layout constants
  const MARGIN = 45 // Equal margin on both sides
  const X_AXIS_HEIGHT = 40 // Total height reserved for x-axis label
  const LABEL_OFFSET = 32 // Distance of axis labels from plot
  const LEGEND_HEIGHT = 40 // Base height for one row of legend items

  function calculateLegendHeight(
    width: number,
    aoiColors: Array<{ aoi: string; color: string }>
  ): { legendHeight: number; legendConstant: number } {
    const BASE_ITEM_WIDTH = 25 // Base space for the circle and padding
    const CHAR_WIDTH = 7 // Estimated width per character

    // Calculate max label length
    const maxLabelLength = Math.max(
      ...aoiColors.map(item => item.aoi.length),
      0
    )
    const estimatedItemWidth = BASE_ITEM_WIDTH + maxLabelLength * CHAR_WIDTH
    const ITEM_WIDTH = Math.min(estimatedItemWidth, 150)

    // Calculate rows needed for legend items
    const AOI_LEGEND_MAX_WIDTH = width - 20
    const ITEMS_PER_ROW = Math.max(
      Math.floor(AOI_LEGEND_MAX_WIDTH / ITEM_WIDTH),
      1
    )
    const numRows =
      aoiColors.length > 0 ? Math.ceil(aoiColors.length / ITEMS_PER_ROW) : 0

    const legendFixedOffset = 5 // Base offset for legend elements
    const AOI_LEGEND_LINE_HEIGHT = 30 // Height per legend row

    const legendConstant = numRows * AOI_LEGEND_LINE_HEIGHT + legendFixedOffset
    const legendHeight = legendConstant

    return { legendHeight, legendConstant }
  }

  let {
    fixations,
    height = 600,
    width = 500,
    pointSize = 4,
    showGrid = false,
    gridColor = '#CCCCCC',
    xLabel = 'Fixation i',
    yLabel = 'Fixation j',
    labelStep = 5, // Controls both labels and main grid
    showMainGrid = true, // New prop for showing main grid lines
    aoiColors = [], // Changed to array of objects
    tooltipSnippet = [],
    matrixGenerator = computeRecurrenceMatrix,
  } = $props<{
    fixations: Fixation[]
    height?: number
    width?: number
    pointSize?: number
    showGrid?: boolean
    gridColor?: string
    xLabel?: string
    yLabel?: string

    labelStep?: number
    showMainGrid?: boolean
    aoiColors?: Array<{ aoi: string; color: string }> // New type for AOI colors
    tooltipSnippet?: Snippet<[aoi: string, fixationLabel: string]>
    matrixGenerator?: MatrixGenerator
  }>()

  interface RecurrencePoint {
    x: number
    y: number
    i: number
    j: number
    color: string
  }

  // Replace hoverCell with more specific hover state
  let hoverPoint: {
    i: number
    j: number
    isOverPoint: boolean
    x: number
    y: number
  } | null = $state(null)

  // Add throttle state like in RunningRQAPlotColor
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 40

  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    const cellSize = plotSize / (recurrenceMatrix.length + 1)
    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const mouseX = event.clientX - rect.left - xOffset - cellSize / 2
    const mouseY = event.clientY - rect.top - yOffset + cellSize / 2

    // Only process if mouse is within plot area
    if (
      mouseX >= 0 &&
      mouseX <= plotSize &&
      mouseY >= 0 &&
      mouseY <= plotSize
    ) {
      const j = Math.floor(mouseX / cellSize)
      const i = Math.floor((plotSize - mouseY) / cellSize)

      if (
        i >= 0 &&
        i < recurrenceMatrix.length &&
        j >= 0 &&
        j < recurrenceMatrix.length
      ) {
        // Check if there's a recurrence point at this position
        const isOverPoint = recurrenceMatrix[i][j] === 1
        hoverPoint = {
          i,
          j,
          isOverPoint,
          x: event.clientX, // Store the actual mouse position
          y: event.clientY,
        }
      } else {
        hoverPoint = null
      }
    } else {
      hoverPoint = null
    }
  }

  function handleMouseLeave() {
    hoverPoint = null
  }

  // Reactive recurrence matrix
  let recurrenceMatrix: number[][] = $state(matrixGenerator(fixations))

  // Update recurrence matrix whenever fixations change
  $effect(() => {
    recurrenceMatrix = matrixGenerator(fixations)
  })

  // Compute the actual plot size based on available space
  const plotSize = $derived.by(() => {
    const { legendHeight } = calculateLegendHeight(width, aoiColors)
    const availableWidth = width - 2 * MARGIN
    const availableHeight = height - X_AXIS_HEIGHT - legendHeight
    return Math.min(availableWidth, availableHeight)
  })

  // Compute the centering offsets using plotSize value directly
  const xOffset = $derived.by(
    () => MARGIN + (width - 2 * MARGIN - plotSize) / 2
  )
  const yOffset = $derived.by(() => {
    const { legendHeight } = calculateLegendHeight(width, aoiColors)
    return (height - X_AXIS_HEIGHT - legendHeight - plotSize) / 2 + 2
  })

  // Update points calculation to use plotSize value directly
  const points = $derived.by(() => {
    const n = recurrenceMatrix.length
    if (n === 0) return []

    const cellSize = plotSize / (n + 1)
    return recurrenceMatrix
      .flatMap((row: number[], i: number) =>
        row.map((value: number, j: number) => {
          if (value !== 1) return null

          const currentAoi = fixations[i]?.aoi
          const colorMapping = currentAoi
            ? aoiColors.find(
                (ac: { aoi: string; color: string }) => ac.aoi === currentAoi[0]
              )
            : null
          const pointColor = colorMapping?.color ?? '#000000'

          return {
            x: xOffset + (j + 1) * cellSize,
            y: yOffset + plotSize - (i + 1) * cellSize,
            i,
            j,
            color: pointColor,
          }
        })
      )
      .filter(
        (point: RecurrencePoint | null): point is RecurrencePoint =>
          point !== null
      )
  })

  // Add new computed state for axis labels
  const axisLabels = $derived.by(() => {
    const n = recurrenceMatrix.length
    if (n === 0) return []
    // Start from 1 * labelStep to skip zero (will be added separately)
    return Array.from(
      { length: Math.floor(n / labelStep) },
      (_, i) => (i + 1) * labelStep
    ).filter(val => val <= n)
  })

  let plotContainer: HTMLDivElement | null = $state(null)
</script>

<div class="plot-container" bind:this={plotContainer}>
  <svg
    {width}
    {height}
    style="background: transparent;"
    viewBox="0 0 {width} {height}"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="Recurrence Plot"
  >
    <defs>
      {#if showGrid}
        <pattern
          id="grid"
          width={plotSize / (recurrenceMatrix.length + 1)}
          height={plotSize / (recurrenceMatrix.length + 1)}
          patternUnits="userSpaceOnUse"
          patternTransform="translate({xOffset} {yOffset})"
        >
          <path
            d={`M ${plotSize / (recurrenceMatrix.length + 1)} 0 L 0 0 0 ${plotSize / (recurrenceMatrix.length + 1)}`}
            fill="none"
            stroke={gridColor}
            stroke-width="1"
            stroke-opacity="1"
          />
        </pattern>
      {/if}
      {#if showMainGrid}
        <pattern
          id="mainGrid"
          width={(plotSize * labelStep) / (recurrenceMatrix.length + 1)}
          height={(plotSize * labelStep) / (recurrenceMatrix.length + 1)}
          patternUnits="userSpaceOnUse"
          patternTransform="translate({xOffset +
            (plotSize * labelStep) / (recurrenceMatrix.length + 1)} {yOffset})"
        >
          <path
            d={`M ${(plotSize * labelStep) / (recurrenceMatrix.length + 1)} 0 L 0 0 0 ${(plotSize * labelStep) / (recurrenceMatrix.length + 1)}`}
            fill="none"
            stroke={gridColor}
            stroke-width="2"
          />
        </pattern>
      {/if}
    </defs>

    <!-- Main plot rectangle -->
    <rect
      x={xOffset}
      y={yOffset}
      width={plotSize}
      height={plotSize}
      fill="none"
      stroke="black"
      stroke-width="1"
    />

    <!-- Y-axis label -->
    <text
      x={xOffset - LABEL_OFFSET}
      y={yOffset + plotSize / 2}
      text-anchor="middle"
      font-size="12"
      transform={`rotate(-90 ${xOffset - LABEL_OFFSET} ${yOffset + plotSize / 2}) translate(0, ${LABEL_OFFSET / 3})`}
    >
      {yLabel}
    </text>

    <!-- X-axis label -->
    <text
      x={xOffset + plotSize / 2}
      y={yOffset + plotSize + LABEL_OFFSET}
      text-anchor="middle"
      font-size="12"
    >
      {xLabel}
    </text>

    <!-- Grid layers -->
    <rect
      x={xOffset}
      y={yOffset}
      width={plotSize}
      height={plotSize}
      fill="url(#grid)"
    />
    {#if showMainGrid}
      <rect
        x={xOffset}
        y={yOffset}
        width={plotSize}
        height={plotSize}
        fill="url(#mainGrid)"
      />
    {/if}

    <!-- Highlight rectangles -->
    {#if hoverPoint}
      <!-- Vertical highlight -->
      <rect
        class="highlight-rect"
        x={xOffset +
          (hoverPoint.j + 1) * (plotSize / (recurrenceMatrix.length + 1)) -
          plotSize / (recurrenceMatrix.length + 1) / 2}
        y={yOffset}
        width={plotSize / (recurrenceMatrix.length + 1)}
        height={plotSize}
        fill="rgba(0, 0, 0, 0.1)"
        pointer-events="none"
        transition:fade
      />
      <!-- Horizontal highlight -->
      <rect
        class="highlight-rect"
        x={xOffset}
        y={yOffset +
          plotSize -
          (hoverPoint.i + 1) * (plotSize / (recurrenceMatrix.length + 1)) -
          plotSize / (recurrenceMatrix.length + 1) / 2}
        width={plotSize}
        height={plotSize / (recurrenceMatrix.length + 1)}
        fill="rgba(0, 0, 0, 0.1)"
        pointer-events="none"
        transition:fade
      />
    {/if}

    <!-- Draw recurrence points -->
    {#each points as point}
      <circle cx={point.x} cy={point.y} r={pointSize} fill={point.color} />
    {/each}

    <!-- Axis labels -->
    {#each axisLabels as label}
      <text
        x={xOffset - 6}
        y={yOffset +
          plotSize -
          label * (plotSize / (recurrenceMatrix.length + 1))}
        text-anchor="end"
        dominant-baseline="middle"
        font-size="12"
      >
        {label}
      </text>
      <text
        x={xOffset + label * (plotSize / (recurrenceMatrix.length + 1))}
        y={yOffset + plotSize + 16}
        text-anchor="middle"
        font-size="12"
      >
        {label}
      </text>
    {/each}

    <!-- Origin label -->
    <text
      x={xOffset - 6}
      y={yOffset + plotSize + 16}
      text-anchor="middle"
      font-size="12"
    >
      0
    </text>

    <!-- Legend -->
    <RecurrencePlotLegend
      {width}
      {aoiColors}
      aoiColorsOpacity={1}
      height={calculateLegendHeight(width, aoiColors).legendHeight}
      y={yOffset + plotSize + X_AXIS_HEIGHT}
    />
  </svg>

  <!-- Update tooltip to use hoverPoint -->
  {#if hoverPoint && hoverPoint.isOverPoint}
    <div style="position: fixed; top: 0; left: 0; pointer-events: none;">
      <div
        class="tooltip"
        style="
                transform: translate3d({Math.min(
          hoverPoint.x + 15,
          window.innerWidth - 120
        )}px, 
                    {Math.min(hoverPoint.y + 15, window.innerHeight - 80)}px, 
                    0
                )
            "
        transition:fade
      >
        {#if tooltipSnippet}
          {@render tooltipSnippet(
            fixations[hoverPoint.i]?.aoi ?? 'No AOI',
            `Fixation ${hoverPoint.i + 1} ↔ ${hoverPoint.j + 1}`
          )}
        {:else}
          <div class="tooltip-content">
            <strong>{fixations[hoverPoint.i]?.aoi ?? 'No AOI'}</strong><br />
            Fixation {hoverPoint.i + 1} ↔ {hoverPoint.j + 1}
          </div>
        {/if}
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
  }

  .tooltip-content {
    white-space: normal;
    word-wrap: break-word;
    font-size: 10px;
  }

  .highlight-rect {
    transition: all 0.1s ease-out;
  }
</style>
