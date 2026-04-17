<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber, Radio } from '$lib/shared/components'
  import { ColorGradientPicker } from '$lib/color'
  import { multiplierToMs } from '../core'

  interface Props extends MenuComponentBridgeProps {
    item: MenuItem
    syncs: {
      stepSize: { value: number }
      windowMultiplier: { value: number }
      presentation: { value: string }
      colorMin: { value: string }
      colorMiddle: { value: string }
      colorMax: { value: string }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
    }
  }

  let { item, syncs, close }: Props = $props()

  const n = $derived(syncs.windowMultiplier.value)
  const step = $derived(syncs.stepSize.value)
  const windowMs = $derived(multiplierToMs(n, step))
  const isHeatmap = $derived(syncs.presentation.value === 'heatmap')

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <InputNumber
      id="step-size"
      label="Step Size [ms]"
      bind:value={syncs.stepSize.value}
      min={1}
      appearance="compact"
    />

    <div class="window-row">
      <InputNumber
        id="window-multiplier"
        label="SW Multiplier [(2n+1) &times; {step}]"
        bind:value={syncs.windowMultiplier.value}
        min={0}
        step={1}
        appearance="compact"
      />
      <span class="window-value">
        {#if n > 0}
          {windowMs} ms
        {:else}
          off
        {/if}
      </span>
    </div>

    <CompactSettingsSeparator margin={6} />

    <CompactSettingsSection title="Presentation">
      <Radio
        options={[
          { value: 'heatmap', label: 'Heatmap' },
          { value: 'overlay', label: 'Overlay' },
        ]}
        bind:value={syncs.presentation.value}
        appearance="compact"
        direction="row"
      />

      {#if isHeatmap}
        <div class="color-scale">
          <ColorGradientPicker
            bind:colorMin={syncs.colorMin.value}
            bind:colorMiddle={syncs.colorMiddle.value}
            bind:colorMax={syncs.colorMax.value}
          />
        </div>
      {/if}
    </CompactSettingsSection>

    <CompactSettingsSeparator margin={6} />

    <CompactSettingsSection title="Timeline [ms]">
      <div class="timeline-inputs">
        <InputNumber
          id="timeline-start"
          label="Start"
          bind:value={syncs.timelineStart.value}
          min={0}
          placeholder="0"
          appearance="compact"
          allowEmpty={true}
        />
        <InputNumber
          id="timeline-end"
          label="End (0 = Auto)"
          bind:value={syncs.timelineEnd.value}
          min={0}
          placeholder="Auto"
          appearance="compact"
          allowEmpty={true}
        />
      </div>
    </CompactSettingsSection>
  </form>
</div>

<style>
  .settings-container {
    box-sizing: border-box;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .timeline-inputs {
    display: flex;
    gap: 8px;
  }
  .window-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .window-value {
    font-size: 11px;
    color: #999;
    white-space: nowrap;
    padding-bottom: 4px;
  }
  .color-scale {
    margin-top: 4px;
  }
</style>
