<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber, Radio, InputCheck, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import {
    BAR_PLOT_AGGREGATION_METHODS,
    METRIC_CORRELATION_METHODS,
    WHOLE_STIMULUS_AOI_LABEL,
  } from '../const'
  import type {
    CorrelationMethod,
    MetricCorrelationView,
  } from '../types'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      view: { value: MetricCorrelationView }
      selectedAoiId: { value: number | null }
      correlationMethod: { value: CorrelationMethod }
      enabledMetrics: { value: string[] }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
    }
    /** Pure AOI list (does NOT include the whole-stimulus sentinel). */
    aoiOptions: SelectOption[]
  }

  let { syncs, aoiOptions }: Props = $props()

  const WHOLE_STIMULUS_SENTINEL = '__whole_stimulus__'

  const scopeOptions = $derived<SelectOption[]>([
    { label: WHOLE_STIMULUS_AOI_LABEL, value: WHOLE_STIMULUS_SENTINEL },
    ...aoiOptions,
  ])

  const scopeValue = $derived(
    syncs.selectedAoiId.value == null
      ? WHOLE_STIMULUS_SENTINEL
      : String(syncs.selectedAoiId.value)
  )

  function onScopeChange(e: CustomEvent<string>) {
    syncs.selectedAoiId.value =
      e.detail === WHOLE_STIMULUS_SENTINEL ? null : Number(e.detail)
  }

  const enabledSet = $derived(new Set(syncs.enabledMetrics.value))

  function toggleMetric(metricId: string, checked: boolean) {
    const next = new Set(enabledSet)
    if (checked) next.add(metricId)
    else next.delete(metricId)
    syncs.enabledMetrics.value = Array.from(next)
  }
</script>

<div class="settings">
  <CompactSettingsSection title="Scope">
    <Select
      label="AOI / stimulus"
      options={scopeOptions}
      value={scopeValue}
      onchange={onScopeChange}
      compact
    />
  </CompactSettingsSection>

  <CompactSettingsSeparator />

  <CompactSettingsSection title="Correlation method">
    <Radio
      ariaLabel="Correlation method"
      options={METRIC_CORRELATION_METHODS.map(m => ({ label: m.label, value: m.value }))}
      appearance="compact"
      direction="row"
      bind:value={syncs.correlationMethod.value}
    />
  </CompactSettingsSection>

  <CompactSettingsSeparator />

  <CompactSettingsSection title="Metrics">
    <div class="metrics-grid">
      {#each BAR_PLOT_AGGREGATION_METHODS as metric}
        <InputCheck
          label={metric.label}
          checked={enabledSet.has(metric.value)}
          appearance="compact"
          onchange={e => toggleMetric(metric.value, (e as CustomEvent<boolean>).detail)}
        />
      {/each}
    </div>
  </CompactSettingsSection>

  <CompactSettingsSeparator />

  <CompactSettingsSection title="Time range [ms]">
    <div class="range-inputs">
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
</div>

<style>
  .settings {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 240px;
    box-sizing: border-box;
  }
  .range-inputs {
    display: flex;
    gap: 8px;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 10px;
  }
</style>
