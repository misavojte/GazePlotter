import { cubicInOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'

// Shared timing for the Rail ⇄ Pane handoff. Both surfaces run the same
// duration + easing so their slide-out and slide-in read as one
// coordinated sweep rather than two independent transitions.
export const PANE_TRANSITION = {
  duration: 320,
  easing: cubicInOut,
} as const

interface SlideFlexParams {
  delay?: number
  duration?: number
  easing?: (t: number) => number
  axis?: 'x' | 'y'
}

// Drop-in replacement for `svelte/transition#slide` that also animates
// `flex-basis` and uses `overflow: clip` instead of `overflow: hidden`.
//
// Why flex-basis: the built-in slide only animates `width` / `height`,
// which silently does nothing for flex items sized with a fixed
// `flex: 0 0 <n>px` — the fixed flex-basis wins over the inline width
// and the element never visually grows or shrinks. Rail and Pane both
// use fixed flex-basis, so we interpolate flex-basis alongside width.
//
// Why `overflow: clip`: Rail and Pane host a `position: sticky` content
// column anchored to page scroll. `overflow: hidden` (which the built-in
// slide applies) would rebind the sticky element to the animating
// container — which is not a scroll container — making it behave like
// `static` and jumping to its real sticky position only once the inline
// style lifts at the end of the animation. `overflow: clip` clips
// descendants the same way but does NOT establish a scroll container,
// so sticky keeps looking past it to the viewport and the scroll-offset
// position stays correct for every frame of the transition.
export function slideFlex(
  node: Element,
  {
    delay = 0,
    duration = 400,
    easing = cubicInOut,
    axis = 'x',
  }: SlideFlexParams = {}
): TransitionConfig {
  const style = getComputedStyle(node)
  const opacity = +style.opacity
  const primary = axis === 'y' ? 'height' : 'width'
  const primaryValue = parseFloat(style[primary as 'height' | 'width'])
  const sides = (axis === 'y' ? ['top', 'bottom'] : ['left', 'right']) as [
    'top' | 'left',
    'bottom' | 'right',
  ]
  const cap = sides.map(
    s => (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<typeof s>
  ) as [Capitalize<(typeof sides)[0]>, Capitalize<(typeof sides)[1]>]
  const read = (key: string) =>
    parseFloat(style[key as keyof CSSStyleDeclaration] as string) || 0
  const paddingStart = read(`padding${cap[0]}`)
  const paddingEnd = read(`padding${cap[1]}`)
  const marginStart = read(`margin${cap[0]}`)
  const marginEnd = read(`margin${cap[1]}`)
  const borderStart = read(`border${cap[0]}Width`)
  const borderEnd = read(`border${cap[1]}Width`)

  return {
    delay,
    duration,
    easing,
    css: t =>
      'overflow: clip;' +
      `opacity: ${Math.min(t * 20, 1) * opacity};` +
      `${primary}: ${t * primaryValue}px;` +
      `flex-basis: ${t * primaryValue}px;` +
      `padding-${sides[0]}: ${t * paddingStart}px;` +
      `padding-${sides[1]}: ${t * paddingEnd}px;` +
      `margin-${sides[0]}: ${t * marginStart}px;` +
      `margin-${sides[1]}: ${t * marginEnd}px;` +
      `border-${sides[0]}-width: ${t * borderStart}px;` +
      `border-${sides[1]}-width: ${t * borderEnd}px;`,
  }
}
