<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import { ColorGradientPicker } from '$lib/color'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber, Radio, InputCheck } from '$lib/shared/components'
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
</script>

<div class="compact-color-settings">
  <CompactSettingsSection title="Method">
    <Radio
      ariaLabel="Similarity method"
      options={[...SIMILARITY_METHODS]}
      appearance="compact"
      bind:value={syncs.similarityMethod.value}
    />
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
        step={0.01}
        appearance="compact"
      />
    </CompactSettingsSection>
    <CompactSettingsSeparator tone="light" />
  {/if}

  <CompactSettingsSection title="Options">
    <InputCheck
      label="Collapse consecutive AOIs"
      bind:checked={syncs.collapsed.value}
      appearance="compact"
    />
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
      <ColorGradientPicker
        bind:colorMin={syncs.colorMin.value}
        bind:colorMiddle={syncs.colorMiddle.value}
        bind:colorMax={syncs.colorMax.value}
      />
    </CompactSettingsSection>
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
  .range-inputs {
    display: flex;
    gap: 8px;
  }
</style>
