<script lang="ts">
  import type { MenuComponentBridgeProps, MenuItem } from '$lib/context-menu'
  import type {
    BarPlotSettings,
    StatisticalOverlayType,
  } from '$lib/plots/bar/types'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { Radio, InputNumber } from '$lib/shared/components'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      orderBy: { value: BarPlotSettings['orderBy'] }
      orderDirection: { value: BarPlotSettings['orderDirection'] }
      minScale: { value: number }
      maxScale: { value: number }
      barPlottingType: { value: BarPlotSettings['barPlottingType'] }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
      statisticalOverlay: { value: StatisticalOverlayType }
    }
  }

  let { item, syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <CompactSettingsSection title="Statistical overlay">
      <div class="overlay-grid">
        <Radio
          ariaLabel="Statistical overlay"
          options={[
            { label: 'None', value: 'none' },
            { label: 'Mean ± 95% CI', value: 'meanCi95' },
            { label: 'Mean ± SD', value: 'meanSd' },
            { label: 'Boxplot', value: 'boxplot' },
          ]}
          appearance="compact"
          direction="row"
          bind:value={syncs.statisticalOverlay.value}
        />
      </div>
    </CompactSettingsSection>

    <CompactSettingsSeparator />

    <CompactSettingsSection title="Orientation">
      <Radio
        ariaLabel="Plot orientation"
        options={[
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ]}
        appearance="compact"
        direction="row"
        bind:value={syncs.barPlottingType.value}
      />
    </CompactSettingsSection>

    <CompactSettingsSeparator />

    <CompactSettingsSection title="Ordering">
      <div class="order-columns">
        <div class="column">
          <Radio
            legend="Order by"
            options={[
              { label: 'Value', value: 'value' },
              { label: 'AOI order', value: 'aoi' },
            ]}
            appearance="compact"
            bind:value={syncs.orderBy.value}
          />
        </div>

        <div class="column">
          <Radio
            legend="Direction"
            options={[
              { label: 'ASC', value: 'asc' },
              { label: 'DESC', value: 'desc' },
            ]}
            appearance="compact"
            bind:value={syncs.orderDirection.value}
          />
        </div>
      </div>
    </CompactSettingsSection>

    <CompactSettingsSeparator />

    <CompactSettingsSection title="Scale range [ms]">
      <div class="scale-inputs">
        <InputNumber
          id="min-scale"
          label="Min"
          bind:value={syncs.minScale.value}
          min={0}
          appearance="compact"
        />
        <InputNumber
          id="max-scale"
          label="Max (0 = Auto)"
          bind:value={syncs.maxScale.value}
          min={0}
          appearance="compact"
        />
      </div>
    </CompactSettingsSection>

    <CompactSettingsSeparator />

    <CompactSettingsSection title="Calculated from Time Range [ms]">
      <div class="scale-inputs">
        <InputNumber
          id="timeline-start"
          label="Start"
          bind:value={syncs.timelineStart.value}
          min={0}
          appearance="compact"
          allowEmpty={true}
        />
        <InputNumber
          id="timeline-end"
          label="End (0 = Auto)"
          bind:value={syncs.timelineEnd.value}
          min={0}
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
  .order-columns {
    display: flex;
    gap: 12px;
  }
  .column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .scale-inputs {
    display: flex;
    gap: 8px;
  }
  .overlay-grid :global(.options.row) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
</style>
