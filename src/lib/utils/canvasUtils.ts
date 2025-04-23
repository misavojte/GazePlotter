/**
 * Canvas utility functions for handling DPI scaling, mouse position calculations,
 * and optimized rendering for high-resolution displays.
 */

import { browser } from '$app/environment'

/**
 * Tracks canvas state for DPI-aware rendering
 */
export interface CanvasState {
  canvas: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
  pixelRatio: number
  canvasRect: DOMRect | null
  renderScheduled: boolean
}

/**
 * Creates an initial canvas state object
 */
export function createCanvasState(): CanvasState {
  return {
    canvas: null,
    context: null,
    pixelRatio: browser ? window.devicePixelRatio || 1 : 1,
    canvasRect: null,
    renderScheduled: false,
  }
}

/**
 * Sets up the canvas with proper DPI scaling
 * @param state - Current canvas state
 * @param canvas - Canvas element to set up
 * @param dpiOverride - Optional DPI override (for export functionality)
 * @returns Updated canvas state
 */
export function setupCanvas(
  state: CanvasState,
  canvas: HTMLCanvasElement,
  dpiOverride: number | null = null
): CanvasState {
  if (!browser) return state

  // Use DPI override if provided, otherwise use device pixel ratio
  const pixelRatio =
    dpiOverride !== null ? dpiOverride / 96 : window.devicePixelRatio || 1

  // Get and save the context
  const context = canvas.getContext('2d')

  // Store initial canvas rect for consistent coordinate calculations
  const canvasRect = canvas.getBoundingClientRect()

  return {
    ...state,
    canvas,
    context,
    pixelRatio,
    canvasRect,
  }
}

/**
 * Resizes the canvas to match device pixel ratio for crisp rendering
 * @param state - Current canvas state
 * @param width - Desired width in CSS pixels
 * @param height - Desired height in CSS pixels
 * @returns Updated canvas state
 */
export function resizeCanvas(
  state: CanvasState,
  width: number,
  height: number
): CanvasState {
  const { canvas, pixelRatio } = state
  if (!canvas || !browser) return state

  // Set actual canvas dimensions (scaled for high DPI)
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)

  // Set display size (css pixels)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  // Update canvas rect
  const canvasRect = canvas.getBoundingClientRect()

  return {
    ...state,
    canvasRect,
  }
}

/**
 * Gets correctly scaled mouse coordinates considering DPI and canvas transformations
 * @param state - Current canvas state
 * @param event - Mouse event
 * @returns Scaled coordinates {x, y} in logical (pre-scaling) coordinates
 */
export function getScaledMousePosition(
  state: CanvasState,
  event: MouseEvent
): { x: number; y: number } {
  const { canvas, pixelRatio } = state
  if (!canvas || !browser) return { x: 0, y: 0 }

  // Always get the latest rect for accurate coordinates
  const rect = canvas.getBoundingClientRect()

  // Calculate CSS pixels (position in the displayed element)
  const cssX = event.clientX - rect.left
  const cssY = event.clientY - rect.top

  // Convert to canvas coordinates (accounting for DPI scaling)
  // 1. Convert CSS pixels to a percentage of the canvas visual size
  // 2. Apply that percentage to the actual canvas dimensions (which include DPI scaling)
  // 3. Divide by pixelRatio to get back to logical coordinates
  const x = ((cssX / rect.width) * canvas.width) / pixelRatio
  const y = ((cssY / rect.height) * canvas.height) / pixelRatio

  return { x, y }
}

/**
 * Calculates a position for displaying tooltips correctly positioned relative to canvas elements
 * @param state - Current canvas state
 * @param canvasX - Logical X position in the canvas
 * @param canvasY - Logical Y position in the canvas
 * @param offset - Optional offset {x, y} in pixels
 * @returns Absolute position {x, y} for tooltip placement
 */
export function getTooltipPosition(
  state: CanvasState,
  canvasX: number,
  canvasY: number,
  offset: { x: number; y: number } = { x: 5, y: 5 }
): { x: number; y: number } {
  const { canvas, pixelRatio } = state
  if (!canvas || !browser) return { x: 0, y: 0 }

  // Always get the latest rect for accurate positioning
  const rect = canvas.getBoundingClientRect()

  // Convert logical coordinates (pre-scaling) back to screen coordinates
  // 1. Multiply by pixelRatio to get canvas coordinates
  // 2. Convert to a percentage of the actual canvas dimensions
  // 3. Apply that percentage to the visual canvas size
  // 4. Add the canvas position and offset
  const screenX =
    rect.left + ((canvasX * pixelRatio) / canvas.width) * rect.width + offset.x
  const screenY =
    rect.top +
    ((canvasY * pixelRatio) / canvas.height) * rect.height +
    offset.y +
    window.scrollY

  return { x: screenX, y: screenY }
}

/**
 * Force a complete redraw of the canvas
 * @param state - Current canvas state
 * @param width - Width to set for the canvas
 * @param height - Height to set for the canvas
 * @param renderCallback - Function to call to re-render canvas
 */
export function forceCanvasRedraw(
  state: CanvasState,
  width: number,
  height: number,
  renderCallback: () => void
): CanvasState {
  const { canvas } = state
  if (!canvas || !browser) return state

  // Get the current DPI
  const pixelRatio = window.devicePixelRatio || 1

  // Create a new state with updated values
  const newState = {
    ...state,
    pixelRatio,
  }

  // First resize the canvas with new dimensions
  const resizedState = resizeCanvas(newState, width, height)

  // Force a complete redraw
  renderCallback()

  return resizedState
}

