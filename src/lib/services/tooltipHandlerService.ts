import type { ScarfTooltipFillingType } from '$lib/type/Filling/ScarfTooltipFilling/ScarfTooltipFillingType'
import { tooltipScarfService } from './tooltipServices'
import { SCARF_LAYOUT } from './scarfServices'

/**
 * Create tooltip handling functionality
 * @returns An object with tooltip handling methods
 */
export function createTooltipHandler(
  window: Window | null,
  stimulusId: number
) {
  let timeout: number | null = null

  /**
   * Prepare tooltip data and activate it
   */
  function activateTooltip({
    segmentOrderId,
    participantId,
    x,
    y,
  }: {
    segmentOrderId: number
    participantId: number | string
    x: number
    y: number
  }) {
    // Prepare tooltip data
    const tooltipData: ScarfTooltipFillingType = {
      x,
      y,
      width: SCARF_LAYOUT.TOOLTIP_WIDTH,
      participantId:
        typeof participantId === 'string'
          ? parseInt(participantId)
          : participantId,
      segmentId: segmentOrderId,
      stimulusId,
    }

    // Show tooltip
    clearTimeout()
    tooltipScarfService(tooltipData)
  }

  /**
   * Schedule hiding the tooltip after a delay
   */
  function scheduleHide(callback?: () => void) {
    clearTimeout()
    if (!window) return

    timeout = window.setTimeout(() => {
      deactivateTooltip()
      callback?.()
    }, SCARF_LAYOUT.TOOLTIP_HIDE_DELAY)
  }

  /**
   * Hide the tooltip immediately
   */
  function deactivateTooltip() {
    clearTimeout()
    tooltipScarfService(null)
  }

  /**
   * Clear any active timeout
   */
  function clearTimeout() {
    if (timeout !== null) {
      window?.clearTimeout(timeout)
      timeout = null
    }
  }

  /**
   * Clean up resources
   */
  function destroy() {
    clearTimeout()
  }

  return {
    activateTooltip,
    scheduleHide,
    deactivateTooltip,
    clearTimeout,
    destroy,
  }
}
