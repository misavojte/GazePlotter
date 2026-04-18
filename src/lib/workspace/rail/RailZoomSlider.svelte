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
</script>

<div
  class="zoom-control {orientation}"
  class:disabled
  use:tooltipAction={{
    content: label,
    position: orientation === 'horizontal' ? 'top' : 'right',
    disabled: responsive.isMobile,
  }}
>
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
  /* One visual identity, two orientations. The slider uses a single
     thumb + track style; `writing-mode: vertical-lr` rotates the
     whole control for the vertical variant. The only orientation-
     specific rules below are the wrapper layout, the slider's outer
     dimensions, and the cross-axis margin needed to center the thumb
     on the 2px track. */

  .zoom-control {
    display: flex;
    align-items: center;
  }

  .zoom-control.vertical {
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }

  .zoom-control.horizontal {
    flex-direction: row;
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
    margin: 0;
    padding: 0;
    cursor: pointer;
    background: transparent;
    opacity: 0.8;
    transition: opacity 0.15s;
  }

  .zoom-slider:focus {
    outline: none;
  }

  .zoom-slider:hover {
    opacity: 1;
  }

  /* Vertical variant: writing-mode rotates the intrinsic slider axis
     so the track flows top-to-bottom and the thumb slides along it.
     A small fixed inline size (width) keeps the hit target narrow but
     reachable with the mouse. */
  .vertical .zoom-slider {
    writing-mode: vertical-lr;
    direction: rtl;
    width: 12px;
    height: 64px;
  }

  .horizontal .zoom-slider {
    width: 120px;
    height: 20px;
  }

  /* Track: thin (2px cross-axis) line stretching the full main-axis
     length. Vendor-prefixed pseudo-elements CANNOT be combined into
     one selector — Chrome drops the whole rule if it contains a
     `::-moz-*` selector, and Firefox does the reverse. Each vendor
     needs its own complete rule block. */
  .vertical .zoom-slider::-webkit-slider-runnable-track {
    width: 2px;
    height: 100%;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }
  .vertical .zoom-slider::-moz-range-track {
    width: 2px;
    height: 100%;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  .horizontal .zoom-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }
  .horizontal .zoom-slider::-moz-range-track {
    width: 100%;
    height: 2px;
    background: var(--c-border, rgba(136, 136, 136, 0.3));
    border-radius: 1px;
  }

  /* Shared thumb: a 10×10 circle — rotation-invariant, identical
     visual identity in both orientations. The cross-axis margin
     centers the 10px thumb on the 2px track: (10 − 2) / 2 = 4px. */
  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    background: var(--c-darkgrey, #888);
    border-radius: 50%;
    border: none;
  }

  .zoom-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: var(--c-darkgrey, #888);
    border-radius: 50%;
    border: none;
  }

  .vertical .zoom-slider::-webkit-slider-thumb {
    margin-left: -4px;
  }
  .horizontal .zoom-slider::-webkit-slider-thumb {
    margin-top: -4px;
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

  .horizontal .zoom-value {
    font-size: 10px;
    min-width: 38px;
    text-align: right;
  }
</style>