/**
 * Updates the DPI and canvas rect when display parameters change (e.g., moving to a different monitor)
 * @param getState - Function to get the current state (ensures we always use fresh state)
 * @param setStateFn - Function to set the updated state
 * @param dpiOverride - Optional DPI override (for export functionality)
 * @param renderCallback - Function to call to re-render canvas after update
 */
export function updateDpiAndRect(
  getState: () => CanvasState,
  setStateFn: (newState: CanvasState) => void,
  dpiOverride: number | null = null,
  renderCallback: () => void
): void {
  if (!browser) return

  const state = getState()
  const { canvas } = state
  if (!canvas || dpiOverride !== null) return

  const newPixelRatio = window.devicePixelRatio || 1

  // Only update if DPI actually changed
  if (newPixelRatio !== state.pixelRatio) {
    // Update the state with new pixel ratio
    const newState = {
      ...state,
      pixelRatio: newPixelRatio,
      canvasRect: canvas.getBoundingClientRect(),
    }

    // Set the new state
    setStateFn(newState)

    // Execute render callback to update canvas
    renderCallback()
  } else {
    // Still update the canvasRect for accurate coordinates
    setStateFn({
      ...state,
      canvasRect: canvas.getBoundingClientRect(),
    })
  }
}

/**
 * Sets up event listeners to handle monitor changes and maintain accurate rendering
 * @param getState - Function to get the current state (ensures we always use fresh state)
 * @param setStateFn - Function to set the updated state
 * @param dpiOverride - Optional DPI override (for export functionality)
 * @param renderCallback - Function to call to re-render canvas after update
 * @returns Cleanup function to remove event listeners
 */
export function setupDpiChangeListeners(
  getState: () => CanvasState,
  setStateFn: (newState: CanvasState) => void,
  dpiOverride: number | null,
  renderCallback: () => void
): () => void {
  if (!browser) return () => {}

  // Update handler that always gets fresh state
  const handleUpdate = () => {
    updateDpiAndRect(getState, setStateFn, dpiOverride, renderCallback)
  }

  // Force redraw handler for window movement
  const handleWindowMove = () => {
    const state = getState()
    if (state.canvas) {
      // Get current canvas size
      const width = parseFloat(state.canvas.style.width)
      const height = parseFloat(state.canvas.style.height)

      // Force a complete redraw with current dimensions
      const newState = forceCanvasRedraw(state, width, height, renderCallback)

      setStateFn(newState)
    }
  }

  // Add event listeners for DPI and position changes
  window.addEventListener('resize', handleUpdate)
  window.addEventListener('devicePixelRatio', handleUpdate)

  // Additional events that might indicate window movement between monitors
  window.addEventListener('move', handleWindowMove)
  window.addEventListener('focus', handleWindowMove)

  // MutationObserver to detect when the canvas might have been hidden and shown again
  let observer: MutationObserver | null = null
  const state = getState()

  if (state.canvas && state.canvas.parentElement) {
    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'style' ||
            mutation.attributeName === 'class')
        ) {
          handleWindowMove()
          break
        }
      }
    })

    // Watch for style/class changes on the canvas and parent elements
    observer.observe(state.canvas, { attributes: true })
    observer.observe(state.canvas.parentElement, { attributes: true })
  }

  // Extra event listener for when the window moves between displays
  let mediaQueryList: MediaQueryList[] = []
  if (window.matchMedia) {
    // Watch for resolution changes (DPI changes)
    const resolutionQuery = window.matchMedia('(resolution: 1dppx)')
    resolutionQuery.addEventListener('change', handleUpdate)
    mediaQueryList.push(resolutionQuery)

    // Watch for color scheme changes (which can indicate display changes)
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    colorSchemeQuery.addEventListener('change', handleWindowMove)
    mediaQueryList.push(colorSchemeQuery)
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', handleUpdate)
    window.removeEventListener('devicePixelRatio', handleUpdate)
    window.removeEventListener('move', handleWindowMove)
    window.removeEventListener('focus', handleWindowMove)

    if (observer) {
      observer.disconnect()
    }

    mediaQueryList.forEach(query => {
      if (query === mediaQueryList[0]) {
        query.removeEventListener('change', handleUpdate)
      } else {
        query.removeEventListener('change', handleWindowMove)
      }
    })
  }
}

/**
 * Creates a throttled render scheduler to optimize canvas rendering
 * @param state - Current canvas state
 * @param renderFn - Function to execute for rendering
 * @returns A function that schedules rendering with throttling
 */
export function createRenderScheduler(
  state: CanvasState,
  renderFn: () => void
): () => void {
  return () => {
    if (!state.renderScheduled && browser) {
      state.renderScheduled = true
      requestAnimationFrame(() => {
        renderFn()
        state.renderScheduled = false
      })
    }
  }
}

/**
 * Prepares canvas for DPI-aware drawing
 * @param state - Canvas state
 * @param clearCanvas - Whether to clear the canvas before drawing
 */
export function beginCanvasDrawing(
  state: CanvasState,
  clearCanvas = true
): void {
  const { canvas, context, pixelRatio } = state
  if (!canvas || !context || !browser) return

  if (clearCanvas) {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Scale all drawing operations by the device pixel ratio
  context.save()
  context.scale(pixelRatio, pixelRatio)
}

/**
 * Completes canvas drawing operations
 * @param state - Canvas state
 */
export function finishCanvasDrawing(state: CanvasState): void {
  const { context } = state
  if (!context || !browser) return

  context.restore()
}
