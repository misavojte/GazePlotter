<script lang="ts">
  import { interpolateColor, createColorGradient } from '../utils/colorUtils'
  import { tick } from 'svelte'

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

  let minThreshold = $state(0)

  // Constants for legend based on the width - adaptive constants based on available space
  const LEGEND_MARGIN = $derived.by(() =>
    Math.max(5, Math.min(20, width * 0.05))
  )
  const LEGEND_HEIGHT = 15
  const LEGEND_WIDTH = $derived.by(() => width - 2 * LEGEND_MARGIN)
  const STEPS = 100 // Number of gradient steps

  // SVG Slider constants
  const HANDLE_RADIUS = 8
  const HANDLE_STROKE_WIDTH = 2
  const DRAG_AREA_HEIGHT = HANDLE_RADIUS * 3 // Area for drag interactions

  // Color for inactive/filtered items
  const INACTIVE_COLOR = '#e0e0e0' // Light gray
  const SLIDER_TRACK_COLOR = '#f0f0f0' // Very light gray for track
  const SLIDER_TRACK_ACTIVE_COLOR = '#d0d0d0' // Darker gray for active track

  // Store element references for keyboard/programmatic control
  let sliderTrackEl: SVGRectElement
  let sliderHandleEl: SVGGElement

  // Generate color gradient steps
  const gradientColors = $derived.by(() =>
    createColorGradient(colorScale[0], colorScale[1], STEPS)
  )

  // Calculate the normalized threshold position
  const thresholdPosition = $derived.by(() => {
    return maxValue > 0 ? (minThreshold / maxValue) * LEGEND_WIDTH : 0
  })

  // Get handle position in pixels
  const handleX = $derived.by(() => LEGEND_MARGIN + thresholdPosition)

  // State for interaction
  let isDragging = $state(false)
  let isHoveringHandle = $state(false)
  let isHoveringSlider = $state(false)
  let isFocused = $state(false)
  let startX = $state(0) // For touch and mouse events

  // Update threshold based on handle position
  function updateThresholdFromPosition(posX: number) {
    // Convert position to value
    const normalizedPos = Math.max(
      0,
      Math.min(posX - LEGEND_MARGIN, LEGEND_WIDTH)
    )
    const percentage = normalizedPos / LEGEND_WIDTH
    const newValue = Math.round(percentage * maxValue)

    // Only update if the value has changed
    if (newValue !== minThreshold) {
      minThreshold = newValue
      // Dispatch event to parent
      onThresholdChange(newValue)
      console.log('Legend updated threshold to:', minThreshold)
    }
  }

  // Handle mouse down on the slider handle
  function handleMouseDown(e: MouseEvent) {
    isDragging = true
    startX = e.clientX

    // Add window-level event listeners for capturing mouse up outside component
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)

    // Prevent text selection during drag
    e.preventDefault()
  }

  // Global mouse move handler - more robust for drags outside component
  function handleGlobalMouseMove(e: MouseEvent) {
    if (!isDragging) return

    if (sliderTrackEl) {
      const trackRect = sliderTrackEl.getBoundingClientRect()
      const dragX = e.clientX - trackRect.left
      updateThresholdFromPosition(dragX)
    }
  }

  // Global mouse up handler
  function handleGlobalMouseUp() {
    isDragging = false

    // Clean up global event listeners
    window.removeEventListener('mousemove', handleGlobalMouseMove)
    window.removeEventListener('mouseup', handleGlobalMouseUp)
  }

  // Handle mouse move for component-level tracking
  function handleMouseMove(e: MouseEvent) {
    // This is now just for hover effects
    // Actual dragging is handled by the global handler
  }

  // Handle mouse up to end dragging
  function handleMouseUp() {
    // Use global handler instead
  }

  // Handle click on the slider track to immediately jump to that position
  function handleTrackClick(e: MouseEvent) {
    if (isDragging) return // Don't respond to clicks while dragging

    const trackRect = (
      e.currentTarget as SVGRectElement
    ).getBoundingClientRect()
    const clickX = e.clientX - trackRect.left
    updateThresholdFromPosition(clickX)

    // Focus the handle after click
    if (sliderHandleEl) {
      sliderHandleEl.focus()
    }
  }

  // Show visual feedback when hovering over slider elements
  function handleSliderHover(isHovering: boolean) {
    isHoveringSlider = isHovering
  }

  function handleHandleHover(isHovering: boolean) {
    isHoveringHandle = isHovering
  }

  // Touch event handlers for better mobile support
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return

    isDragging = true
    startX = e.touches[0].clientX
    e.preventDefault()

    // Add window-level event listeners
    window.addEventListener('touchmove', handleGlobalTouchMove, {
      passive: false,
    })
    window.addEventListener('touchend', handleGlobalTouchEnd)
  }

  function handleGlobalTouchMove(e: TouchEvent) {
    if (!isDragging || e.touches.length !== 1) return

    if (sliderTrackEl) {
      const trackRect = sliderTrackEl.getBoundingClientRect()
      const touchX = e.touches[0].clientX - trackRect.left
      updateThresholdFromPosition(touchX)
    }

    e.preventDefault() // Prevent scrolling while dragging
  }

  function handleGlobalTouchEnd() {
    isDragging = false

    // Clean up global event listeners
    window.removeEventListener('touchmove', handleGlobalTouchMove)
    window.removeEventListener('touchend', handleGlobalTouchEnd)
  }

  // Keyboard accessibility
  function handleKeyDown(e: KeyboardEvent) {
    let change = 0

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        change = -1
        break
      case 'ArrowRight':
      case 'ArrowUp':
        change = 1
        break
      case 'Home':
        minThreshold = 0
        break
      case 'End':
        minThreshold = maxValue
        break
      case 'PageDown':
        change = -Math.max(1, Math.floor(maxValue * 0.1))
        break
      case 'PageUp':
        change = Math.max(1, Math.floor(maxValue * 0.1))
        break
      default:
        return // Don't handle other keys
    }

    if (change !== 0) {
      const newValue = Math.max(0, Math.min(maxValue, minThreshold + change))
      if (newValue !== minThreshold) {
        minThreshold = newValue
        onThresholdChange(newValue)
      }
    }

    e.preventDefault()
  }

  function handleFocus() {
    isFocused = true
  }

  function handleBlur() {
    isFocused = false
  }
