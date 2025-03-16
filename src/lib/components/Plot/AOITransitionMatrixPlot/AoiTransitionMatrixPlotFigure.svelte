<script lang="ts">
  import AoiTransitionMatrixLegend from './AoiTransitionMatrixLegend.svelte'
  import { getColorForValue, getContrastTextColor } from '../utils/colorUtils'
  import { tooltipStore } from '$lib/stores/tooltipStore'

  // SVG layout constants - minimal but not zero to ensure spacing
  const MARGIN = 10
  const BASE_LABEL_OFFSET = 15
  const TOP_MARGIN = 40
  const LEFT_MARGIN = 40
  const LEGEND_HEIGHT = 40
  const MAX_LABEL_LENGTH = 10 // Maximum number of characters before truncation
  const MIN_CELL_SIZE = 20 // Minimum cell size in pixels

  // Color for inactive/filtered cells
  const INACTIVE_COLOR = '#e0e0e0' // Light gray

  /**
   * Props for the AOI Transition Matrix Plot
   * @param aoiTransitionMatrix - 2D array where:
   *   - ROWS represent "FROM" AOI (displayed on Y-axis)
   *   - COLUMNS represent "TO" AOI (displayed on X-axis)
   * @param aoiLabels - Labels for the AOIs
   * @param height - Overall SVG height
   * @param width - Overall SVG width
   * @param cellSize - Size of each matrix cell
   * @param colorScale - Array with 2 colors for min and max values
   * @param xLabel - Label for X-axis (TO AOI)
   * @param yLabel - Label for Y-axis (FROM AOI)
   * @param legendTitle - Title for the color legend
   * @param customMaxValue - Optional custom maximum value for color scale
   * @param useAutoMax - Whether to use auto-calculated max value or custom max
   */
  let {
    aoiTransitionMatrix = [],
    aoiLabels = [],
    height = 500,
    width = 500,
    cellSize = 30,
    colorScale = ['#f7fbff', '#08306b'],
    xLabel = 'To AOI',
    yLabel = 'From AOI',
    legendTitle = 'Transition Count',
    customMaxValue,
    useAutoMax = true,
    onMaxValueChange = (value: number) => {},
    minThreshold = 0,
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
    customMaxValue?: number
    useAutoMax?: boolean
    minThreshold: number
    onMaxValueChange?: (value: number) => void
  }>()

  // Handler for threshold change
  function handleThresholdChange(event: number) {
    minThreshold = event
    console.log('Parent received new threshold:', event)
  }

  // Truncate long labels
  function truncateLabel(label: string): string {
    if (label.length <= MAX_LABEL_LENGTH) return label
    return label.substring(0, MAX_LABEL_LENGTH) + '...'
  }

  // Spacing calculation constants
  const PIXEL_PER_CHARACTER = 5

  // Calculate dynamic label offset based on longest label
  function calculateLabelOffset(): number {
    // If no labels, use default
    if (aoiLabels.length === 0) return BASE_LABEL_OFFSET

    // Find the length of the longest label
    const maxLabelLength = Math.min(
      MAX_LABEL_LENGTH,
      Math.max(...aoiLabels.map((label: string) => label.length))
    )

    // Base offset + extra space per character
    return BASE_LABEL_OFFSET + maxLabelLength * PIXEL_PER_CHARACTER
  }

  // Additional offsets for axis labels to prevent collisions
  const AXIS_LABEL_MARGIN = 25
  const INDIVIDUAL_LABEL_MARGIN = 10

  // Throttle mouse events
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 40

  // Dynamic offsets based on labels
  const labelOffset = $derived.by(() => calculateLabelOffset())

  // Calculate max plotable area first (similar to RecurrencePlot's plotSize)
  const maxPlotArea = $derived.by(() => {
    // Calculate space needed for labels
    const yAxisSpace = LEFT_MARGIN + labelOffset + AXIS_LABEL_MARGIN
    const xAxisSpace = TOP_MARGIN + labelOffset + AXIS_LABEL_MARGIN
    const bottomSpace = MARGIN + LEGEND_HEIGHT

    // Calculate maximum available square area
    const availableWidth = width - yAxisSpace - MARGIN
    const availableHeight = height - xAxisSpace - bottomSpace

    return Math.min(availableWidth, availableHeight)
  })

  // Calculate optimal cell size based on available space and number of AOIs
  const optimalCellSize = $derived.by(() => {
    if (aoiLabels.length === 0) return MIN_CELL_SIZE

    // Calculate the ideal cell size to fit all cells in the available area
    const idealCellSize = maxPlotArea / aoiLabels.length

    // Constrain between minimum size and user-specified cellSize
    return Math.max(MIN_CELL_SIZE, Math.min(idealCellSize, cellSize))
  })

  // Calculate actual grid size based on optimal cell size
  const actualGridWidth = $derived.by(() => optimalCellSize * aoiLabels.length)
  const actualGridHeight = $derived.by(() => optimalCellSize * aoiLabels.length)

  // Center the grid within available space
  const xOffset = $derived.by(() => {
    return LEFT_MARGIN + labelOffset + (maxPlotArea - actualGridWidth) / 2
  })

  const yOffset = $derived.by(() => {
    return TOP_MARGIN + labelOffset + (maxPlotArea - actualGridHeight) / 2
  })

  function handleMouseMove(event: MouseEvent) {
    const currentTime = performance.now()
    if (currentTime - lastMouseMoveTime < FRAME_TIME) {
      return
    }
    lastMouseMoveTime = currentTime

    const svg = event.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()

    // Get mouse position relative to the SVG
    const svgMouseX = event.clientX - rect.left
    const svgMouseY = event.clientY - rect.top

    // Calculate position relative to the grid
    const mouseX = svgMouseX - xOffset
    const mouseY = svgMouseY - yOffset

    // Calculate actual grid dimensions
    const gridWidth = actualGridWidth
    const gridHeight = actualGridHeight

    // Only process if mouse is within plot area
    if (
      mouseX >= 0 &&
      mouseX <= gridWidth &&
      mouseY >= 0 &&
      mouseY <= gridHeight
    ) {
      const col = Math.floor(mouseX / optimalCellSize)
      const row = Math.floor(mouseY / optimalCellSize)

      if (
        row >= 0 &&
        row < aoiTransitionMatrix.length &&
        col >= 0 &&
        col < aoiTransitionMatrix[0].length
      ) {
        // IDEAL X COORDINATE FOR THE TOOLTIP
        // BASED ON ACTUAL GRID ROW AND COLUMN
        // WITH RESPECT TO THE DISTANCE OF THE START OF PLOT AREA FROM THE LEFT EDGE OF THE WINDOW
        // not to the event, but to the start of the plot area
        const idealX =
          rect.left + xOffset + col * optimalCellSize + optimalCellSize + 10

        // IDEAL Y COORDINATE FOR THE TOOLTIP
        // BASED ON ACTUAL GRID ROW AND COLUMN
        // WITH RESPECT TO THE DISTANCE OF THE START OF PLOT AREA FROM THE TOP EDGE OF THE WINDOW
        // ADD SCROLL OFFSET
        const scrollOffset = window.scrollY
        const idealY =
          rect.top +
          yOffset +
          row * optimalCellSize +
          optimalCellSize +
          10 +
          scrollOffset

        tooltipStore.set({
          x: idealX,
          y: idealY,
          content: [
            { key: 'From', value: aoiLabels[row] },
            { key: 'To', value: aoiLabels[col] },
            { key: 'Count', value: aoiTransitionMatrix[row][col] },
          ],
          visible: true,
          width: 150,
        })

        return
      }
    }
    tooltipStore.set(null)
  }

  function handleMouseLeave() {
    tooltipStore.set(null)
  }

  // Calculate the auto max value from the matrix
  const calculatedMaxValue = $derived.by(() => {
    const flatMatrix = aoiTransitionMatrix.flat()
    return flatMatrix.length > 0 ? Math.ceil(Math.max(...flatMatrix)) : 0
  })

  // Use either auto or custom max value based on configuration
  const effectiveMaxValue = $derived.by(() => {
    if (useAutoMax) {
      return calculatedMaxValue
    }
    return customMaxValue || calculatedMaxValue
  })

  // Calculate color based on value
  function getColor(value: number): string {
    return getColorForValue(value, effectiveMaxValue, colorScale)
  }

  // Function to check if a cell should be grayed out based on threshold
  function isBelowThreshold(value: number): boolean {
    return value < minThreshold
  }

  // Get cell color based on value and threshold
  function getCellColor(value: number): string {
    if (isBelowThreshold(value)) {
      return INACTIVE_COLOR
    }
    return getColor(value)
  }

  // Update parent when calculated max value changes
  $effect(() => {
    if (calculatedMaxValue > 0) {
      onMaxValueChange(calculatedMaxValue)
    }
  })
