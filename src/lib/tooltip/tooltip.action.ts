import {
  estimateTooltipWidth,
  useTooltip,
  type TooltipState,
} from './tooltipState.svelte'
import { TOOLTIP_DEFAULT_OFFSET, WIDTH_ESTIMATION } from './const'
import type { Action } from 'svelte/action'
import { estimateTextWidth } from '$lib/shared/utils/textUtils'
import {
  computePlacement,
  adjustForViewport,
} from '$lib/shared/placement'
import type { Position, Alignment, Dimensions } from '$lib/shared/placement'

export interface TooltipActionOptions {
  content: string | { key: string; value: string }[]
  position?: Position
  width?: number
  offset?: number
  horizontalAlign?: Alignment
  verticalAlign?: Alignment
  disabled?: boolean
}

const normalizeContent = (content: TooltipActionOptions['content']) =>
  typeof content === 'string' ? [{ key: '', value: content }] : content

/** Rough height estimate for the tooltip based on content row count AND
    line wrapping — a sentence capped at the max width wraps to several
    lines, and a top-positioned tooltip placed with a one-line estimate
    would extend down over the very element it explains. */
const estimateTooltipHeight = (
  content: Array<{ key: string; value: string }>,
  width: number
): number => {
  // Each row ≈ lineHeight(~14px) + padding(10px vertical total across item).
  const ROW_HEIGHT = 14
  const BASE_PADDING = 10
  const usable = Math.max(width - WIDTH_ESTIMATION.PADDING, 20)
  let lines = 0
  for (const item of content) {
    const textWidth = estimateTextWidth(item.value, WIDTH_ESTIMATION.FONT_SIZE)
    lines += Math.max(1, Math.ceil(textWidth / usable))
  }
  return lines * ROW_HEIGHT + BASE_PADDING
}

/** Session-bound action; resolve at init, use as `use:tooltipAction`. */
export function useTooltipAction(): Action<HTMLElement, TooltipActionOptions> {
  const tooltip = useTooltip()
  return (node, options) => tooltipAction(tooltip, node, options)
}

const tooltipAction = (
  tooltip: TooltipState,
  node: HTMLElement,
  options: TooltipActionOptions
) => {
  let isHovering = false

  const getResolvedOptions = (opts: TooltipActionOptions) => {
    const content = normalizeContent(opts.content)
    return {
      content,
      position: opts.position ?? 'top',
      width: opts.width ?? estimateTooltipWidth(content),
      offset: opts.offset ?? TOOLTIP_DEFAULT_OFFSET,
      hAlign: opts.horizontalAlign ?? 'center',
      vAlign: opts.verticalAlign ?? 'center',
      disabled: opts.disabled ?? false,
    }
  }

  let state = getResolvedOptions(options)

  const show = () => {
    if (state.disabled) return
    isHovering = true
    const rect = node.getBoundingClientRect()
    const floatingSize: Dimensions = {
      width: state.width,
      height: estimateTooltipHeight(state.content, state.width),
    }
    const preferred = computePlacement(
      rect,
      floatingSize,
      state.position,
      state.offset,
      state.hAlign,
      state.vAlign
    )
    const { left, top } = adjustForViewport(preferred, floatingSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
    tooltip.update({
      content: state.content,
      x: left,
      y: top,
      width: state.width,
    })
  }

  const hide = () => {
    isHovering = false
    tooltip.update(null)
  }

  const hideImmediate = () => {
    isHovering = false
    tooltip.update(null, 0)
  }

  const refresh = () => {
    if (isHovering) {
      state.disabled ? hide() : show()
    }
  }

  node.addEventListener('mouseenter', show)
  node.addEventListener('mouseleave', hide)
  node.addEventListener('pointerdown', hideImmediate)

  return {
    update(newOptions: TooltipActionOptions) {
      state = getResolvedOptions(newOptions)
      refresh()
    },
    destroy() {
      node.removeEventListener('mouseenter', show)
      node.removeEventListener('mouseleave', hide)
      node.removeEventListener('pointerdown', hideImmediate)
      if (isHovering) hide()
    },
  }
}
