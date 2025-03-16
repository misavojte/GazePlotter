<script lang="ts">
  // Data for the matrix visualization
  export let data: {
    aoiNames: string[]
    matrix: number[][]
    maxValue: number
    aoiColors?: string[]
  } = {
    aoiNames: [],
    matrix: [],
    maxValue: 0,
    aoiColors: [],
  }

  // Direct size props from parent
  export let width = 0
  export let height = 0

  // Check if data is empty
  $: isEmpty = !data?.aoiNames?.length || data.aoiNames.length === 0

  // Calculated dimensions based on AOI count
  $: matrixSize = isEmpty ? 1 : Math.max(1, data.aoiNames.length)
  $: aspectRatio = 1 // Square aspect ratio for the matrix

  // Set reasonable defaults for visualization
  $: cellSize = 40
  $: cornerSize = 40
  $: legendHeight = 50
  $: fontSize = 12

  // Calculate grid dimensions for viewBox
  $: svgWidth = cornerSize + cellSize * matrixSize
  $: svgHeight = cornerSize + cellSize * matrixSize + legendHeight

  // Calculate legend item width
  $: legendItemWidth = Math.min(
    100,
    (svgWidth - 100) / Math.max(1, Math.min(5, matrixSize))
  )

  // Get color for transition intensity with safety
  function getColorIntensity(value: number): string {
    if (!data || data.maxValue <= 0 || isNaN(value)) return 'rgb(248, 248, 248)'
    const intensity = Math.min(value / data.maxValue, 1)
    return `rgba(67, 133, 215, ${intensity * 0.85 + 0.15})`
  }

  // Get AOI color (with fallback)
  function getAoiColor(index: number): string {
    if (data?.aoiColors?.[index]) return data.aoiColors[index]

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
    return colors[index % colors.length] || colors[0]
  }

  // Truncate long names
  function truncateName(name: string): string {
    if (!name) return ''
    const maxLength = Math.max(4, Math.min(10, Math.floor(cellSize / 8)))
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 2) + '..'
  }

  // Safe transform helper to prevent NaN values
  function safeTranslate(x: number, y: number): string {
    return `translate(${isNaN(x) ? 0 : x}, ${isNaN(y) ? 0 : y})`
  }
</script>

<div class="transition-matrix-container">
  {#if isEmpty}
    <div class="empty-state">
      <p>No AOI data available for this configuration.</p>
      <p>Try selecting a different stimulus or group.</p>
    </div>
  {:else}
    <svg
      class="matrix-svg"
      {width}
      {height}
      viewBox="0 0 {svgWidth} {svgHeight}"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Gradient definition for scale -->
      <defs>
        <linearGradient id="scaleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(67, 133, 215, 0.15)" />
          <stop offset="100%" stop-color="rgba(67, 133, 215, 1)" />
        </linearGradient>
      </defs>

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
      {#each data?.aoiNames || [] as aoiName, colIndex}
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
      {#each data?.aoiNames || [] as fromAoi, rowIndex}
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
        {#each data?.matrix?.[rowIndex] || [] as cellValue, colIndex}
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
                y={cornerSize +
                  rowIndex * cellSize +
                  cellSize / 2 +
                  fontSize / 3}
                text-anchor="middle"
                font-size={fontSize}
                fill={cellValue / (data?.maxValue || 1) > 0.7 ? '#fff' : '#333'}
              >
                {cellValue}
              </text>
            {/if}
            <title
              >{fromAoi} → {data?.aoiNames?.[colIndex] || ''}: {cellValue} transitions</title
            >
          </g>
        {/each}
      {/each}

      <!-- Legend section -->
      <g
        class="legend"
        transform={safeTranslate(0, cornerSize + matrixSize * cellSize + 5)}
      >
        <!-- Transition scale legend -->
        <text x="10" y="15" font-size={fontSize} fill="#333">Transitions:</text>
        <rect
          x="90"
          y="10"
          width="100"
          height="10"
          fill="url(#scaleGradient)"
        />
        <text x="85" y="15" text-anchor="end" font-size={fontSize} fill="#333"
          >0</text
        >
        <text x="195" y="15" font-size={fontSize} fill="#333"
          >{data?.maxValue || 0}</text
        >

        <!-- AOI Legend (simplified) -->
        <text x="10" y="30" font-size={fontSize} fill="#333">AOIs:</text>
        {#each (data?.aoiNames || []).slice(0, Math.min(4, (data?.aoiNames || []).length)) as aoiName, index}
          <g transform={safeTranslate(90 + index * legendItemWidth, 25)}>
            <circle cx="5" cy="0" r="5" fill={getAoiColor(index)} />
            <text x="15" y="4" font-size={fontSize} fill="#333"
              >{truncateName(aoiName)}</text
            >
            <title>{aoiName}</title>
          </g>
        {/each}
        {#if (data?.aoiNames || []).length > 4}
          <text
            x={90 + 4 * legendItemWidth}
            y="4"
            font-size={fontSize}
            fill="#333"
          >
            + {(data?.aoiNames || []).length - 4} more
          </text>
        {/if}
      </g>
    </svg>
  {/if}
</div>

<style>
  .transition-matrix-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: white;
  }

  .matrix-svg {
    max-width: 100%;
    max-height: 100%;
  }

  .empty-state {
    text-align: center;
    color: #666;
    font-size: 14px;
    padding: 20px;
  }

  :global(.matrix-cell:hover) {
    stroke: #666;
    stroke-width: 2px;
  }

  :global(.matrix-header:hover rect) {
    fill: #f0f0f0;
  }
</style>
