<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'

  interface Props extends MenuComponentBridgeProps {
    item: MenuItem
    syncs: {
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      ordinalStart: { value: number | undefined }
      ordinalEnd: { value: number | undefined }
      hideNonFixations: { value: boolean }
    }
  }

  let { item, syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }

  const isOrdinal = $derived('value' in item && item.value === 'ordinal')
  const isRelative = $derived('value' in item && item.value === 'relative')
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <div class="timeline-row">
      <span class="section-title"
        >{isRelative
          ? 'Calculated from Time Range [ms]'
          : isOrdinal
            ? 'Ordinal Range [indices]'
            : 'Time Range [ms]'}</span
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
            value={isOrdinal ? syncs.ordinalEnd.value : syncs.timelineEnd.value}
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
    color: var(--c-text);
    display: block;
  }
  .input-group input {
    width: 100%;
    box-sizing: border-box;
    padding: 3px 6px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded);
    font-size: 11px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-group input:focus {
    border-color: var(--c-brand);
  }
  .divider {
    height: 1px;
    background: var(--c-lightgrey);
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
    color: var(--c-darkgrey);
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
