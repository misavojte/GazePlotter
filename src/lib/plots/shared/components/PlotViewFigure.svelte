<script lang="ts">
  import PlotCanvas from './PlotCanvas.svelte'
  import PlaybackFigure from './PlaybackFigure.svelte'
  import { INERT_HOST, type PlotHost } from '../kit'
  import type { PlotView } from '$lib/plots/definePlot'
  import type { CanvasExportProps } from '../types'

  /**
   * Renders a plot view at a size: the screen grid and both export paths go
   * through here, so they host a view identically. On screen, `input` carries
   * the platform's overlays and `host` its services; export passes neither.
   */
  interface Props extends CanvasExportProps {
    view: PlotView
    input?: object
    host?: PlotHost
    /** The plot declares `playback`: host it in the playback shell. */
    playback?: boolean
  }

  let {
    view,
    input = undefined,
    host = INERT_HOST,
    playback = false,
    width,
    height,
    margin = 0,
  }: Props = $props()
</script>

{#key view.kit}
  {@const Shell = playback ? PlaybackFigure : PlotCanvas}
  <Shell kit={view.kit} input={input ?? view.input} {host} {width} {height} {margin} />
{/key}
