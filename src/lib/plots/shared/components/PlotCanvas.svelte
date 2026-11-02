<script lang="ts" generics="I, C extends KitChrome, S, H, St">
  import { usePlot } from '../usePlot.svelte'
  import { INERT_HOST, type KitChrome, type PlotHost, type PlotKit } from '../kit'
  import type { CanvasExportProps } from '../types'

  /** The one canvas host: runs a kit through the engine. Hosts key it on the kit. */
  interface Props extends CanvasExportProps {
    kit: PlotKit<I, C, S, H, St>
    input: I
    /** Canvas height when a DOM row below it (a play bar) takes part of `height`. */
    canvasHeight?: number
    host?: PlotHost
  }

  let {
    kit,
    input,
    width,
    height,
    margin = 0,
    canvasHeight = undefined,
    host = INERT_HOST,
  }: Props = $props()

  const size = $derived({ width, height: canvasHeight ?? height, margin })
  // svelte-ignore state_referenced_locally
  const plot = usePlot(kit, { input: () => input, size: () => size, host: () => host })
</script>

<canvas use:plot.action aria-label={plot.label} onclick={plot.onclick}></canvas>
