import { untrack } from 'svelte'
import type { Action } from 'svelte/action'
import {
  useCanvasPlot,
  type CanvasPlotMargins,
} from './useCanvasPlot.svelte'
import {
  getScaledMousePosition,
  getTooltipPosition,
  canvasLifecycleAction,
  type CanvasState,
  type CanvasLifecycleActionOptions,
} from './canvasUtils'
import { updateTooltip } from '$lib/tooltip'

export interface PlotProjection {
  toPixels: (val: number, clamp?: boolean) => number
  toLogical: (px: number) => number
}

export interface UsePlotOptions {
  /** The canvas render function. Runs inside untrack() to prevent paint loop dependencies. */
  render: () => void
  /**
   * Getter returning the TOTAL logical canvas width in pixels — including the
   * space taken by margins. The canvas always equals this value; `margins`
   * carve the plot area out of it and never change the canvas size. This meaning
   * is identical across every plot.
   */
  width: () => number
  /** Getter returning the TOTAL logical canvas height in pixels. See `width`. */
  height: () => number
  /** Getter returning the margins that carve the plot area out of the canvas. */
  margins: () => CanvasPlotMargins
  /** Getter returning the DPI scale override for rendering exports. */
  dpiOverride?: () => number | null
  /** Optional reactive dependency getter. Redraws are scheduled whenever returned variables change. */
  deps?: () => unknown
  /** Optional callback for handling mouse moves. Runs synchronously in the event handler context. */
  onMouseMove?: (x: number | null, y: number | null, isOver: boolean) => void
}

export interface UsePlotHandle {
  /** Reactive canvas state. Read .context and .pixelRatio inside render. */
  readonly canvasState: CanvasState
  /** Throttled requestAnimationFrame render scheduler. */
  readonly scheduleRender: () => void
  /** Options for canvasLifecycleAction directive. */
  readonly actionOptions: CanvasLifecycleActionOptions
  /** Composed Svelte action that manages canvas lifecycle, resize boundaries, and event listeners. */
  readonly plotAction: Action<HTMLCanvasElement>

  // Svelte-reactive layout dimensions
  readonly plotAreaWidth: number
  readonly plotAreaHeight: number
  readonly plotLeft: number
  readonly plotRight: number
  readonly plotTop: number
  readonly plotBottom: number
  readonly safeWidth: number
  readonly safeHeight: number

  // Svelte-reactive interaction coordinates
  readonly mouseX: number | null
  readonly mouseY: number | null
  readonly isOverPlotArea: boolean
  readonly handleMouseMove: (event: MouseEvent) => void
  readonly handleMouseLeave: () => void

  /** Helper to build a linear projection mapping values to pixels (and vice versa). */
  createLinearProjection: (
    min: number,
    max: number,
    pixelStart: number,
    pixelEnd: number
  ) => PlotProjection

  /** Centralized tooltip utility. Automatically converts coordinates and updates state. */
  showTooltip: (
    id: string,
    content: Array<{ key: string; value: string }>,
    logicalX: number,
    logicalY: number,
    offset?: { x: number; y: number },
    tooltipWidth?: number,
    delay?: number
  ) => void
  /** Clears the active tooltip with optional debounce delay. */
  hideTooltip: (delay?: number) => void
}

/**
 * High-performance composable that coordinates GazePlotter canvas plots.
 * Resolves layout bounds, projects mouse coordinates, manages tooltip states,
 * and schedules rendering while preventing paint loops.
 */
