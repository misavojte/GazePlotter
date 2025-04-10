<script lang="ts">
  import AoiTransitionMatrixLegend from '$lib/components/Plot/AoiTransitionMatrixPlot/AoiTransitionMatrixLegend.svelte'
  import { getColorForValue, getContrastTextColor } from '$lib/utils/colorUtils'
  import { updateTooltip } from '$lib/stores/tooltipStore'
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { calculateLabelOffset } from '../utils/textUtils'

  // SVG layout constants - minimal but not zero to ensure spacing
  const MARGIN = 5
  const BASE_LABEL_OFFSET = 5
  const TOP_MARGIN = 30
  const LEFT_MARGIN = 30
  const LEGEND_HEIGHT = 40
  const MAX_LABEL_LENGTH = 10 // Maximum number of characters before truncation
  const MIN_CELL_SIZE = 20 // Minimum cell size in pixels

  // Default color for inactive/filtered cells
  const DEFAULT_INACTIVE_COLOR = '#e0e0e0' // Light gray

  /**
   * Props for the AOI Transition Matrix Plot
   * @param AoiTransitionMatrix - 2D array where:
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
   * @param belowMinColor - Color for values below minimum threshold
   * @param aboveMaxColor - Color for values above maximum threshold
   * @param showBelowMinLabels - Whether to show labels for values below minimum
   * @param showAboveMaxLabels - Whether to show labels for values above maximum
   */
  let {
    AoiTransitionMatrix = [],
    aoiLabels = [],
    height = 500,
    width = 500,
    cellSize = 30,
    colorScale = ['#f7fbff', '#08306b'],
    xLabel = 'To AOI',
    yLabel = 'From AOI',
    legendTitle = 'Transition Count',
    colorValueRange = [0, 0],
    onColorValueRangeChange = () => {},
    belowMinColor = DEFAULT_INACTIVE_COLOR,
    aboveMaxColor = DEFAULT_INACTIVE_COLOR,
    showBelowMinLabels = false,
    showAboveMaxLabels = false,
  } = $props<{
    AoiTransitionMatrix: number[][]
    aoiLabels: string[]
    height?: number
    width?: number
    cellSize?: number
    colorScale?: string[]
    xLabel?: string
    yLabel?: string
    legendTitle?: string
    colorValueRange: [number, number]
    onColorValueRangeChange?: (value: [number, number]) => void
    belowMinColor?: string
    aboveMaxColor?: string
    showBelowMinLabels?: boolean
    showAboveMaxLabels?: boolean
  }>()

  // Additional offsets for axis labels to prevent collisions
  const AXIS_LABEL_MARGIN = 20
  const INDIVIDUAL_LABEL_MARGIN = 8

  // Throttle mouse events
  let lastMouseMoveTime = $state(0)
  const FRAME_TIME = 1000 / 40

  // Dynamic offsets based on labels using the new utility
  const labelOffset = $derived.by(() => {
    return calculateLabelOffset(aoiLabels, 12, BASE_LABEL_OFFSET)
  })

  // Calculate max plotable area first (similar to RecurrencePlot's plotSize)
  const maxPlotArea = $derived.by(() => {
    // Calculate space needed for labels
    const yAxisSpace = LEFT_MARGIN + labelOffset + AXIS_LABEL_MARGIN
    const xAxisSpace = TOP_MARGIN + labelOffset + AXIS_LABEL_MARGIN
    const bottomSpace = MARGIN + LEGEND_HEIGHT

    // Calculate maximum available space - be more aggressive with space usage
    const availableWidth = width - yAxisSpace
    const availableHeight = height - xAxisSpace - bottomSpace

    return { availableWidth, availableHeight }
  })

  // Calculate optimal cell size based on available space and number of AOIs
  const optimalCellSize = $derived.by(() => {
    if (aoiLabels.length === 0) return MIN_CELL_SIZE

    // Calculate the ideal cell size to fit all cells in the available area
    // We'll use the maximum possible size that fits within both width and height
    const cellSizeByWidth = maxPlotArea.availableWidth / aoiLabels.length
    const cellSizeByHeight = maxPlotArea.availableHeight / aoiLabels.length

    // Use the smaller of the two to ensure everything fits
    // Don't restrict by user cellSize to maximize space usage
    const idealCellSize = Math.max(
      MIN_CELL_SIZE,
      Math.min(cellSizeByWidth, cellSizeByHeight)
    )

    return idealCellSize
  })

  // Calculate actual grid size based on optimal cell size
  const actualGridWidth = $derived.by(() => optimalCellSize * aoiLabels.length)
  const actualGridHeight = $derived.by(() => optimalCellSize * aoiLabels.length)

  // Center the grid within available space
  const xOffset = $derived.by(() => {
    return (
      LEFT_MARGIN +
      labelOffset +
      (maxPlotArea.availableWidth - actualGridWidth) / 2
    )
  })

  const yOffset = $derived.by(() => {
    return (
      TOP_MARGIN +
      labelOffset +
      (maxPlotArea.availableHeight - actualGridHeight) / 2
    )
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
        row < AoiTransitionMatrix.length &&
        col >= 0 &&
        col < AoiTransitionMatrix[0].length
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

        updateTooltip({
          x: idealX,
          y: idealY,
          content: [
            { key: 'From', value: aoiLabels[row] },
            { key: 'To', value: aoiLabels[col] },
            { key: 'Count', value: AoiTransitionMatrix[row][col] },
          ],
          visible: true,
          width: 150,
        })

        return
      }
    }
    updateTooltip(null)
  }

  function handleMouseLeave() {
    updateTooltip(null)
  }

  // Calculate the auto max value from the matrix
  const calculatedMaxValue = $derived.by(() => {
    const flatMatrix = AoiTransitionMatrix.flat()
    return flatMatrix.length > 0 ? Math.ceil(Math.max(...flatMatrix)) : 0
  })

  // Use either auto or custom max value based on configuration
  const effectiveMaxValue = $derived(
    colorValueRange[1] == 0 ? calculatedMaxValue : colorValueRange[1]
  )

  $effect(() => {
    console.log('effectiveMaxValue', effectiveMaxValue)
  })

  // Calculate color based on value
  function getColor(value: number): string {
    return getColorForValue(
      value,
      colorValueRange[0],
      effectiveMaxValue,
      colorScale
    )
  }

  // Check if a value is below the minimum threshold
  function isBelowMinimum(value: number): boolean {
    return value < colorValueRange[0]
  }

  // Check if a value is above the maximum threshold
  function isAboveMaximum(value: number): boolean {
    return value > effectiveMaxValue && colorValueRange[1] !== 0
  }

  // Get the appropriate color for a cell based on its value and the thresholds
  function getCellColor(value: number): string {
    if (isBelowMinimum(value)) {
      return belowMinColor
    } else if (isAboveMaximum(value)) {
      return aboveMaxColor
    }
    return getColor(value)
  }

  // Determine whether to show a label for a cell based on its value and settings
  function shouldShowLabel(value: number): boolean {
    if (isBelowMinimum(value)) {
      return showBelowMinLabels
    } else if (isAboveMaximum(value)) {
      return showAboveMaxLabels
    }
    return true // Always show labels for values within range
  }
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
    <!-- Y-axis label (From AOI) - positioned on the left side and rotated 90 degrees -->
    <SvgText
      text={yLabel}
      x={xOffset - labelOffset - AXIS_LABEL_MARGIN}
      y={yOffset + actualGridHeight / 2}
      textAnchor="middle"
      fontSize="12"
      transform={`rotate(-90 ${xOffset - labelOffset - AXIS_LABEL_MARGIN} ${yOffset + actualGridHeight / 2})`}
    />

    <!-- X-axis label (To AOI) - positioned at the top -->
    <SvgText
      text={xLabel}
      x={xOffset + actualGridWidth / 2}
      y={yOffset - labelOffset - AXIS_LABEL_MARGIN}
      textAnchor="middle"
      fontSize="12"
    />

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
    {#each AoiTransitionMatrix as row, rowIndex}
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

        <!-- Show cell value based on visibility settings -->
        {#if shouldShowLabel(cell)}
          <SvgText
            text={cell.toString()}
            x={xOffset + colIndex * optimalCellSize + optimalCellSize / 2}
            y={yOffset + rowIndex * optimalCellSize + optimalCellSize / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fill={getContrastTextColor(getCellColor(cell))}
          />
        {/if}
      {/each}
    {/each}

    <!-- Y-axis labels (From AOI) -->
    {#each aoiLabels as label, index}
      <SvgText
        text={label}
        x={xOffset - INDIVIDUAL_LABEL_MARGIN}
        y={yOffset + index * optimalCellSize + optimalCellSize / 2}
        textAnchor="end"
        dominantBaseline="middle"
        fontSize="12"
        maxLength={MAX_LABEL_LENGTH}
      />
    {/each}

    <!-- X-axis labels (To AOI) - positioned at top and rotated 90 degrees -->
    {#each aoiLabels as label, index}
      <SvgText
        maxLength={MAX_LABEL_LENGTH}
        text={label}
        x={xOffset + index * optimalCellSize + optimalCellSize / 2}
        y={yOffset - INDIVIDUAL_LABEL_MARGIN}
        textAnchor="start"
        dominantBaseline="central"
        fontSize="12"
        transform={`rotate(-90 ${xOffset + index * optimalCellSize + optimalCellSize / 2} ${yOffset - INDIVIDUAL_LABEL_MARGIN})`}
      />
    {/each}

    <!-- Legend - aligned with grid -->
    <AoiTransitionMatrixLegend
      width={actualGridWidth}
      height={LEGEND_HEIGHT}
      y={yOffset + actualGridHeight + 10}
      x={xOffset}
      minValue={colorValueRange[0]}
      maxValue={effectiveMaxValue}
      title={legendTitle}
      {colorScale}
      {onColorValueRangeChange}
    />
  </svg>
</div>

<style>
  .plot-container {
    position: relative;
    width: 100%;
    height: 100%;
  }
</style>
