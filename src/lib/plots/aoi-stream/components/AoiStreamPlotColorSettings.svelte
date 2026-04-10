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
      binSize: { value: number }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      colorMin: { value: string }
      colorMiddle: { value: string }
      colorMax: { value: string }
    }
  }

  let { syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="compact-color-settings">
  <form onsubmit={handleSubmit}>
    <CompactSettingsSection title="Common Settings">
      <InputNumber
        id="bin-size"
        label="Bin Size [ms]"
        bind:value={syncs.binSize.value}
        min={1}
        appearance="compact"
      />

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
            label="End (0=Auto)"
            bind:value={syncs.timelineEnd.value}
            min={0}
            placeholder="Auto"
            appearance="compact"
            allowEmpty={true}
          />
        </div>
      </CompactSettingsSection>
    </CompactSettingsSection>

    <CompactSettingsSeparator tone="light" margin={8} />

    <CompactSettingsSection title="Color Scale">
      <ColorGradientPicker
        bind:colorMin={syncs.colorMin.value}
        bind:colorMiddle={syncs.colorMiddle.value}
        bind:colorMax={syncs.colorMax.value}
      />
    </CompactSettingsSection>
  </form>
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
  .timeline-inputs {
    display: flex;
    gap: 8px;
  }
</style>
