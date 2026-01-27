<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import GeneralInputNumber from '$lib/shared/components/GeneralInputNumber.svelte'

  interface Props {
    item: MenuItem
    defaultValue: number
    defaultValueScale?: number
    defaultValueTimelineStart?: number
    defaultValueTimelineEnd?: number
    placeholder?: string
    action: (data: {
      binSize: string
      ridgelineScale?: string
      timelineStart: string
      timelineEnd: string
    }) => void
    close: () => void
  }

  let {
    item,
    defaultValue,
    defaultValueScale = 2.5,
    defaultValueTimelineStart = 0,
    defaultValueTimelineEnd = 0,
    placeholder = 'Bin Size [ms]',
    action,
    close,
  }: Props = $props()

  let binSize = $state(0)
  let scale = $state(0)
  let timelineStart = $state(0)
  let timelineEnd = $state(0)

  // Update local state if prop changes
  $effect(() => {
    if (defaultValue !== undefined) {
      binSize = defaultValue
    }
    if (defaultValueScale !== undefined) {
      scale = defaultValueScale
    }
    if (defaultValueTimelineStart !== undefined) {
      timelineStart = defaultValueTimelineStart
    }
    if (defaultValueTimelineEnd !== undefined) {
      timelineEnd = defaultValueTimelineEnd
    }
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const data: {
      binSize: string
      ridgelineScale?: string
      timelineStart: string
      timelineEnd: string
    } = {
      binSize: binSize.toString(),
      timelineStart: timelineStart.toString(),
      timelineEnd: timelineEnd.toString(),
    }

    if (item.value === 'ridgeline') {
      data.ridgelineScale = scale.toString()
    }

    action(data)
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit} class="flex flex-col gap-3">
    <div class="input-group">
      <label for="bin-size">{placeholder}</label>
      <input id="bin-size" type="number" bind:value={binSize} min="1" />
    </div>
    {#if item.value === 'ridgeline'}
      <div class="input-group">
        <label for="ridge-scale">Ridge Scale</label>
        <input
          id="ridge-scale"
          type="number"
          bind:value={scale}
          min="0.1"
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
            bind:value={timelineStart}
            min="0"
            placeholder="0"
          />
        </div>
        <div class="input-group">
          <label for="timeline-end">End (0 = Auto)</label>
          <input
            id="timeline-end"
            type="number"
            bind:value={timelineEnd}
            min="0"
            placeholder="Auto"
          />
        </div>
      </div>
    </div>
    <button type="submit" class="apply-btn">
      Apply {item.label} Alignment
    </button>
  </form>
</div>

<style>
  .settings-container {
    padding: 12px 14px;
    width: 220px;
    box-sizing: border-box;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .apply-btn {
    width: 100%;
    margin-top: 8px;
    background: var(--c-brand);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: var(--rounded);
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
    transition: filter 0.2s;
  }

  .apply-btn:hover {
    filter: brightness(1.1);
  }

  .apply-btn:active {
    filter: brightness(0.9);
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
