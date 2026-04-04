<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber, InputCheck, Radio } from '$lib/shared/components'
  import { RECURRENCE_HIGHLIGHTS, RECURRENCE_MASKINGS } from '../const'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      radius: { value: number }
      gridSize: { value: number }
      showDuration: { value: boolean }
      minLineLength: { value: number }
      highlight: { value: string }
      masking: { value: string }
    }
    method: string
  }

  let { syncs, method }: Props = $props()
</script>

<div class="recurrence-settings">
  {#if method === 'fixedDistance'}
    <CompactSettingsSection title="Distance">
      <InputNumber
        id="rec-radius"
        label="Radius [px]"
        bind:value={syncs.radius.value}
        min={1}
        max={500}
        appearance="compact"
      />
    </CompactSettingsSection>
    <CompactSettingsSeparator tone="light" />
  {/if}

  {#if method === 'fixedGrid'}
    <CompactSettingsSection title="Grid">
      <InputNumber
        id="rec-grid-size"
        label="Cells per axis"
        bind:value={syncs.gridSize.value}
        min={2}
        max={100}
        appearance="compact"
      />
    </CompactSettingsSection>
    <CompactSettingsSeparator tone="light" />
  {/if}

  <CompactSettingsSection title="Highlight">
    <Radio
      ariaLabel="Highlight mode"
      options={[...RECURRENCE_HIGHLIGHTS]}
      appearance="compact"
      bind:value={syncs.highlight.value}
    />
  </CompactSettingsSection>
  <CompactSettingsSeparator tone="light" />

  <CompactSettingsSection title="Masking">
    <Radio
      ariaLabel="Masking mode"
      options={[...RECURRENCE_MASKINGS]}
      appearance="compact"
      bind:value={syncs.masking.value}
    />
  </CompactSettingsSection>
  <CompactSettingsSeparator tone="light" />

  <CompactSettingsSection title="Options">
    <InputCheck
      label="Duration weighting"
      bind:checked={syncs.showDuration.value}
      size="xs"
      appearance="compact"
    />
    <InputNumber
      id="rec-min-line"
      label="Min line length [L]"
      bind:value={syncs.minLineLength.value}
      min={2}
      max={20}
      appearance="compact"
    />
  </CompactSettingsSection>
</div>

<style>
  .recurrence-settings {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 180px;
    box-sizing: border-box;
  }
</style>
