<script lang="ts">
  import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '$lib/workspace/zoom'
  import { tooltipAction } from '$lib/tooltip'
  import { responsive } from '../responsive.svelte'

  interface Props {
    value: number
    label?: string
    disabled?: boolean
    orientation?: 'vertical' | 'horizontal'
  }

  let {
    value = $bindable(1),
    label = 'Zoom',
    disabled = false,
    orientation = 'vertical',
  }: Props = $props()

  const displayValue = $derived(`${value.toFixed(2)}x`)
  const isHorizontal = $derived(orientation === 'horizontal')
</script>

<div
  class="zoom-control"
  class:horizontal={isHorizontal}
  class:disabled
  use:tooltipAction={{
    content: label,
    position: isHorizontal ? 'top' : 'right',
    disabled: responsive.isMobile,
  }}
>
  <input
    class="zoom-slider"
    class:horizontal={isHorizontal}
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
  /* Vertical (desktop) default: label stacks below a vertical slider.
     Horizontal (mobile) variant: label sits to the right of a
     horizontal slider. Same visual tokens across orientations so the
     control reads as one control, just rotated. */
  .zoom-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }

  .zoom-control.horizontal {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
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
    opacity: 0.8;
    transition: opacity 0.15s;
  }

  .zoom-slider.horizontal {
    writing-mode: horizontal-tb;
    direction: ltr;
    width: 120px;
    height: 20px;
  }

  .zoom-slider:focus {
    outline: none;
  }

  .zoom-slider:hover {
    opacity: 1;
  }

  /* Vertical track (WebKit + Mozilla) */
  .zoom-slider::-webkit-slider-runnable-track {
    width: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  .zoom-slider::-moz-range-track {
    width: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  /* Horizontal track overrides */
  .zoom-slider.horizontal::-webkit-slider-runnable-track {
    width: 100%;
    height: 2px;
  }

  .zoom-slider.horizontal::-moz-range-track {
    width: 100%;
    height: 2px;
  }

  /* Vertical thumb — thin bar (drags up/down) */
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

  .zoom-slider::-moz-range-thumb {
    width: 12px;
    height: 3px;
    background: var(--c-darkgrey, #888);
    border-radius: 2px;
    border: none;
  }

  /* Horizontal thumb — rounded pill (drags left/right, comfortable on touch) */
  .zoom-slider.horizontal::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-left: 0;
    margin-top: -6px;
  }

  .zoom-slider.horizontal::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
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

  .zoom-control.horizontal .zoom-value {
    font-size: 10px;
    min-width: 38px;
    text-align: right;
  }
</style>
