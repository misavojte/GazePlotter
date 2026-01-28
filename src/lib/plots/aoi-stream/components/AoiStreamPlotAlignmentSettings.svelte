<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import type { PreviewSync } from '$lib/plots/shared'
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'

  interface Props {
    item: MenuItem
    syncs: {
      binSize: PreviewSync<number>
      ridgelineScale: PreviewSync<number>
      timelineStart: PreviewSync<number>
      timelineEnd: PreviewSync<number>
    }
    close: () => void
  }

  let { item, syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <div class="input-group">
      <label for="bin-size">Bin Size [ms]</label>
      <input
        id="bin-size"
        type="number"
        bind:value={syncs.binSize.value}
        min="1"
      />
    </div>

    {#if item.value === 'ridgeline'}
      <div class="input-group">
        <label for="ridge-scale">Ridge Scale</label>
        <input
          id="ridge-scale"
          type="number"
          bind:value={syncs.ridgelineScale.value}
          min="1"
          max="10"
          step="0.1"
        />
      </div>
    {/if}

    <div class="separator"></div>

    <div class="timeline-row">
      <span class="section-title">Timeline [ms]</span>
      <div class="timeline-inputs">
        <div class="input-group">
          <label for="timeline-start">Start</label>
          <input
            id="timeline-start"
            type="number"
            bind:value={syncs.timelineStart.value}
            min="0"
            placeholder="0"
          />
        </div>
        <div class="input-group">
          <label for="timeline-end">End (0 = Auto)</label>
          <input
            id="timeline-end"
            type="number"
            bind:value={syncs.timelineEnd.value}
            min="0"
            placeholder="Auto"
          />
        </div>
      </div>
    </div>
  </form>
</div>

<style>
  .settings-container {
    box-sizing: border-box;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .separator {
    height: 1px;
    background: #e5e7eb;
    margin: 6px 0;
  }
  .timeline-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .timeline-inputs {
    display: flex;
    gap: 8px;
  }
  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .section-title,
  .input-group label {
    font-size: 11px;
    font-weight: 500;
    color: #666;
    display: block;
  }
  .input-group input {
    width: 100%;
    box-sizing: border-box;
    padding: 3px 6px;
    border: 1px solid #ccc;
    border-radius: var(--rounded);
    font-size: 11px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-group input:focus {
    border-color: var(--c-brand);
  }
</style>
