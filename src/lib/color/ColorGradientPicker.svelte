<script lang="ts">
  import { ColorPicker, ColorPickerState } from '$lib/color'
  import { interpolateColor } from './interpolation'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { fade } from 'svelte/transition'

  let {
    colorMin = $bindable('#f7fbff'),
    colorMiddle = $bindable('#6baed6'),
    colorMax = $bindable('#08306b'),
  }: {
    colorMin: string
    colorMiddle: string
    colorMax: string
  } = $props()

  let middleColorManuallySet = $state(false)

  const minPicker = new ColorPickerState()
  const middlePicker = new ColorPickerState()
  const maxPicker = new ColorPickerState()

  const gradientStyle = $derived.by(() => {
    return `linear-gradient(to right, ${colorMin}, ${colorMiddle}, ${colorMax})`
  })

  function handleMinChange(newColor: string) {
    colorMin = newColor
    if (!middleColorManuallySet) {
      colorMiddle = interpolateColor(newColor, colorMax, 0.5)
    }
  }

  function handleMiddleChange(newColor: string) {
    colorMiddle = newColor
    middleColorManuallySet = true
  }

  function handleMaxChange(newColor: string) {
    colorMax = newColor
    if (!middleColorManuallySet) {
      colorMiddle = interpolateColor(colorMin, newColor, 0.5)
    }
  }

  const presets = Object.values(PRESET_PALETTES)

  function applyPreset(colors: readonly string[]) {
    colorMin = colors[0]
    colorMax = colors[colors.length - 1]
    if (colors.length === 3) {
      colorMiddle = colors[1]
      middleColorManuallySet = true
    } else {
      colorMiddle = interpolateColor(colors[0], colors[1], 0.5)
      middleColorManuallySet = false
    }
  }
</script>

<div class="color-gradient-picker">
  <div class="preview-container">
    <div class="gradient-bar" style:background={gradientStyle}>
      <button
        type="button"
        class="color-dot min"
        style:background-color={colorMin}
        onclick={() => minPicker.toggle()}
        bind:this={minPicker.triggerElement}
        aria-label="Min color"
      ></button>
      <button
        type="button"
        class="color-dot middle"
        style:background-color={colorMiddle}
        onclick={() => middlePicker.toggle()}
        bind:this={middlePicker.triggerElement}
        aria-label="Middle color"
      ></button>
      <button
        type="button"
        class="color-dot max"
        style:background-color={colorMax}
        onclick={() => maxPicker.toggle()}
        bind:this={maxPicker.triggerElement}
        aria-label="Max color"
      ></button>
    </div>
  </div>

  <div class="presets">
    {#each presets as preset}
      <button
        type="button"
        class="preset-btn"
        style:background={`linear-gradient(to right, ${preset.colors.join(', ')})`}
        onclick={() => applyPreset(preset.colors)}
        title={preset.name}
      ></button>
    {/each}
  </div>
</div>

{#if minPicker.isOpen}
  <div
    use:minPicker.portal
    class="color-popup"
    style:top="{minPicker.position.top}px"
    style:left="{minPicker.position.left}px"
    bind:this={minPicker.popupElement}
    in:fade={{ duration: 100 }}
  >
    <ColorPicker value={colorMin} oninput={handleMinChange} />
  </div>
{/if}

{#if middlePicker.isOpen}
  <div
    use:middlePicker.portal
    class="color-popup"
    style:top="{middlePicker.position.top}px"
    style:left="{middlePicker.position.left}px"
    bind:this={middlePicker.popupElement}
    in:fade={{ duration: 100 }}
  >
    <ColorPicker value={colorMiddle} oninput={handleMiddleChange} />
    <button
      type="button"
      class="auto-btn"
      onclick={() => {
        middleColorManuallySet = false
        colorMiddle = interpolateColor(colorMin, colorMax, 0.5)
      }}
    >
      Auto-calculate
    </button>
  </div>
{/if}

{#if maxPicker.isOpen}
  <div
    use:maxPicker.portal
    class="color-popup"
    style:top="{maxPicker.position.top}px"
    style:left="{maxPicker.position.left}px"
    bind:this={maxPicker.popupElement}
    in:fade={{ duration: 100 }}
  >
    <ColorPicker value={colorMax} oninput={handleMaxChange} />
  </div>
{/if}

<style>
  .preview-container {
    height: 16px;
    position: relative;
    margin: 4px 6px;
  }
  .gradient-bar {
    width: 100%;
    height: 100%;
    border-radius: var(--rounded-md);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    position: relative;
  }
  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: var(--shadow-sm);
    position: absolute;
    cursor: pointer;
    padding: 0;
    top: 50%;
    transform: translateY(-50%);
    box-sizing: border-box;

    &.min {
      left: -6px;
    }
    &.middle {
      left: calc(50% - 6px);
    }
    &.max {
      right: -6px;
    }
  }
  .presets {
    display: flex;
    gap: var(--spacing-xs);
    justify-content: flex-start;
    padding: 2px 0;
  }
  .preset-btn {
    width: 18px;
    height: 18px;
    border-radius: var(--rounded);
    border: 1px solid var(--c-border);
    cursor: pointer;
    padding: 0;
    transition: transform var(--transition-fast);

    &:hover {
      transform: scale(1.1);
      border-color: var(--c-darkgrey);
    }
  }
  .color-popup {
    position: fixed;
    padding: 10px;
    background-color: white;
    border-radius: var(--rounded);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    width: 210px;
  }
  .auto-btn {
    width: 100%;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 500;
    padding: 4px;
    cursor: pointer;
    background: var(--c-lightgrey);
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded);
    color: var(--c-text);

    &:hover {
      background: var(--c-grey);
    }
  }
</style>