export function usePlot(options: UsePlotOptions): UsePlotHandle {
  // Wrap user render in untrack to prevent paint loop dependencies
  const renderWrapper = () => {
    untrack(() => {
      options.render()
    })
  }

  // The canvas is the TOTAL size; useCanvasPlot no longer grows it. The plot
  // area is carved out of the total by the margins.
  const getWidth = () => Math.max(1, options.width())
  const getHeight = () => Math.max(1, options.height())
  const getDpiOverride = () => (options.dpiOverride ? options.dpiOverride() : null)

  const plot = useCanvasPlot({
    render: renderWrapper,
    getWidth,
    getHeight,
    getDpiOverride,
  })

  // Reactive layout boundaries (plot area carved out of the total canvas)
  const plotAreaWidth = $derived(
    Math.max(1, options.width() - options.margins().left - options.margins().right)
  )
  const plotAreaHeight = $derived(
    Math.max(1, options.height() - options.margins().top - options.margins().bottom)
  )
  const plotLeft = $derived(options.margins().left)
  const plotRight = $derived(options.width() - options.margins().right)
  const plotTop = $derived(options.margins().top)
  const plotBottom = $derived(options.height() - options.margins().bottom)
  const safeWidth = $derived(Math.max(1, options.width()))
  const safeHeight = $derived(Math.max(1, options.height()))

  // Reactive interaction state
  let mouseX = $state<number | null>(null)
  let mouseY = $state<number | null>(null)

  const isOverPlotArea = $derived(
    mouseX !== null &&
    mouseY !== null &&
    mouseX >= plotLeft &&
    mouseX <= plotRight &&
    mouseY >= plotTop &&
    mouseY <= plotBottom
  )

  function handleMouseMove(event: MouseEvent) {
    if (!plot.canvasState.canvas) return
    const pos = getScaledMousePosition(plot.canvasState, event)
    mouseX = pos.x
    mouseY = pos.y

    const isOver =
      pos.x >= plotLeft &&
      pos.x <= plotRight &&
      pos.y >= plotTop &&
      pos.y <= plotBottom

    if (options.onMouseMove) {
      options.onMouseMove(pos.x, pos.y, isOver)
    }
  }

  function handleMouseLeave() {
    mouseX = null
    mouseY = null
    if (options.onMouseMove) {
      options.onMouseMove(null, null, false)
    }
    hideTooltip(0)
  }

  // Composable projection builder
  function createLinearProjection(
    min: number,
    max: number,
    pixelStart: number,
    pixelEnd: number
  ): PlotProjection {
    const range = max - min
    const invRange = range > 0 ? 1 / range : 0
    const pixelRange = pixelEnd - pixelStart

    return {
      toPixels(val: number, clamp = true): number {
        let ratio = (val - min) * invRange
        if (clamp) {
          ratio = Math.max(0, Math.min(1, ratio))
        }
        return pixelStart + ratio * pixelRange
      },
      toLogical(px: number): number {
        const ratio = pixelRange !== 0 ? (px - pixelStart) / pixelRange : 0
        return min + ratio * range
      },
    }
  }

  // Tooltip orchestration
  function showTooltip(
    id: string,
    content: Array<{ key: string; value: string }>,
    logicalX: number,
    logicalY: number,
    offset = { x: 5, y: 5 },
    tooltipWidth?: number,
    delay?: number
  ) {
    const screenPos = getTooltipPosition(
      plot.canvasState,
      logicalX,
      logicalY,
      offset
    )

    updateTooltip(
      {
        id,
        visible: true,
        content,
        x: screenPos.x,
        y: screenPos.y,
        width: tooltipWidth,
      },
      delay
    )
  }

  function hideTooltip(delay?: number) {
    updateTooltip(null, delay)
  }

  // Reactively trigger redraws when layout properties change
  $effect(() => {
    // Establish dependencies on layout properties
    const _ = [
      options.width(),
      options.height(),
      options.margins().top,
      options.margins().right,
      options.margins().bottom,
      options.margins().left,
      options.dpiOverride ? options.dpiOverride() : null,
    ]

    untrack(() => {
      plot.refresh()
    })
  })

  // Reactively trigger redraws when plot dependencies change
  if (options.deps) {
    $effect(() => {
      options.deps!()
      untrack(() => {
        plot.scheduleRender()
      })
    })
  }

  // Composed Svelte action
  const plotAction: Action<HTMLCanvasElement> = (node) => {
    const lifecycleResult = canvasLifecycleAction(node, plot.actionOptions)

    const hasInteraction = !!options.onMouseMove
    if (hasInteraction) {
      node.addEventListener('mousemove', handleMouseMove)
      node.addEventListener('mouseleave', handleMouseLeave)
    }

    return {
      update() {
        if (lifecycleResult && lifecycleResult.update) {
          lifecycleResult.update(plot.actionOptions)
        }
      },
      destroy() {
        if (hasInteraction) {
          node.removeEventListener('mousemove', handleMouseMove)
          node.removeEventListener('mouseleave', handleMouseLeave)
        }
        if (lifecycleResult && lifecycleResult.destroy) {
          lifecycleResult.destroy()
        }
      },
    }
  }

  return {
    get canvasState() { return plot.canvasState },
    scheduleRender: plot.scheduleRender,
    get actionOptions() { return plot.actionOptions },
    plotAction,

    get plotAreaWidth() { return plotAreaWidth },
    get plotAreaHeight() { return plotAreaHeight },
    get plotLeft() { return plotLeft },
    get plotRight() { return plotRight },
    get plotTop() { return plotTop },
    get plotBottom() { return plotBottom },
    get safeWidth() { return safeWidth },
    get safeHeight() { return safeHeight },

    get mouseX() { return mouseX },
    get mouseY() { return mouseY },
    get isOverPlotArea() { return isOverPlotArea },
    handleMouseMove,
    handleMouseLeave,

    createLinearProjection,
    showTooltip,
    hideTooltip,
  }
}
