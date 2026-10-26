<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import IndicatorCard from './IndicatorCard.svelte'

  const { ingest } = getGazePlotterSession()

  // One indicator for the whole load: a spinning arc while nothing is
  // measurable yet (startup, hydration), then a ring that fills with progress.
  const RADIUS = 17
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const percent = $derived(ingest.progressPercent)
  const indeterminate = $derived(percent <= 0)
  const dashOffset = $derived(CIRCUMFERENCE * (1 - percent / 100))
</script>

<IndicatorCard title="Processing data">
  <div class="content-inner">
    <div
      class="ring"
      class:indeterminate
      role="progressbar"
      aria-label="Processing data"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={indeterminate ? undefined : percent}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle class="track" cx="20" cy="20" r={RADIUS} />
        <circle
          class="arc"
          cx="20"
          cy="20"
          r={RADIUS}
          stroke-dasharray={indeterminate
            ? `${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE}`
            : CIRCUMFERENCE}
          stroke-dashoffset={indeterminate ? 0 : dashOffset}
        />
      </svg>
      {#if !indeterminate}
        <span class="percent" aria-hidden="true">{percent}%</span>
      {/if}
    </div>
    <div class="text-content">
      <p>Please wait while we prepare your visualizations.</p>
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
    width: 100%;
    height: 100%;
    /* The arc starts at 12 o'clock. */
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
    transition: stroke-dashoffset var(--transition-normal) ease;
  }

  .indeterminate svg {
    animation: spin 1s linear infinite;
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
    .indeterminate svg {
      animation-duration: 3s;
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
  }

  p {
    margin: 0;
    color: var(--c-black);
    line-height: var(--leading-relaxed);
    font-size: var(--text-lg);
  }
</style>
