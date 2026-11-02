<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { Tween, prefersReducedMotion } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { getGazePlotterSession } from '$lib/session'
  import { formatSizeProgress } from '$lib/shared/format'
  import IndicatorCard from './IndicatorCard.svelte'
  import { responsive } from './responsive.svelte'

  const { ingest } = getGazePlotterSession()

  const RADIUS = 17
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const TITLES = {
    start: 'Starting GazePlotter',
    download: 'Downloading data',
    read: 'Reading data',
  }
  // Pre-rendered: what a first visit (and a crawler) reads.
  const STARTING = 'Loading scarf plots, scanpaths, heatmaps and AOI metrics.'

  const download = $derived(ingest.download)
  // A download and the parse after it read the same way, so the file line stays put.
  const progress = $derived(download ?? ingest.reading)
  const phase = $derived(download ? 'download' : progress ? 'read' : 'start')
  // Null until bytes flow (a workspace reports none): a spinner stands in for the ring.
  const fraction = $derived(
    progress?.total && progress.loaded > 0 ? progress.loaded / progress.total : null
  )

  const motion = (duration: number) => ({
    duration: prefersReducedMotion.current ? 0 : duration,
    easing: cubicOut,
  })

  // Ring, percent and byte count glide linearly over about one report interval
  // (a parse reports every 200 ms), trailing the truth without surging. A new
  // phase, or a ring fading in, snaps to its value instead of sweeping there.
  const glide = (snap: boolean) => ({ duration: snap || prefersReducedMotion.current ? 0 : 250 })
  const ring = new Tween(0)
  const bytes = new Tween(0)
  let lastPhase = ''
  let measured = false
  $effect(() => {
    const fresh = phase !== lastPhase
    lastPhase = phase
    if (progress) void bytes.set(progress.loaded, glide(fresh))
    if (fraction !== null) void ring.set(fraction, glide(fresh || !measured))
    measured = fraction !== null
  })

  // The "use your own files" hint is for a download worth skipping: 3 s in.
  let slow = $state(false)
  $effect(() => {
    slow = false
    if (phase !== 'download') return
    const timer = setTimeout(() => (slow = true), 3000)
    return () => clearTimeout(timer)
  })

  const sizeText = $derived.by(() => {
    if (!progress) return ''
    // Only a download can lack a size.
    if (progress.total === null) {
      return `${formatSizeProgress(bytes.current, null)} downloaded${progress.sizePending ? '' : ', total size unknown'}`
    }
    // Before the first byte the total is just the size: "4.0 MB".
    if (fraction === null) return formatSizeProgress(progress.total, null)
    return formatSizeProgress(bytes.current, progress.total)
  })
</script>

<IndicatorCard title={TITLES[phase]}>
  <div class="content-inner">
    <div
      class="ring"
      role="progressbar"
      aria-label={TITLES[phase]}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={fraction === null ? undefined : Math.floor(fraction * 100)}
      aria-valuetext={progress?.loaded ? formatSizeProgress(progress.loaded, progress.total) : undefined}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle class="track" cx="20" cy="20" r={RADIUS} />
        <circle
          class="arc fill"
          class:shown={fraction !== null}
          cx="20"
          cy="20"
          r={RADIUS}
          stroke-dasharray="{ring.current * CIRCUMFERENCE} {CIRCUMFERENCE}"
        />
      </svg>
      <!-- Crossfades with the ring, so neither jumps when the size turns up. -->
      <svg class="spinner" class:shown={fraction === null} viewBox="0 0 40 40" aria-hidden="true">
        <circle
          class="arc"
          cx="20"
          cy="20"
          r={RADIUS}
          stroke-dasharray="{CIRCUMFERENCE / 4} {CIRCUMFERENCE}"
        />
      </svg>
      {#if fraction !== null}
        <span class="percent" aria-hidden="true" transition:fade={motion(300)}>
          {Math.floor(ring.current * 100)}%
        </span>
      {/if}
    </div>
    <div class="text-content">
      {#if progress}
        <div in:fade={motion(200)}>
          {#if progress.source}
            <p>{progress.source}</p>
            <p class="note">{sizeText}</p>
          {:else}
            <p>{sizeText}</p>
          {/if}
          <!-- Always present, so screen readers announce a note when it appears. -->
          <div class="status" role="status">
            {#if download?.waiting === 'offline'}
              <p class="note" transition:slide={motion(200)}>
                You're offline. The download continues when you're back online.
              </p>
            {:else if download?.waiting === 'retrying'}
              <p class="note" transition:slide={motion(200)}>Download interrupted. Retrying…</p>
            {/if}
          </div>
          <!-- Only for a download worth skipping: slow or stuck. -->
          {#if download && (slow || download.waiting !== null)}
            <p class="note" transition:slide={motion(200)}>
              {responsive.isMobile ? 'Import' : 'Drop or import'} your own files to use them instead.
            </p>
          {/if}
        </div>
      {:else}
        <p>{STARTING}</p>
      {/if}
    </div>
  </div>
</IndicatorCard>

<style>
  .content-inner {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .ring {
    position: relative;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    /* Arcs start at 12 o'clock. */
    transform: rotate(-90deg);
  }

  circle {
    fill: none;
    stroke-width: 3;
  }

  .track {
    stroke: var(--c-lightgrey);
  }

  .arc {
    stroke: var(--c-brand);
    stroke-linecap: round;
  }

  .fill,
  .spinner {
    opacity: 0;
    transition: opacity var(--transition-slow) ease;
  }

  .shown {
    opacity: 1;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  .spinner:not(.shown) {
    animation-play-state: paused;
  }

  @keyframes spin {
    from {
      transform: rotate(-90deg);
    }
    to {
      transform: rotate(270deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }

    .fill,
    .spinner {
      transition: none;
    }
  }

  .percent {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-2xs);
    font-family: var(--font-small);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--c-black);
  }

  .text-content {
    flex: 1;
    /* A long file name or host wraps instead of widening the card. */
    overflow-wrap: anywhere;
    /* Counting digits keep their width, so the line does not jitter. */
    font-variant-numeric: tabular-nums;
  }

  p {
    margin: 0;
    color: var(--c-black);
    line-height: var(--leading-relaxed);
    font-size: var(--text-lg);
  }

  /* Margins, not a gap: a sliding note animates its own spacing too. */
  p + p,
  .status > p,
  .status + p {
    margin-top: 4px;
  }

  .note {
    color: var(--c-darkgrey);
    font-size: var(--text-sm);
  }</style>
