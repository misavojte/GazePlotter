import { estimateTooltipWidth, updateTooltip } from './tooltipState.svelte'
import { TOOLTIP_DEFAULT_OFFSET } from './const'
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

/** Rough height estimate for the tooltip based on content row count. */
const estimateTooltipHeight = (
  content: Array<{ key: string; value: string }>
): number => {
  // Each row ≈ lineHeight(~14px) + padding(10px vertical total across item).
  // A single-row tooltip is ~24px; each additional row adds ~14px.
  const ROW_HEIGHT = 14
  const BASE_PADDING = 10
  return content.length * ROW_HEIGHT + BASE_PADDING
}

export const tooltipAction = (
  node: HTMLElement,
  options: TooltipActionOptions
) => {
  let isHovering = false
  const id = Math.random().toString(36).substring(2, 9)

  const getResolvedOptions = (opts: TooltipActionOptions) => {
    const content = normalizeContent(opts.content)
    return {
      id,
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
      height: estimateTooltipHeight(state.content),
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
    updateTooltip({
      id: state.id,
      visible: true,
      content: state.content,
      x: left,
      y: top,
      width: state.width,
    })
  }

  const hide = () => {
    isHovering = false
    updateTooltip(null)
  }

  const hideImmediate = () => {
    isHovering = false
    updateTooltip(null, 0)
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
