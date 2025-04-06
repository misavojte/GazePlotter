<script lang="ts">
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { draggable } from '$lib/actions/draggable'

  let {
    width = 500,
    y = 0,
    x = 0,
    height = 40,
    colorScale = ['#f7fbff', '#08306b'],
    maxValue = 100,
    title = 'Transition Count',
    onThresholdChange,
  } = $props<{
    width: number
    y: number
    x?: number
    height: number
    colorScale?: string[]
    maxValue: number
    title?: string
    onThresholdChange?: (threshold: number) => void
  }>()

  // Ensure maxValue is always a whole number (rounded up)
  maxValue = Math.ceil(maxValue)

  let minThreshold = $state(0)

  // Constants for legend based on the width - adaptive constants based on available space
  const LEGEND_MARGIN = $derived.by(() =>
    Math.max(5, Math.min(20, width * 0.05))
  )
  const LEGEND_HEIGHT = 15
  const LEGEND_WIDTH = $derived.by(() => width - 2 * LEGEND_MARGIN)

  // SVG Slider constants
  const HANDLE_RADIUS = 8
  const HANDLE_STROKE_WIDTH = 2
  const DRAG_AREA_HEIGHT = HANDLE_RADIUS * 3 // Area for drag interactions

  // Color for inactive/filtered items
  const INACTIVE_COLOR = '#e0e0e0' // Light gray

  // Generate a unique ID for the gradient
  const gradientId = `gradient-${Math.random().toString(36).substring(2, 11)}`

  // Calculate the normalized threshold position
  const thresholdPosition = $derived.by(() => {
    return maxValue > 0 ? (minThreshold / maxValue) * LEGEND_WIDTH : 0
  })

  // Get handle position in pixels
  const handleX = $derived.by(() => LEGEND_MARGIN + thresholdPosition)

  function updateThreshold(newPosition: number) {
    // Convert position to percentage
    const percentage = newPosition / LEGEND_WIDTH

    // Convert percentage to threshold value
    const newValue = Math.max(
      0,
      Math.min(maxValue, Math.round(percentage * maxValue))
    )

    // Only update if changed (prevents unnecessary re-renders)
    if (newValue !== minThreshold) {
      minThreshold = newValue
      onThresholdChange?.(newValue)
    }
  }

  // Dragging state
  let isDragging = $state(false)

  // Handle drag step
  function handleDragStepX(event: CustomEvent) {
    const newPos = Math.max(
      0,
      Math.min(LEGEND_WIDTH, thresholdPosition + event.detail.stepChange)
    )
    updateThreshold(newPos)
  }
</script>

<svg
  {x}
  {y}
  {width}
  {height}
  overflow="visible"
  viewBox={`0 0 ${width} ${height}`}
  preserveAspectRatio="none"
  aria-label="Threshold slider for filtering values"
>
  <SvgText
    text={title}
    x={width / 2}
    y={10}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="12"
  />

  <defs>
    <linearGradient
      id={gradientId}
      x1="0"
      y1="0"
      x2="1"
      y2="0"
      gradientUnits="objectBoundingBox"
    >
      <stop offset="0%" stop-color={colorScale[0]} />
      <stop offset="100%" stop-color={colorScale[1]} />
    </linearGradient>
  </defs>

  <g>
    <!-- Full gradient background -->
    <rect
      x={LEGEND_MARGIN}
      y={20}
      width={LEGEND_WIDTH}
      height={LEGEND_HEIGHT}
      fill={`url(#${gradientId})`}
      stroke="#ddd"
      stroke-width="1"
    />

    <!-- Gray overlay covering inactive/filtered part -->
    {#if minThreshold > 0}
      <rect
        x={LEGEND_MARGIN}
        y={20}
        width={thresholdPosition}
        height={LEGEND_HEIGHT}
        fill={INACTIVE_COLOR}
        opacity="0.9"
      />
    {/if}

    <!-- Border around gradient -->
    <rect
      x={LEGEND_MARGIN}
      y={20}
      width={LEGEND_WIDTH}
      height={LEGEND_HEIGHT}
      fill="none"
      stroke="#666"
      stroke-width="1"
    />

    <!-- Threshold indicator line -->
    {#if minThreshold > 0}
      <line
        x1={handleX}
        y1={18}
        x2={handleX}
        y2={20 + LEGEND_HEIGHT + 2}
        stroke="#ff5555"
        stroke-width="2"
      />
    {/if}
  </g>

  <!-- Interactive track area -->
  <rect
    x={LEGEND_MARGIN}
    y={20 - DRAG_AREA_HEIGHT / 2}
    width={LEGEND_WIDTH}
    height={LEGEND_HEIGHT + DRAG_AREA_HEIGHT}
    fill="transparent"
    aria-hidden="true"
  />

  <SvgText
    text={'0'}
    x={LEGEND_MARGIN}
    y={20 + LEGEND_HEIGHT + 15}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="10"
  />

  <SvgText
    text={maxValue.toString()}
    x={LEGEND_MARGIN + LEGEND_WIDTH}
    y={20 + LEGEND_HEIGHT + 15}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="10"
  />

  <!-- Slider handle -->
  <!-- Handle circle -->
  <circle
    cx={handleX}
    cy={20 + LEGEND_HEIGHT / 2}
    r={HANDLE_RADIUS}
    stroke="#ff5555"
    stroke-width={HANDLE_STROKE_WIDTH}
    fill="white"
    use:draggable
    {...{
      ondragStepX: handleDragStepX,
    }}
  />
</svg>

<style>
  circle {
    cursor: pointer;
    touch-action: none; /* Prevents scrolling on touch devices while dragging */
  }
</style>
