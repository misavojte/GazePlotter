/**
 * The two cached pipeline stages the engine runs (`plotRender.ts`): layout and
 * scene build. Both return fresh objects, so each recomputes once per input or
 * size change however often the render, hover and overlay read it (see the
 * `kit.ts` header). Apart from the engine so the contract is testable without a DOM.
 */
import type { CanvasSize } from './frame'
import type { KitChrome, PlotKit } from './kit'
import { buildScene, resolveLayout, type PlotBuild, type PlotLayout } from './plotRender'

export function usePlotStages<I, C extends KitChrome, S>(
  kit: PlotKit<I, C, S, any, any>,
  sources: { input: () => I; size: () => CanvasSize; pixelRatio: () => number }
): { readonly layout: PlotLayout<C>; readonly build: PlotBuild<S, C> } {
  const layout = $derived(resolveLayout(kit, sources.input(), sources.size()))
  const build = $derived(buildScene(kit, sources.input(), layout, sources.pixelRatio()))
  return {
    get layout() {
      return layout
    },
    get build() {
      return build
    },
  }
}
