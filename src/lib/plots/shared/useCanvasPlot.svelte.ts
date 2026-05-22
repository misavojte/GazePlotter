import { getContext } from 'svelte'
import {
  createCanvasState,
  createRenderScheduler,
  refreshCanvasLifecycle,
  type CanvasState,
  type CanvasLifecycleActionOptions,
} from './canvasUtils'
import {
  EXPORT_SOURCE_CONTEXT,
  type ExportSourceRegistrar,
  registerCanvasExportSource,
} from '$lib/data/export'

export interface CanvasPlotMargins {
  top: number
  right: number
  bottom: number
  left: number
}

const ZERO_MARGINS: CanvasPlotMargins = { top: 0, right: 0, bottom: 0, left: 0 }

export interface UseCanvasPlotOptions {
  /** The canvas render function. Called on every scheduled redraw. */
  render: () => void
  /** Returns content width (excluding margins). */
  getWidth: () => number
  /** Returns content height (excluding margins). */
  getHeight: () => number
  /** Returns margin overrides. Defaults to zero margins. */
  getMargins?: () => CanvasPlotMargins
  /** Returns DPI override for export, or null for screen rendering. */
  getDpiOverride?: () => number | null
}

export interface CanvasPlotHandle {
  /** Reactive canvas state -- read .context and .pixelRatio in your render function. */
  readonly canvasState: CanvasState
  /** Throttled render scheduler (rAF-based). Call to request a redraw. */
  readonly scheduleRender: () => void
  /** Returns total canvas dimensions (content + margins). */
  getCanvasDimensions: () => { width: number; height: number }
  /** Complete options object for use:canvasLifecycleAction. */
  readonly actionOptions: CanvasLifecycleActionOptions
  /**
   * Applies reactive updates (DPI re-setup, resize, scheduled redraw).
   * Call inside untrack() within your tracking $effect.
   */
  refresh: () => void
  /**
   * Registers the canvas as an export source for the CanvasPreview download system.
   * Call in an $effect and return the result for cleanup.
   */
  registerExportSource: (getCanvas: () => HTMLCanvasElement | null) => (() => void) | void
}

/**
 * Composable that encapsulates all canvas plot infrastructure:
 * state management, DPI scaling, export registration, lifecycle, and rendering.
 *
 * Usage in a Figure component:
 * ```ts
 * const plot = useCanvasPlot({
 *   render: renderCanvas,
 *   getWidth: () => width,
 *   getHeight: () => height,
 *   getMargins: () => ({ top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }),
 *   getDpiOverride: () => dpiOverride,
 * })
 *
 * // In an $effect for export source registration:
 * $effect(() => plot.registerExportSource(() => canvas))
 *
 * // In your tracking $effect:
 * $effect(() => {
 *   const _ = [data, width, height, dpiOverride, ...]
 *   untrack(() => plot.refresh())
 * })
 * ```
 *
 * Template:
 * ```svelte
 * <canvas
 *   bind:this={canvas}
 *   use:canvasLifecycleAction={plot.actionOptions}
 *   onmousemove={handleMouseMove}
 *   onmouseleave={handleMouseLeave}
 * />
 * ```
 */
export function useCanvasPlot(options: UseCanvasPlotOptions): CanvasPlotHandle {
  const getMargins = options.getMargins ?? (() => ZERO_MARGINS)
  const getDpiOverride = options.getDpiOverride ?? (() => null)

  let canvasState = $state<CanvasState>(createCanvasState())

  const scheduleRender = createRenderScheduler(options.render)

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  function getCanvasDimensions() {
    const m = getMargins()
    return {
      width: options.getWidth() + m.left + m.right,
      height: options.getHeight() + m.top + m.bottom,
    }
  }

  const getState = () => canvasState
  const setState = (next: CanvasState) => { canvasState = next }

  const actionOptions: CanvasLifecycleActionOptions = $derived({
    getState,
    setState,
    getDimensions: getCanvasDimensions,
    getDpiOverride: getDpiOverride,
    render: options.render,
    scheduleRender,
    registerExportSource: (canvasElement) => registerExportSource(() => canvasElement),
  })

  function refresh() {
    refreshCanvasLifecycle({
      getState,
      setState,
      getDimensions: getCanvasDimensions,
      getDpiOverride: getDpiOverride,
      scheduleRender,
    })
  }

  function registerExportSource(
    getCanvas: () => HTMLCanvasElement | null
  ): (() => void) | void {
    return registerCanvasExportSource(exportRegistrar, getCanvas)
  }

  return {
    get canvasState() { return canvasState },
    scheduleRender,
    getCanvasDimensions,
    get actionOptions() { return actionOptions },
    refresh,
    registerExportSource,
  }
}
