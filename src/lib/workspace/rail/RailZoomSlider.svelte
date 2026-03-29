<script lang="ts">
  import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '$lib/workspace/zoom'

  interface Props {
    value: number
    disabled?: boolean
  }

  let { value = $bindable(1), disabled = false }: Props = $props()

  const displayValue = $derived(`${value.toFixed(2)}x`)
</script>

<div class="zoom-control" class:disabled>
  <input
    class="zoom-slider"
    type="range"
    min={ZOOM_MIN}
    max={ZOOM_MAX}
    step={ZOOM_STEP}
    bind:value
    {disabled}
    aria-label="Workspace zoom level"
  />
  <span class="zoom-value">{displayValue}</span>
</div>

<style>
  .zoom-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }

  .zoom-control.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .zoom-slider {
    -webkit-appearance: none;
    appearance: none;
    writing-mode: vertical-lr;
    direction: rtl;
    width: 12px;
    height: 64px;
    margin: 0;
    padding: 0;
    cursor: pointer;
    background: transparent;
    opacity: 0.4;
    transition: opacity 0.15s;
  }

  .zoom-slider:focus {
    outline: none;
  }

  .zoom-slider:hover,
  .zoom-slider:focus {
    opacity: 0.8;
  }

  /* WebKit Track */
  .zoom-slider::-webkit-slider-runnable-track {
    width: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  /* Mozilla Track */
  .zoom-slider::-moz-range-track {
    width: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  /* WebKit Thumb */
  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 3px;
    background: var(--c-darkgrey, #888);
    border-radius: 2px;
    border: none;
    margin-left: -5px;
  }

  /* Mozilla Thumb */
  .zoom-slider::-moz-range-thumb {
    width: 12px;
    height: 3px;
    background: var(--c-darkgrey, #888);
    border-radius: 2px;
    border: none;
  }

  .zoom-value {
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--c-darkgrey, #888);
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
</style>
