<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import IndicatorCard from './IndicatorCard.svelte'

  const { ingest } = getGazePlotterSession()
</script>

<IndicatorCard title="Processing data">
  <div class="content-inner">
    <div class="spinner"></div>
    <div class="text-content">
      <p>Please wait while we prepare your visualizations.</p>
      <p>Processing data: {ingest.progressPercent}%</p>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="Processing data"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={ingest.progressPercent}
      >
        <div class="progress-fill" style:width="{ingest.progressPercent}%"></div>
      </div>
    </div>
  </div>
</IndicatorCard>

<style>
  .content-inner {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--c-lightgrey);
    border-top-color: var(--c-brand);
    border-radius: 50%;
    animation: spin 1.2s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .text-content {
    flex: 1;
  }

  /* The export dialog's bar, so progress reads the same everywhere. */
  .progress-track {
    height: 4px;
    margin-top: 8px;
    border-radius: 2px;
    background-color: var(--c-lightgrey);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background-color: var(--c-brand);
    transition: width var(--transition-normal) ease;
  }

  p {
    margin: 0;
    color: var(--c-black);
    line-height: var(--leading-relaxed);
    font-size: var(--text-lg);
  }
</style>
