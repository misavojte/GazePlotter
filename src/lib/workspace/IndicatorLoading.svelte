<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import IndicatorCard from './IndicatorCard.svelte'

  const { ingest } = getGazePlotterSession()
</script>

<IndicatorCard title="Processing data">
  <div class="content-inner">
    <div class="spinner"></div>
    <div class="text-content">
      <p>Please wait while we prepare your visualisations.</p>
      <p>Processing data: {ingest.progressPercent}%</p>
    </div>
  </div>
</IndicatorCard>

<style>
  .content-inner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
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

  p {
    margin: 0;
    color: var(--c-text);
    line-height: 1.5;
    font-size: 14px;
  }
</style>
