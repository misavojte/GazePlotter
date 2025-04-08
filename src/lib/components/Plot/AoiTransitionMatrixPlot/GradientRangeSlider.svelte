<script lang="ts">
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import { fade } from 'svelte/transition'
  import { draggable } from '$lib/actions/draggable'

  let {
    width = 500,
    y = 0,
    colorScale = ['#f7fbff', '#08306b'],
    maxValue = 100,
    minValue = 0,
    currentMin = 0,
    currentMax = 100,
    step = 1,
    onMinValueChange,
    onMaxValueChange,
  } = $props<{
    width: number
    y: number
    colorScale?: string[]
    maxValue: number
    minValue: number
    currentMin: number
    currentMax: number
    step?: number
    onMinValueChange?: (value: number) => void
    onMaxValueChange?: (value: number) => void
  }>()

  // Constants for layout
  const LABEL_WIDTH = 40
  const GRADIENT_HEIGHT = 20
  const LABEL_PADDING = 5
  const HANDLE_WIDTH = 10
  const ARROW_OFFSET = 15
  const gradientWidth = width - (LABEL_WIDTH * 2 + LABEL_PADDING * 2)

  let maxDraggingLeft = $state(false)
  let maxDraggingRight = $state(false)
  let minDraggingLeft = $state(false)
  let minDraggingRight = $state(false)
  let maxRemainder = $state(0)
  let minRemainder = $state(0)

  function handleMaxDragStepX(event: CustomEvent) {
    const { stepChange } = event.detail
    const pixelToValue = (maxValue - minValue) / gradientWidth
    const rawValue = currentMax + stepChange * pixelToValue

    // Add the previous remainder to the raw value
    const valueWithRemainder = rawValue + maxRemainder

    // Calculate the new value and new remainder
    const newValue = Math.max(currentMin + step, valueWithRemainder)
    const roundedValue = Math.round(newValue / step) * step
    maxRemainder = newValue - roundedValue

    onMaxValueChange?.(roundedValue)

    // Update dragging direction
    maxDraggingLeft = stepChange < 0
    maxDraggingRight = stepChange > 0
  }

  function handleMaxDragFinishedX(event: CustomEvent) {
    maxDraggingLeft = false
    maxDraggingRight = false
    maxRemainder = 0
  }

  function handleMinDragStepX(event: CustomEvent) {
    const { stepChange } = event.detail
    const pixelToValue = (maxValue - minValue) / gradientWidth
    const rawValue = currentMin + stepChange * pixelToValue

    // Add the previous remainder to the raw value
    const valueWithRemainder = rawValue + minRemainder

    // Calculate the new value and new remainder
    const newValue = Math.min(
      currentMax - step,
      Math.max(0, valueWithRemainder)
    )
    const roundedValue = Math.round(newValue / step) * step
    minRemainder = newValue - roundedValue

    onMinValueChange?.(roundedValue)

    // Update dragging direction
    minDraggingLeft = stepChange < 0
    minDraggingRight = stepChange > 0
  }

  function handleMinDragFinishedX(event: CustomEvent) {
    minDraggingLeft = false
    minDraggingRight = false
    minRemainder = 0
  }
</script>

<svg
  {width}
  height={GRADIENT_HEIGHT + 20}
  style="position: absolute; top: {y}px"