</script>

<svg
  {x}
  {y}
  {width}
  {height}
  overflow="visible"
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  aria-label="Threshold slider for filtering values"
>
  <!-- Title -->
  <text
    x={width / 2}
    y={10}
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="12px"
  >
    {title}
  </text>

  <!-- Slider track background - for visual clarity -->
  <rect
    x={LEGEND_MARGIN}
    y={20}
    width={LEGEND_WIDTH}
    height={LEGEND_HEIGHT}
    rx={LEGEND_HEIGHT / 2}
    ry={LEGEND_HEIGHT / 2}
    fill={SLIDER_TRACK_COLOR}
    stroke="#ddd"
    stroke-width="1"
  />

  <!-- Active track portion (left of handle) -->
  <rect
    x={LEGEND_MARGIN}
    y={20}
    width={thresholdPosition}
    height={LEGEND_HEIGHT}
    rx={LEGEND_HEIGHT / 2}
    ry={LEGEND_HEIGHT / 2}
    fill={SLIDER_TRACK_ACTIVE_COLOR}
  />

  <!-- Color gradient with interactive bars -->
  <g>
    {#each gradientColors as color, i}
      <!-- Add a small overlap to avoid gaps -->
      <rect
        x={LEGEND_MARGIN + (i * LEGEND_WIDTH) / STEPS}
        y={20}
        width={LEGEND_WIDTH / STEPS + 0.5}
        height={LEGEND_HEIGHT}
        fill={(i * LEGEND_WIDTH) / STEPS < thresholdPosition
          ? INACTIVE_COLOR
          : color}
        mask="url(#sliderMask)"
      />
    {/each}

    <!-- Border around gradient -->
    <rect
      x={LEGEND_MARGIN}
      y={20}
      width={LEGEND_WIDTH}
      height={LEGEND_HEIGHT}
      fill="none"
      stroke={isHoveringSlider ? '#888' : '#666'}
      stroke-width="1"
      rx={LEGEND_HEIGHT / 2}
      ry={LEGEND_HEIGHT / 2}
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

  <!-- Interactive slider area - wider clickable zone -->
  <rect
    bind:this={sliderTrackEl}
    x={LEGEND_MARGIN}
    y={20 - DRAG_AREA_HEIGHT / 2}
    width={LEGEND_WIDTH}
    height={LEGEND_HEIGHT + DRAG_AREA_HEIGHT}
    fill="transparent"
    cursor="pointer"
    on:click={handleTrackClick}
    on:mouseenter={() => handleSliderHover(true)}
    on:mouseleave={() => handleSliderHover(false)}
    aria-hidden="true"
  />

  <!-- Min and max labels -->
  <text
    x={LEGEND_MARGIN}
    y={20 + LEGEND_HEIGHT + 15}
    text-anchor="middle"
    font-size="10"
  >
    0
  </text>

  <text
    x={LEGEND_MARGIN + LEGEND_WIDTH}
    y={20 + LEGEND_HEIGHT + 15}
    text-anchor="middle"
    font-size="10"
  >
    {maxValue}
  </text>

  <!-- Threshold value label -->
  {#if minThreshold > 0}
    <text
      x={handleX}
      y={20 + LEGEND_HEIGHT + 15}
      text-anchor="middle"
      font-size="10"
      fill="#ff5555"
      font-weight="bold"
    >
      {minThreshold}
    </text>
  {/if}

  <!-- Slider handle -->
  <g
    bind:this={sliderHandleEl}
    cursor="grab"
    class:grabbing={isDragging}
    class:focused={isFocused}
    on:mousedown={handleMouseDown}
    on:touchstart={handleTouchStart}
    on:mouseenter={() => handleHandleHover(true)}
    on:mouseleave={() => handleHandleHover(false)}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown={handleKeyDown}
    tabindex="0"
    role="slider"
    aria-valuemin="0"
    aria-valuemax={maxValue}
    aria-valuenow={minThreshold}
    aria-valuetext={`Threshold: ${minThreshold}`}
    aria-label="Filter threshold"
  >
    <!-- Focus ring (visible when focused via keyboard) -->
    {#if isFocused}
      <circle
        cx={handleX}
        cy={20 + LEGEND_HEIGHT / 2}
        r={HANDLE_RADIUS + 4}
        fill="none"
        stroke="#4d90fe"
        stroke-width="1.5"
        stroke-dasharray="3,1"
      />
    {/if}

    <!-- Shadow/glow effect for hover -->
    {#if isHoveringHandle || isDragging}
      <circle
        cx={handleX}
        cy={20 + LEGEND_HEIGHT / 2}
        r={HANDLE_RADIUS + 2}
        fill="rgba(255, 85, 85, 0.2)"
      />
    {/if}

    <!-- Handle circle -->
    <circle
      cx={handleX}
      cy={20 + LEGEND_HEIGHT / 2}
      r={HANDLE_RADIUS}
      stroke="#ff5555"
      stroke-width={HANDLE_STROKE_WIDTH}
      fill="white"
    />

    <!-- Decorative markings -->
    {#if minThreshold > 0}
      <line
        x1={handleX - 3}
        y1={20 + LEGEND_HEIGHT / 2 - 2}
        x2={handleX + 3}
        y2={20 + LEGEND_HEIGHT / 2 - 2}
        stroke="#ff5555"
        stroke-width="1.5"
      />
      <line
        x1={handleX - 3}
        y1={20 + LEGEND_HEIGHT / 2 + 2}
        x2={handleX + 3}
        y2={20 + LEGEND_HEIGHT / 2 + 2}
        stroke="#ff5555"
        stroke-width="1.5"
      />
    {/if}
  </g>

  <!-- Definition for the slider mask - helps with smooth rendering -->
  <defs>
    <mask id="sliderMask">
      <rect
        x={LEGEND_MARGIN}
        y={20}
        width={LEGEND_WIDTH}
        height={LEGEND_HEIGHT}
        fill="white"
        rx={LEGEND_HEIGHT / 2}
        ry={LEGEND_HEIGHT / 2}
      />
    </mask>
  </defs>
</svg>

<style>
  .grabbing {
    cursor: grabbing;
  }

  .focused {
    outline: none; /* We're using a custom focus ring */
  }
</style>
