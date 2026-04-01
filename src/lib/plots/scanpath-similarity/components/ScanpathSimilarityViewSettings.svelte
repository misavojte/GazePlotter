<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import { ColorPicker, ColorPickerManager } from '$lib/color'
  import { interpolateColor } from '$lib/color/utility'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber } from '$lib/shared/components'
  import { fade } from 'svelte/transition'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { SIMILARITY_METHODS } from '../const'
  import type { SimilarityMethod } from '../types'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      colorMin: { value: string }
      colorMiddle: { value: string }
      colorMax: { value: string }
      minValue: { value: number }
      maxValue: { value: number }
      threshold: { value: number }
      collapsed: { value: boolean }
      similarityMethod: { value: SimilarityMethod }
    }
    showThreshold?: boolean
  }

  let { syncs, showThreshold = false }: Props = $props()

  let middleColorManuallySet = $state(false)

  const minPicker = new ColorPickerManager()
  const middlePicker = new ColorPickerManager()
  const maxPicker = new ColorPickerManager()

  const gradientStyle = $derived.by(() => {
    const min = syncs.colorMin.value
    const middle = syncs.colorMiddle.value
    const max = syncs.colorMax.value
    return `linear-gradient(to right, ${min}, ${middle}, ${max})`
  })

  function handleMinChange(newColor: string) {
    syncs.colorMin.value = newColor
    if (!middleColorManuallySet) {
      syncs.colorMiddle.value = interpolateColor(
        newColor,
        syncs.colorMax.value,
        0.5
      )
    }
  }

  function handleMiddleChange(newColor: string) {
    syncs.colorMiddle.value = newColor
    middleColorManuallySet = true
  }

  function handleMaxChange(newColor: string) {
    syncs.colorMax.value = newColor
    if (!middleColorManuallySet) {
      syncs.colorMiddle.value = interpolateColor(
        syncs.colorMin.value,
        newColor,
        0.5
      )
    }
  }

  const presets = Object.values(PRESET_PALETTES)

  function applyPreset(colors: readonly string[]) {
    syncs.colorMin.value = colors[0]
    syncs.colorMax.value = colors[colors.length - 1]
    if (colors.length === 3) {
      syncs.colorMiddle.value = colors[1]
      middleColorManuallySet = true
    } else {
      syncs.colorMiddle.value = interpolateColor(colors[0], colors[1], 0.5)
      middleColorManuallySet = false
    }
  }
</script>

<div class="compact-color-settings">
  <CompactSettingsSection title="Method">
    <div class="radio-group">
      {#each SIMILARITY_METHODS as method}
        <label class="radio-label">
          <input
            type="radio"
            name="similarity-method"
            value={method.value}
            checked={syncs.similarityMethod.value === method.value}
            onchange={() => {
              syncs.similarityMethod.value = method.value
            }}
          />
          {method.label}
        </label>
      {/each}
    </div>
  </CompactSettingsSection>

  <CompactSettingsSeparator tone="light" />

  {#if showThreshold}
    <CompactSettingsSection title="Graph Threshold">
      <InputNumber
        id="threshold"
        label="Similarity threshold (0-1)"
        bind:value={syncs.threshold.value}
        min={0}
        max={1}
        step={0.05}
        appearance="compact"
      />
    </CompactSettingsSection>
    <CompactSettingsSeparator tone="light" />
  {/if}

  <CompactSettingsSection title="Options">
    <label class="checkbox-label">
      <input
        type="checkbox"
        bind:checked={syncs.collapsed.value}
      />
      Collapse consecutive AOIs
    </label>
  </CompactSettingsSection>

  {#if !showThreshold}
    <CompactSettingsSeparator tone="light" />

    <CompactSettingsSection title="Scale Range">
      <div class="range-inputs">
        <InputNumber
          id="min-val"
          label="Min"
          bind:value={syncs.minValue.value}
          min={0}
          max={1}
          step={0.01}
          appearance="compact"
        />
        <InputNumber
          id="max-val"
          label="Max (0=auto)"
          bind:value={syncs.maxValue.value}
          min={0}
          max={1}
          step={0.01}
          appearance="compact"
        />
      </div>
    </CompactSettingsSection>

    <CompactSettingsSeparator tone="light" />

    <CompactSettingsSection title="Colors">
      <div class="preview-container">
        <div class="gradient-bar" style:background={gradientStyle}>
          <button
            type="button"
            class="color-dot min"
            style:background-color={syncs.colorMin.value}
            onclick={() => minPicker.toggle()}
            bind:this={minPicker.triggerElement}
            aria-label="Min color"
          ></button>
          <button
            type="button"
            class="color-dot middle"
            style:background-color={syncs.colorMiddle.value}
            onclick={() => middlePicker.toggle()}
            bind:this={middlePicker.triggerElement}
            aria-label="Middle color"
          ></button>
          <button
            type="button"
            class="color-dot max"
            style:background-color={syncs.colorMax.value}
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
    </CompactSettingsSection>

    {#if minPicker.isOpen}
      <div
        use:minPicker.portal
        class="color-popup"
        style:top="{minPicker.position.top}px"
        style:left="{minPicker.position.left}px"
        bind:this={minPicker.popupElement}
        in:fade={{ duration: 100 }}
      >
        <ColorPicker value={syncs.colorMin.value} oninput={handleMinChange} />
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
        <ColorPicker
          value={syncs.colorMiddle.value}
          oninput={handleMiddleChange}
        />
        <button
          type="button"
          class="auto-btn"
          onclick={() => {
            middleColorManuallySet = false
            syncs.colorMiddle.value = interpolateColor(
              syncs.colorMin.value,
              syncs.colorMax.value,
              0.5
            )
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
        <ColorPicker value={syncs.colorMax.value} oninput={handleMaxChange} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .compact-color-settings {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 180px;
    box-sizing: border-box;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .radio-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .radio-label input {
    margin: 0;
  }
  .range-inputs {
    display: flex;
    gap: 8px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .checkbox-label input {
    margin: 0;
  }
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
