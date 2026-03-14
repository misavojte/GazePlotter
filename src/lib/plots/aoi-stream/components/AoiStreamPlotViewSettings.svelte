<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import {
    InputNumber,
  } from '$lib/shared/components'

  interface Props extends MenuComponentBridgeProps {
    item: MenuItem
    syncs: {
      binSize: { value: number }
      ridgelineScale: { value: number }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
    }
  }

  let { item, syncs, close }: Props = $props()
  const isRidgeline = $derived('value' in item && item.value === 'ridgeline')

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <InputNumber
      id="bin-size"
      label="Bin Size [ms]"
      bind:value={syncs.binSize.value}
      min={1}
      appearance="compact"
    />

    {#if isRidgeline}
      <InputNumber
        id="ridge-scale"
        label="Ridge Scale"
        bind:value={syncs.ridgelineScale.value}
        min={1}
        max={10}
        step={0.1}
        appearance="compact"
      />
    {/if}

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
</style>
