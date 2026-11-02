<script lang="ts" generics="I extends StimulusInput, C extends KitChrome, S, H, St">
  import PlotCanvas from './PlotCanvas.svelte'
  import PlaybackBar, { PLAY_BAR_HEIGHT } from './PlaybackBar.svelte'
  import { usePlayer } from '../playback.svelte'
  import { useMediaElements } from '../mediaElements.svelte'
  import { INERT_HOST, type KitChrome, type PlotHost, type PlotKit } from '../kit'
  import type { PlayerState, StimulusInput } from '../stimulusSpace'
  import type { CanvasExportProps } from '../types'

  /**
   * The playback shell of a plot that declares `playback` (Scanpath, Fixation
   * Heatmap): the canvas host plus everything live around it. It owns the
   * PLAYER on the clock the platform joined (`host.playback`), the decoded
   * media and the play bar, and hands the kit their state as plain values
   * (`input.player`), so the scene rebuilds on every tick while the kit stays
   * pure. Export renders through it too, with the inert host (no clock): the
   * saved moment, else the rest.
   */
  interface Props extends CanvasExportProps {
    kit: PlotKit<I, C, S, H, St>
    input: I
    host?: PlotHost
  }

  let { kit, input, width, height, margin = 0, host = INERT_HOST }: Props = $props()

  // Per field, so an equal value in a new input object re-runs no player effect.
  const dataEnd = $derived(input.dataEnd)
  // A view with nothing to play (a placeholder) joins idle: no medium, moment or speed of its own.
  const settings = $derived(dataEnd === null ? null : input.settings)
  const media = $derived(settings && input.media)
  const mediaStimulusId = $derived(settings?.stimulusId)
  const trailLength = $derived(input.trailLength)
  const playbackSpeed = $derived(settings?.playbackSpeed ?? 1)
  const savedTime = $derived(settings?.playTime ?? null)
  const timelineStart = $derived(settings?.timelineStart ?? 0)
  const timelineEnd = $derived(settings?.timelineEnd ?? 0)
  const participantId = $derived(settings?.participantId)
  const playback = $derived(host.playback)

  // A medium the browser can't decode falls back to the fixation clock, and
  // the bar says why the background is missing.
  const mediaElements = useMediaElements()
  /** Null while it decodes; reads the cache version so the canvas repaints when it is ready. */
  const mediaElement = $derived.by(() => {
    const id = mediaStimulusId
    if (!media || id === undefined) return null
    void mediaElements.version
    return mediaElements.getReadyElement(id, media)
  })
  /** The browser can't decode the medium (an unsupported video codec). */
  const mediaFailed = $derived.by(() => {
    const id = mediaStimulusId
    if (!media || id === undefined) return false
    void mediaElements.version
    return mediaElements.failed(id)
  })

  // `playTime` null shows everything: an image's idle state.
  const player = usePlayer({
    playback: () => playback,
    media: () => media,
    mediaElement: () => mediaElement,
    hasData: () => dataEnd !== null,
    dataEnd: () => dataEnd ?? 0,
    timelineStart: () => timelineStart,
    timelineEnd: () => timelineEnd,
    speed: () => playbackSpeed,
    trailLength: () => trailLength,
    savedTime: () => savedTime,
  })

  /** The trail: a length being dragged on the bar, until the committed one changes. */
  let trail = $derived(trailLength)

  const playerState = $derived<PlayerState>({
    playTime: player.playTime,
    trail,
    isPlaying: player.isPlaying,
    onClock: player.clock !== null,
    mediaElement,
    videoElement: player.videoElement,
    videoFrame: player.clock?.frame ?? 0,
  })
  const kitInput = $derived({ ...input, player: playerState })

  /** The bar gets its own row below the canvas, on screen only. */
  const hasPlayBar = $derived(dataEnd !== null && playback !== null)
  const canvasHeight = $derived(hasPlayBar ? Math.max(60, height - PLAY_BAR_HEIGHT) : height)

  // ── Play bar: hovering its rail marks that moment on the stimulus's other plots.
  let element = $state<HTMLDivElement | null>(null)

  // A one-participant plot (a scanpath panel) marks that participant with it.
  function onRailHover(t: number | null) {
    host.publish(
      t === null
        ? null
        : { times: () => [t], participants: participantId === undefined ? undefined : () => [participantId] }
    )
  }
</script>

<div class="playback-host" bind:this={element}>
  <PlotCanvas {kit} input={kitInput} {width} {height} {margin} {canvasHeight} {host} />
  {#if hasPlayBar}
    <PlaybackBar
      {playback}
      clock={player.clock}
      span={player.span}
      playTime={player.playTime}
      isPlaying={player.isPlaying}
      {trailLength}
      {media}
      videoElement={player.videoElement}
      {mediaFailed}
      host={element}
      onDraft={ms => (trail = ms ?? trailLength)}
      onHoverTime={onRailHover}
    />
  {/if}
</div>

<style>
  .playback-host {
    display: flex;
    flex-direction: column;
    width: fit-content;
    height: fit-content;
  }
</style>
