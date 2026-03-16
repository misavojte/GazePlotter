/**
 * Canvas utility functions for handling DPI scaling, mouse position calculations,
 * and optimized rendering for high-resolution displays.
 */

const browser = typeof document !== 'undefined'
import { UI_COLORS } from '$lib/color'
import type { Action } from 'svelte/action'

/**
 * Tracks canvas state for DPI-aware rendering
 */
export interface CanvasState {
  canvas: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
  pixelRatio: number
  renderScheduled: boolean
  dpiOverride: number | null
}

interface CanvasDimensions {
  width: number
  height: number
}

/**
 * Creates an initial canvas state object
 */
export function createCanvasState(): CanvasState {
  return {
    canvas: null,
    context: null,
    pixelRatio: browser ? window.devicePixelRatio || 1 : 1,
    renderScheduled: false,
    dpiOverride: null,
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
  dpiOverride: number | null
): CanvasState {
  if (!browser) return state

  // Use DPI override if provided, otherwise use device pixel ratio
  const pixelRatio =
    dpiOverride !== null ? dpiOverride / 96 : window.devicePixelRatio || 1

  // Get and save the context
  const context = canvas.getContext('2d')

  return {
    ...state,
    canvas,
    context,
    pixelRatio,
    dpiOverride,
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

  const safePixelRatio =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1

  // Set actual canvas dimensions (scaled for high DPI)
  canvas.width = Math.round(safeWidth * safePixelRatio)
  canvas.height = Math.round(safeHeight * safePixelRatio)

  // Set display size (css pixels)
  canvas.style.width = `${safeWidth}px`
  canvas.style.height = `${safeHeight}px`

  return state
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
  const widthRatio = rect.width > 0 ? canvas.width / rect.width : 0
  const heightRatio = rect.height > 0 ? canvas.height / rect.height : 0

  const x = (cssX * widthRatio) / pixelRatio
  const y = (cssY * heightRatio) / pixelRatio

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
  const xPercent = canvas.width > 0 ? (canvasX * pixelRatio) / canvas.width : 0
  const yPercent =
    canvas.height > 0 ? (canvasY * pixelRatio) / canvas.height : 0

  const screenX = rect.left + xPercent * rect.width + offset.x
  const screenY = rect.top + yPercent * rect.height + offset.y + window.scrollY

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
  const { canvas, dpiOverride } = state
  if (!canvas || !browser) return state

  // Get the current DPI or use override
  const pixelRatio =
    dpiOverride !== null ? dpiOverride / 96 : window.devicePixelRatio || 1

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
 * Updates the DPI-dependent state when display parameters change.
 * @param getState - Function to get the current state (ensures we always use fresh state)
 * @param setStateFn - Function to set the updated state
 * @param getDpiOverride - Optional DPI override getter (for export functionality)
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
  if (!canvas) return

  // Check if dpiOverride changed
  const dpiChanged = state.dpiOverride !== dpiOverride

  // If dpiOverride is provided, use it to calculate pixelRatio
  const newPixelRatio =
    dpiOverride !== null ? dpiOverride / 96 : window.devicePixelRatio || 1

  // Update if DPI changed or dpiOverride changed
  if (newPixelRatio !== state.pixelRatio || dpiChanged) {
    // Update the state with new pixel ratio and dpiOverride
    const newState = {
      ...state,
      pixelRatio: newPixelRatio,
      dpiOverride,
    }

    // Set the new state
    setStateFn(newState)

    // Execute render callback to update canvas
    renderCallback()
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
  getDpiOverride: () => number | null,
  renderCallback: () => void
): () => void {
  if (!browser) return () => {}

  // Initially update with the current DPI override
  updateDpiAndRect(getState, setStateFn, getDpiOverride(), renderCallback)

  // Update handler that always gets fresh state
  const handleUpdate = () => {
    updateDpiAndRect(getState, setStateFn, getDpiOverride(), renderCallback)
  }

  // Force redraw handler for window movement
  const handleWindowMove = () => {
    const state = getState()
    if (state.canvas) {
      // Get current canvas size. Prefer layout-measured size to avoid NaN when
      // style width/height are temporarily empty.
      const rect = state.canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

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

    // Watch for style/class changes on the parent element.
    // Observing the canvas itself can create a feedback loop because resizing
    // updates `canvas.style.*`, which would trigger another redraw.
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

function normalizeCanvasDimensions(
  dimensions: CanvasDimensions
): CanvasDimensions {
  return {
    width: Number.isFinite(dimensions.width)
      ? Math.max(1, dimensions.width)
      : 1,
    height: Number.isFinite(dimensions.height)
      ? Math.max(1, dimensions.height)
      : 1,
  }
}

function resizeStateToDimensions(
  state: CanvasState,
  getDimensions: () => CanvasDimensions
): CanvasState {
  const { width, height } = normalizeCanvasDimensions(getDimensions())
  return resizeCanvas(state, width, height)
}

/**
 * Creates a throttled render scheduler to optimize canvas rendering
 * @param renderFn - Function to execute for rendering
 * @returns A function that schedules rendering with throttling
 */
export function createRenderScheduler(renderFn: () => void): () => void {
  let scheduled = false
  return () => {
    if (!browser) return
    if (scheduled) return

    scheduled = true
    requestAnimationFrame(() => {
      try {
        renderFn()
      } finally {
        scheduled = false
      }
    })
  }
}

export interface CanvasLifecycleOptions {
  getCanvas: () => HTMLCanvasElement | null
  getState: () => CanvasState
  setState: (newState: CanvasState) => void
  getDimensions: () => CanvasDimensions
  getDpiOverride: () => number | null
  render: () => void
}

export interface CanvasRefreshOptions {
  getState: () => CanvasState
  setState: (newState: CanvasState) => void
  getDimensions: () => CanvasDimensions
  getDpiOverride: () => number | null
  scheduleRender: () => void
}

export interface CanvasLifecycleActionOptions
  extends Omit<CanvasLifecycleOptions, 'getCanvas'>, CanvasRefreshOptions {}

/**
 * Initializes canvas state, resizes it to current layout dimensions, and attaches DPI listeners.
 * Returns a cleanup function for the listeners.
 */
export function mountCanvasLifecycle(
  options: CanvasLifecycleOptions
): () => void {
  if (!browser) return () => {}

  const canvas = options.getCanvas()
  if (!canvas) return () => {}

  let nextState = setupCanvas(
    options.getState(),
    canvas,
    options.getDpiOverride()
  )
  nextState = resizeStateToDimensions(nextState, options.getDimensions)
  options.setState(nextState)
  options.render()

  return setupDpiChangeListeners(
    options.getState,
    dpiState => {
      const resized = resizeStateToDimensions(dpiState, options.getDimensions)
      options.setState(resized)
      options.render()
    },
    options.getDpiOverride,
    options.render
  )
}

/**
 * Applies reactive canvas updates: optional DPI re-setup, resize, then scheduled redraw.
 */
export function refreshCanvasLifecycle(options: CanvasRefreshOptions): void {
  const state = options.getState()
  if (!state.canvas || !state.context) return
  const canvas = state.canvas

  let nextState = state
  const dpiOverride = options.getDpiOverride()

  if (nextState.dpiOverride !== dpiOverride) {
    nextState = setupCanvas(nextState, canvas, dpiOverride)
  }

  nextState = resizeStateToDimensions(nextState, options.getDimensions)
  options.setState(nextState)
  options.scheduleRender()
}

/**
 * Action that mounts and keeps a canvas lifecycle in sync with reactive updates.
 */
export const canvasLifecycleAction: Action<
  HTMLCanvasElement,
  CanvasLifecycleActionOptions
> = (node, initialOptions) => {
  let options = initialOptions

  const getState = () => options.getState()
  const setState = (nextState: CanvasState) => options.setState(nextState)
  const getDimensions = () => options.getDimensions()
  const getDpiOverride = () => options.getDpiOverride()
  const render = () => options.render()
  const scheduleRender = () => options.scheduleRender()

  const cleanup = mountCanvasLifecycle({
    getCanvas: () => node,
    getState,
    setState,
    getDimensions,
    getDpiOverride,
    render,
  })

  return {
    update(nextOptions) {
      options = nextOptions
      refreshCanvasLifecycle({
        getState,
        setState,
        getDimensions,
        getDpiOverride,
        scheduleRender,
      })
    },
    destroy() {
      cleanup()
    },
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

/**
 * Aligns a coordinate to the center of a pixel for crisp 1px lines.
 * For 1px strokes, drawing at integer + 0.5 ensures the stroke perfectly fills
 * the pixel rather than being blurred across two pixels.
 * Uses bitwise truncation for maximum performance in hot render loops.
 */
export function alignToPixelCenter(val: number): number {
  return (val | 0) + 0.5
}

/**
 * Draws a crisp 1px rectangle border.
 * Handles the 0.5px offset logic internally to ensure sharp lines.
 * Optimized with bitwise truncation for hot rendering paths.
 */
export function strokeCrispRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeStyle: string = UI_COLORS.GRID_PRIMARY,
  lineWidth: number = 1
): void {
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  // Using bitwise alignment on all edges for a perfectly sharp box
  ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, width | 0, height | 0)
  ctx.restore()
}