</script>

<div class="plot-container">
  <svg
    {width}
    {height}
    style="background: transparent;"
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="xMidYMid meet"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    role="img"
    aria-label="AOI Transition Matrix Plot"
  >
    <!-- Y-axis label (From AOI) -->
    <text
      x={xOffset - labelOffset - AXIS_LABEL_MARGIN}
      y={yOffset + actualGridHeight / 2}
      text-anchor="middle"
      font-size="12"
      transform={`rotate(-90 ${xOffset - labelOffset - AXIS_LABEL_MARGIN} ${yOffset + actualGridHeight / 2})`}
    >
      {yLabel}
    </text>

    <!-- X-axis label (To AOI) - positioned at the top -->
    <text
      x={xOffset + actualGridWidth / 2}
      y={yOffset - labelOffset - AXIS_LABEL_MARGIN}
      text-anchor="middle"
      font-size="12"
    >
      {xLabel}
    </text>

    <!-- Main border rectangle -->
    <rect
      x={xOffset}
      y={yOffset}
      width={actualGridWidth}
      height={actualGridHeight}
      fill="none"
      stroke="#666"
      stroke-width="1"
    />

    <!-- Grid and cells -->
    {#each aoiTransitionMatrix as row, rowIndex}
      {#each row as cell, colIndex}
        <rect
          x={xOffset + colIndex * optimalCellSize}
          y={yOffset + rowIndex * optimalCellSize}
          width={optimalCellSize}
          height={optimalCellSize}
          fill={getCellColor(cell)}
          stroke="#666"
          stroke-width="1"
        />

        <!-- Show cell value if above threshold -->
        {#if !isBelowThreshold(cell)}
          <text
            x={xOffset + colIndex * optimalCellSize + optimalCellSize / 2}
            y={yOffset + rowIndex * optimalCellSize + optimalCellSize / 2}
            text-anchor="middle"
            dominant-baseline="central"
            font-size="10"
            fill={getContrastTextColor(getCellColor(cell))}
          >
            {#if legendTitle === 'Transition Probability'}
              {cell.toFixed(2)}
            {:else}
              {cell.toFixed(0)}
            {/if}
          </text>
        {/if}
      {/each}
    {/each}

    <!-- Y-axis labels (From AOI) -->
    {#each aoiLabels as label, index}
      <text
        x={xOffset - INDIVIDUAL_LABEL_MARGIN}
        y={yOffset + index * optimalCellSize + optimalCellSize / 2}
        text-anchor="end"
        dominant-baseline="middle"
        font-size="12"
      >
        {truncateLabel(label)}
      </text>
    {/each}

    <!-- X-axis labels (To AOI) - positioned at top and rotated 90 degrees -->
    {#each aoiLabels as label, index}
      <text
        x={xOffset + index * optimalCellSize + optimalCellSize / 2}
        y={yOffset - INDIVIDUAL_LABEL_MARGIN}
        text-anchor="start"
        dominant-baseline="central"
        font-size="12"
        transform={`rotate(-90 ${xOffset + index * optimalCellSize + optimalCellSize / 2} ${yOffset - INDIVIDUAL_LABEL_MARGIN})`}
      >
        {truncateLabel(label)}
      </text>
    {/each}

    <!-- Legend - aligned with grid -->
    <AoiTransitionMatrixLegend
      width={actualGridWidth}
      height={LEGEND_HEIGHT}
      y={yOffset + actualGridHeight + 10}
      x={xOffset}
      {colorScale}
      maxValue={effectiveMaxValue}
      title={legendTitle}
      onThresholdChange={handleThresholdChange}
    />
  </svg>
</div>

<style>
  .plot-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .tooltip {
    pointer-events: none;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    max-width: 200px;
  }

  .tooltip-content {
    white-space: normal;
    word-wrap: break-word;
    font-size: 10px;
  }
</style>