>
  <!-- Define the gradient -->
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color={colorScale[0]} />
      <stop offset="100%" stop-color={colorScale[1]} />
    </linearGradient>
  </defs>

  <!-- Gradient rectangle -->
  <rect
    x={LABEL_WIDTH + LABEL_PADDING}
    y="0"
    width={gradientWidth}
    height={GRADIENT_HEIGHT}
    fill="url(#gradient)"
  />

  <!-- Min value handle -->
  <rect
    x={LABEL_WIDTH + LABEL_PADDING}
    y="0"
    width={HANDLE_WIDTH}
    height={GRADIENT_HEIGHT}
    fill="white"
    stroke="currentColor"
    stroke-width="1"
    cursor="ew-resize"
    use:draggable
    on:dragStepX={handleMinDragStepX}
    on:dragFinishedX={handleMinDragFinishedX}
  />

  <!-- Direction indicators for min handle -->
  {#if minDraggingLeft}
    {@const baseX = LABEL_WIDTH + LABEL_PADDING - ARROW_OFFSET}
    <g transition:fade={{ duration: 150 }}>
      {#if currentMin === 0}
        <!-- Circle -->
        <circle
          cx={baseX + 3}
          cy={GRADIENT_HEIGHT / 2}
          r="6"
          fill="transparent"
          stroke="#222"
          stroke-width="2"
        />
        <!-- Diagonal line -->
        <line
          x1={baseX - 4.24 + 3}
          y1={GRADIENT_HEIGHT / 2 - 4.24}
          x2={baseX + 4.24 + 3}
          y2={GRADIENT_HEIGHT / 2 + 4.24}
          stroke="#222"
          stroke-width="2"
        />
      {:else}
        <path
          d="M {baseX} {GRADIENT_HEIGHT / 2} l 8 -4 l 0 8 z"
          fill="transparent"
          stroke="#222"
          stroke-width="2"
        />
      {/if}
    </g>
  {/if}
  {#if minDraggingRight}
    {@const baseX = LABEL_WIDTH + LABEL_PADDING + HANDLE_WIDTH + ARROW_OFFSET}
    {#if currentMin < currentMax - step}
      <g transition:fade={{ duration: 150 }}>
        <path
          d="M {baseX} {GRADIENT_HEIGHT / 2} l -8 -4 l 0 8 z"
          fill="transparent"
          stroke="#222"
          stroke-width="2"
        />
      </g>
    {:else}
      <g transition:fade={{ duration: 150 }}>
        <!-- Circle -->
        <circle
          cx={baseX - 3}
          cy={GRADIENT_HEIGHT / 2}
          r="6"
          fill="transparent"
          stroke="#222"
          stroke-width="2"
        />
        <!-- Diagonal line -->
        <line
          x1={baseX - 4.24 - 3}
          y1={GRADIENT_HEIGHT / 2 - 4.24}
          x2={baseX + 4.24 - 3}
          y2={GRADIENT_HEIGHT / 2 + 4.24}
          stroke="#222"
          stroke-width="2"
        />
      </g>
    {/if}
  {/if}

  <!-- Direction indicators for max handle -->
  {#if maxDraggingLeft}
    {@const baseX = LABEL_WIDTH + LABEL_PADDING + gradientWidth - ARROW_OFFSET}
    <g transition:fade={{ duration: 150 }}>
      {#if currentMax === currentMin + step}
        <!-- Circle -->
        <circle
          cx={baseX + 3}
          cy={GRADIENT_HEIGHT / 2}
          r="6"
          fill="transparent"
          stroke="white"
          stroke-width="2"
        />
        <!-- Diagonal line -->
        <line
          x1={baseX - 4.24 + 3}
          y1={GRADIENT_HEIGHT / 2 - 4.24}
          x2={baseX + 4.24 + 3}
          y2={GRADIENT_HEIGHT / 2 + 4.24}
          stroke="white"
          stroke-width="2"
        />
      {:else}
        <path
          d="M {baseX} {GRADIENT_HEIGHT / 2} l 8 -4 l 0 8 z"
          fill="transparent"
          stroke="white"
          stroke-width="2"
        />
      {/if}
    </g>
  {/if}
  {#if maxDraggingRight}
    {@const baseX =
      LABEL_WIDTH + LABEL_PADDING + gradientWidth + HANDLE_WIDTH + ARROW_OFFSET}
    <g transition:fade={{ duration: 150 }}>
      <path
        d="M {baseX} {GRADIENT_HEIGHT / 2} l -8 -4 l 0 8 z"
        fill="transparent"
        stroke="#222"
        stroke-width="2"
      />
    </g>
  {/if}

  <!-- Max value handle -->
  <rect
    x={LABEL_WIDTH + LABEL_PADDING + gradientWidth}
    y="0"
    width={HANDLE_WIDTH}
    height={GRADIENT_HEIGHT}
    fill="white"
    stroke="currentColor"
    stroke-width="1"
    cursor="ew-resize"
    use:draggable
    on:dragStepX={handleMaxDragStepX}
    on:dragFinishedX={handleMaxDragFinishedX}
  />

  <!-- Labels -->
  <SvgText
    text={currentMin.toString()}
    x={LABEL_WIDTH / 2}
    y={GRADIENT_HEIGHT + 15}
    textAnchor="middle"
  />
  <SvgText
    text={currentMax.toString()}
    x={width - LABEL_WIDTH / 2}
    y={GRADIENT_HEIGHT + 15}
    textAnchor="middle"
  />
</svg>

<style>
  rect {
    user-select: none;
  }
</style>
