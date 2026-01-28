<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import type { PreviewSync } from '$lib/plots/shared'

  interface Props {
    item: MenuItem
    syncs: {
      timelineStart: PreviewSync<number>
      timelineEnd: PreviewSync<number>
      ordinalStart: PreviewSync<number>
      ordinalEnd: PreviewSync<number>
      hideNonFixations: PreviewSync<boolean>
    }
    close: () => void
  }

  let { item, syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }

  const isOrdinal = $derived(item.value === 'ordinal')
  const isRelative = $derived(item.value === 'relative')
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    {#if !isRelative}
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
                ? syncs.ordinalStart.value
                : syncs.timelineStart.value}
              oninput={e => {
                const v = parseInt(e.currentTarget.value)
                if (isOrdinal) syncs.ordinalStart.value = v
                else syncs.timelineStart.value = v
              }}
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
                ? syncs.ordinalEnd.value
                : syncs.timelineEnd.value}
              oninput={e => {
                const v = parseInt(e.currentTarget.value)
                if (isOrdinal) syncs.ordinalEnd.value = v
                else syncs.timelineEnd.value = v
              }}
              min="0"
              placeholder="Auto"
            />
          </div>
        </div>
      </div>
      <div class="divider"></div>
    {:else}
      <div class="info-text">
        Custom ranges and zooming are not available in Relative mode.
      </div>
      <div class="divider"></div>
    {/if}

    <div class="settings-row">
      <label class="checkbox-label" for="hide-non-fixations">
        <input
          id="hide-non-fixations"
          type="checkbox"
          checked={syncs.hideNonFixations.value}
          onchange={e => {
            syncs.hideNonFixations.value = e.currentTarget.checked
          }}
        />
        <span>Hide non-fixations</span>
      </label>
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
  .info-text {
    font-size: 11px;
    color: #666;
    font-style: italic;
    padding: 4px 0;
    line-height: 1.3;
    max-width: 180px;
  }
  .divider {
    height: 1px;
    background: #eee;
    margin: 4px -2px;
  }
  .settings-row {
    display: flex;
    align-items: center;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    color: #444;
    cursor: pointer;
    user-select: none;
    padding: 2px 0;
  }
  .checkbox-label input {
    margin: 0;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
</style>
