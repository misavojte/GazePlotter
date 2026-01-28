<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'

  interface Props {
    item: MenuItem
    currentValues: ScarfGridType
    onPreview: (data: Partial<ScarfGridType>) => void
    close: () => void
  }

  let { item, currentValues, onPreview, close }: Props = $props()

  // --- NO LOCAL STATE, NO EFFECT ---
  // We drive EVERYTHING from currentValues via callbacks.
  // This is the most reactive and simple approach (KISS).

  function updateValue(key: keyof ScarfGridType, val: any) {
    onPreview({
      [key]: val,
      timeline: item.value as any,
    })
  }

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }

  const isOrdinal = $derived(item.value === 'ordinal')
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <div class="timeline-row">
      <span class="section-title"
        >{isOrdinal ? 'Ordinal Range [indices]' : 'Time Range [ms]'}</span
      >
      <div class="timeline-inputs">
        <div class="input-group">
          <label for="timeline-start">Start</label>
          <input
            id="timeline-start"
            type="number"
            value={isOrdinal
              ? currentValues.ordinalStart
              : currentValues.timelineStart}
            oninput={e =>
              updateValue(
                isOrdinal ? 'ordinalStart' : 'timelineStart',
                parseInt(e.currentTarget.value)
              )}
            min="0"
            placeholder="0"
          />
        </div>
        <div class="input-group">
          <label for="timeline-end">End (0 = Auto)</label>
          <input
            id="timeline-end"
            type="number"
            value={isOrdinal
              ? currentValues.ordinalEnd
              : currentValues.timelineEnd}
            oninput={e =>
              updateValue(
                isOrdinal ? 'ordinalEnd' : 'timelineEnd',
                parseInt(e.currentTarget.value)
              )}
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
    padding: 2px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
