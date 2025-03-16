<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import { tweened } from 'svelte/motion'
  import type { ScarfGridType } from '$lib/type/gridType'

  // Data for the matrix visualization
  export let data: {
    aoiNames: string[]
    matrix: number[][]
    maxValue: number
    aoiColors?: string[] // Added colors for AOIs
  }
  // Direct size props from parent
  export let width = 0
  export let height = 0
  export let animating = false

  // Animation spring configuration
  const ANIMATION_DURATION = 250

  // Tweened values for smooth transitions
  const animatedWidth = tweened(width, {
    duration: ANIMATION_DURATION,
    easing: cubicOut,
  })

  const animatedHeight = tweened(height, {
    duration: ANIMATION_DURATION,
    easing: cubicOut,
  })

  // Update animated values when props change
  $: {
    animatedWidth.set(width)
    animatedHeight.set(height)
  }

  // Use animated or direct values based on state
  $: displayWidth = animating ? $animatedWidth : width
  $: displayHeight = animating ? $animatedHeight : height

  // Calculated dimensions
  $: matrixSize = data.aoiNames.length || 1
  $: cellSize = calculateCellSize(displayWidth, displayHeight, matrixSize)
  $: fontSize = Math.max(9, Math.min(12, cellSize / 6))
  $: cornerSize = Math.min(cellSize, Math.max(40, displayWidth / 10))
  $: legendHeight = 40
  $: matrixCellArea = cellSize * matrixSize
  $: svgHeight = cornerSize + matrixCellArea + legendHeight
  $: svgWidth = cornerSize + matrixCellArea

  // Calculate optimal cell size based on container dimensions and AOI count
  function calculateCellSize(
    containerWidth: number,
    containerHeight: number,
    count: number
  ): number {
    if (containerWidth <= 0 || containerHeight <= 0 || count <= 0) return 40

    // Reserve space for legends and headers
    const availableWidth = containerWidth - cornerSize
    const availableHeight = containerHeight - cornerSize - legendHeight

    // Calculate cell size based on available space
    const widthBasedSize = availableWidth / count
    const heightBasedSize = availableHeight / count

    // Use the smaller dimension to ensure it fits
    return Math.max(
      25,
      Math.min(60, Math.floor(Math.min(widthBasedSize, heightBasedSize)))
    )
  }

  // Get color for transition intensity
  function getColorIntensity(value: number): string {
    if (data.maxValue === 0) return 'rgb(248, 248, 248)'
    const intensity = Math.min(value / data.maxValue, 1)
    return `rgba(67, 133, 215, ${intensity * 0.85 + 0.15})`
  }

  // Get AOI color (with fallback)
  function getAoiColor(index: number): string {
    if (data.aoiColors?.[index]) return data.aoiColors[index]

    // Default color palette
    const colors = [
      '#4285F4',
      '#EA4335',
      '#FBBC05',
      '#34A853',
      '#8F00FF',
      '#FF6D01',
      '#00A3E0',
      '#009688',
      '#795548',
      '#607D8B',
    ]
    return colors[index % colors.length]
  }

  // Truncate long names
  function truncateName(name: string): string {
    const maxLength = Math.max(4, Math.min(10, Math.floor(cellSize / 8)))
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 2) + '..'
  }
</script>

