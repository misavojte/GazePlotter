<script lang="ts">
  import { setContext, tick } from 'svelte'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSource,
    type ExportSourceRegistrar,
  } from '$lib/data/export'
  import type { PlotView } from '$lib/plots/definePlot'
  import type { PlotExportProps } from './types'

  /**
   * Off-screen, single-figure render pass for the batch figure export. Mounts
   * the plot's live figure component with export sizing (the same mechanism as
   * the single-plot download preview), waits for the canvas to paint, and hands
   * the canvas back exactly once — or `null` when the figure failed to render.
   * The batch modal mounts one host per figure, sequentially, so at most one
   * high-DPI canvas is alive at a time.
   */
  interface Props {
    view: PlotView
    exportProps: PlotExportProps
    onResult: (canvas: HTMLCanvasElement | null) => void
  }

  let { view, exportProps, onResult }: Props = $props()

  // The host lives for exactly one figure (the modal remounts it per job), so
  // the view is intentionally captured once, not tracked.
  // svelte-ignore state_referenced_locally
  const Figure = view.component

  let source: ExportSource | null = null
  let settled = false

  const registrar: ExportSourceRegistrar = {
    register: next => {
      source = next
    },
  }
  setContext(EXPORT_SOURCE_CONTEXT, registrar)

  function settle(canvas: HTMLCanvasElement | null) {
    if (settled) return
    settled = true
    onResult(canvas)
  }

  // The usePlot harness paints via requestAnimationFrame; wait for the mount
  // to flush and a frame to pass before reading the canvas. A second frame
  // covers renders the first frame merely scheduled.
  $effect(() => {
    let disposed = false
    ;(async () => {
      await tick()
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      if (disposed) return
      settle(source?.kind === 'canvas' ? source.getCanvas() : null)
    })()
    return () => {
      disposed = true
    }
  })
</script>

<div class="render-host" aria-hidden="true">
  <svelte:boundary onerror={() => settle(null)}>
    <Figure
      {...view.props}
      width={exportProps.width}
      height={exportProps.height}
      dpiOverride={exportProps.dpiOverride}
      margins={exportProps.margins}
    />
  </svelte:boundary>
</div>

<style>
  /* Painted but never seen: parked off-screen rather than display:none, so
     the canvas keeps its layout box and still renders. */
  .render-host {
    position: fixed;
    top: 0;
    left: -100000px;
    pointer-events: none;
  }
</style>
