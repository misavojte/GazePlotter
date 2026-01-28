<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'

  interface Props {
    item: MenuItem
    currentValues: AoiStreamPlotGridType
    onPreview: (data: Partial<AoiStreamPlotGridType>) => void
    close: () => void
  }

  let { item, currentValues, onPreview, close }: Props = $props()

  // --- NO LOCAL STATE, NO EFFECT ---
  // We drive EVERYTHING from currentValues via callbacks.
  // This is the most reactive and simple approach (KISS).

  function updateValue(key: keyof AoiStreamPlotGridType, val: any) {
    onPreview({
      [key]: val,
      alignment: item.value as any,
    })
  }

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
        value={currentValues.binSize}
        oninput={e => updateValue('binSize', parseInt(e.currentTarget.value))}
        min="1"
      />
    </div>

    {#if item.value === 'ridgeline'}
      <div class="input-group">
        <label for="ridge-scale">Ridge Scale</label>
        <input
          id="ridge-scale"
          type="number"
          value={currentValues.ridgelineScale}
          oninput={e =>
            updateValue('ridgelineScale', parseFloat(e.currentTarget.value))}
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
            value={currentValues.timelineStart}
            oninput={e =>
              updateValue('timelineStart', parseInt(e.currentTarget.value))}
            min="0"
            placeholder="0"
          />
        </div>
        <div class="input-group">
          <label for="timeline-end">End (0 = Auto)</label>
          <input
            id="timeline-end"
            type="number"
            value={currentValues.timelineEnd}
            oninput={e =>
              updateValue('timelineEnd', parseInt(e.currentTarget.value))}
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
