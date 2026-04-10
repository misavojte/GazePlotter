import { estimateTooltipWidth, updateTooltip } from './tooltipState.svelte'
import { TOOLTIP_DEFAULT_OFFSET } from './const'

type Position = 'top' | 'bottom' | 'left' | 'right'
type Alignment = 'start' | 'center' | 'end'

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

const calculateAlignedPosition = (
  base: number,
  size: number,
  targetSize: number,
  align: Alignment
): number => {
  const alignments = {
    start: base,
    center: base + size / 2 - targetSize / 2,
    end: base + size - targetSize,
  }
  return alignments[align]
}

const calculatePosition = (
  rect: DOMRect,
  position: Position,
  width: number,
  offset: number,
  hAlign: Alignment,
  vAlign: Alignment
): [number, number] => {
  const positions: Record<Position, [number, number]> = {
    top: [
      calculateAlignedPosition(rect.left, rect.width, width, hAlign),
      rect.top - offset,
    ],
    bottom: [
      calculateAlignedPosition(rect.left, rect.width, width, hAlign),
      rect.bottom + offset,
    ],
    left: [
      rect.left - width - offset,
      calculateAlignedPosition(rect.top, rect.height, 20, vAlign),
    ],
    right: [
      rect.right + offset,
      calculateAlignedPosition(rect.top, rect.height, 20, vAlign),
    ],
  }

  return positions[position]
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
    const [x, y] = calculatePosition(
      rect,
      state.position,
      state.width,
      state.offset,
      state.hAlign,
      state.vAlign
    )
    updateTooltip({
      id: state.id,
      visible: true,
      content: state.content,
      x,
      y,
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