<div class="transition-matrix-container">
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {svgWidth} {svgHeight}"
    preserveAspectRatio="xMidYMid meet"
    class:animating
  >
    <!-- Empty corner cell -->
    <rect
      x="0"
      y="0"
      width={cornerSize}
      height={cornerSize}
      fill="#f8f8f8"
      stroke="#eaeaea"
      stroke-width="1"
    />

    <!-- Column headers -->
    {#each data.aoiNames as aoiName, colIndex}
      <g class="matrix-header">
        <rect
          x={cornerSize + colIndex * cellSize}
          y="0"
          width={cellSize}
          height={cornerSize}
          fill="#f8f8f8"
          stroke="#eaeaea"
          stroke-width="1"
        />
        <circle
          cx={cornerSize + colIndex * cellSize + cellSize / 2}
          cy={cornerSize / 3}
          r={fontSize * 0.6}
          fill={getAoiColor(colIndex)}
        />
        <text
          x={cornerSize + colIndex * cellSize + cellSize / 2}
          y={cornerSize * 0.7}
          text-anchor="middle"
          font-size={fontSize}
          fill="#333"
        >
          {truncateName(aoiName)}
        </text>
        <title>{aoiName}</title>
      </g>
    {/each}

    <!-- Row headers and matrix cells -->
    {#each data.aoiNames as fromAoi, rowIndex}
      <!-- Row header -->
      <g class="matrix-header">
        <rect
          x="0"
          y={cornerSize + rowIndex * cellSize}
          width={cornerSize}
          height={cellSize}
          fill="#f8f8f8"
          stroke="#eaeaea"
          stroke-width="1"
        />
        <circle
          cx={cornerSize / 3}
          cy={cornerSize + rowIndex * cellSize + cellSize / 2}
          r={fontSize * 0.6}
          fill={getAoiColor(rowIndex)}
        />
        <text
          x={cornerSize * 0.7}
          y={cornerSize + rowIndex * cellSize + cellSize / 2 + fontSize / 3}
          text-anchor="middle"
          font-size={fontSize}
          fill="#333"
        >
          {truncateName(fromAoi)}
        </text>
        <title>{fromAoi}</title>
      </g>

      <!-- Matrix cells -->
      {#each data.matrix[rowIndex] || [] as cellValue, colIndex}
        <g class="matrix-cell-group">
          <rect
            x={cornerSize + colIndex * cellSize}
            y={cornerSize + rowIndex * cellSize}
            width={cellSize}
            height={cellSize}
            fill={getColorIntensity(cellValue)}
            stroke="#eaeaea"
            stroke-width="1"
            class="matrix-cell"
          />
          {#if cellValue > 0}
            <text
              x={cornerSize + colIndex * cellSize + cellSize / 2}
              y={cornerSize + rowIndex * cellSize + cellSize / 2 + fontSize / 3}
              text-anchor="middle"
              font-size={fontSize}
              fill={cellValue / data.maxValue > 0.7 ? '#fff' : '#333'}
            >
              {cellValue}
            </text>
          {/if}
          <title
            >{fromAoi} → {data.aoiNames[colIndex]}: {cellValue} transitions</title
          >
        </g>
      {/each}
    {/each}

    <!-- Combined legend section -->
    <g
      class="legend"
      transform="translate(0, {cornerSize + matrixSize * cellSize + 10})"
    >
      <!-- Transition scale legend -->
      <text x="10" y="15" font-size={fontSize} fill="#333">Transitions:</text>
      <rect x="90" y="10" width="100" height="10" fill="url(#scaleGradient)" />
      <text x="85" y="15" text-anchor="end" font-size={fontSize} fill="#333"
        >0</text
      >
      <text x="195" y="15" font-size={fontSize} fill="#333"
        >{data.maxValue}</text
      >

      <!-- AOI Legend (simplified to save space) -->
      <text x="10" y="35" font-size={fontSize} fill="#333">AOIs:</text>
      {#each data.aoiNames.slice(0, Math.min(4, data.aoiNames.length)) as aoiName, index}
        <g
          transform="translate({90 + index * Math.min(100, svgWidth / 5)}, 30)"
        >
          <circle cx="5" cy="0" r="5" fill={getAoiColor(index)} />
          <text x="15" y="4" font-size={fontSize} fill="#333"
            >{truncateName(aoiName)}</text
          >
          <title>{aoiName}</title>
        </g>
      {/each}
      {#if data.aoiNames.length > 4}
        <text
          x={90 + 4 * Math.min(100, svgWidth / 5)}
          y="34"
          font-size={fontSize}
          fill="#333">+{data.aoiNames.length - 4} more</text
        >
      {/if}
    </g>

    <!-- Gradient definition for the scale -->
    <defs>
      <linearGradient id="scaleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(67, 133, 215, 0.15)" />
        <stop offset="100%" stop-color="rgba(67, 133, 215, 1)" />
      </linearGradient>
    </defs>
  </svg>
</div>

<style>
  .transition-matrix-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  /* Animation styles */
  svg {
    will-change: viewBox;
  }

  svg.animating {
    transition: all 0.25s cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  /* Add hover effects for matrix cells */
  :global(.matrix-cell:hover) {
    filter: brightness(1.1);
    stroke: #999;
    stroke-width: 2;
  }

  /* Add hover effect for groups */
  :global(.matrix-cell-group:hover text) {
    font-weight: bold;
  }

  :global(.matrix-header:hover circle) {
    r: 1.2em;
    transition: r 0.2s ease;
  }

  :global(.matrix-header:hover text) {
    font-weight: bold;
  }
</style>
