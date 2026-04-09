<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import { ColorGradientPicker } from '$lib/color'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber } from '$lib/shared/components'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      colorMin: { value: string }
      colorMiddle: { value: string }
      colorMax: { value: string }
      minValue: { value: number }
      maxValue: { value: number }
    }
  }

  let { syncs }: Props = $props()
</script>

<div class="compact-color-settings">
  <CompactSettingsSection title="Scale Range">
    <div class="range-inputs">
      <InputNumber
        id="min-val"
        label="Min"
        bind:value={syncs.minValue.value}
        min={0}
        appearance="compact"
      />
      <InputNumber
        id="max-val"
        label="Max (0=auto)"
        bind:value={syncs.maxValue.value}
        min={0}
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
