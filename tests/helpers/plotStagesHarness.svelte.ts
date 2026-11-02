import { flushSync, untrack } from 'svelte'
import type { CanvasSize } from '$lib/plots/shared/frame'
import type { KitChrome, PlotKit } from '$lib/plots/shared/kit'
import { usePlotStages } from '$lib/plots/shared/plotStages.svelte'

/**
 * The engine's cached stages over writable sources. With `effect: true` an
 * effect reads the build the way the engine's repaint effect does; reads through
 * `read()` are untracked, like the rAF render.
 */
export function plotStagesHarness<I, C extends KitChrome, S, H, St>(
  kit: PlotKit<I, C, S, H, St>,
  initial: I,
  { effect = false }: { effect?: boolean } = {}
) {
  let input = $state.raw(initial)
  let size = $state.raw<CanvasSize>({ width: 400, height: 300, margin: 0 })
  let stages!: ReturnType<typeof usePlotStages<I, C, S>>
  const dispose = $effect.root(() => {
    stages = usePlotStages(kit, { input: () => input, size: () => size, pixelRatio: () => 1 })
    if (effect) {
      $effect(() => {
        void stages.build
      })
    }
  })
  flushSync()
  return {
    stages,
    read: <T>(fn: () => T) => untrack(fn),
    setInput: (next: I) => {
      input = next
      flushSync()
    },
    setSize: (next: CanvasSize) => {
      size = next
      flushSync()
    },
    dispose,
  }
}
