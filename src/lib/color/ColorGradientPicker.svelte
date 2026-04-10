<script lang="ts">
  import { ColorPicker, ColorPickerManager } from '$lib/color'
  import { interpolateColor } from '$lib/color/utility'
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

  const minPicker = new ColorPickerManager()
  const middlePicker = new ColorPickerManager()
  const maxPicker = new ColorPickerManager()

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
    border-radius: 8px;
    border: 1px solid #ddd;
    display: flex;
    align-items: center;
    position: relative;
  }
  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
    position: absolute;
    cursor: pointer;
    padding: 0;
    top: 50%;
    transform: translateY(-50%);
    box-sizing: border-box;
  }
  .color-dot.min {
    left: -6px;
  }
  .color-dot.middle {
    left: calc(50% - 6px);
  }
  .color-dot.max {
    right: -6px;
  }
  .presets {
    display: flex;
    gap: 6px;
    justify-content: flex-start;
    padding: 2px 0;
  }
  .preset-btn {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid #ddd;
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s;
  }
  .preset-btn:hover {
    transform: scale(1.1);
    border-color: #999;
  }
  .color-popup {
    position: fixed;
    padding: 10px;
    background-color: white;
    border-radius: var(--rounded, 4px);
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
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
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 3px;
    color: #374151;
  }
  .auto-btn:hover {
    background: #e5e7eb;
  }
</style>
