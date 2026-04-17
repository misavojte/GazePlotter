<script lang="ts">
  import type { MenuComponentBridgeProps } from '$lib/context-menu'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import {
    METRIC_CORRELATION_METHODS,
    WHOLE_STIMULUS_AOI_LABEL,
  } from '../const'
  import type {
    CorrelationMethod,
    MetricCorrelationView,
  } from '../types'
  import {
    createSystemMetricInstances,
    type MetricInstance,
  } from '$lib/plots/metrics'
  import MetricInstancePicker from './MetricInstancePicker.svelte'

  interface Props extends MenuComponentBridgeProps {
    syncs: {
      view: { value: MetricCorrelationView }
      selectedAoiId: { value: number | null }
      correlationMethod: { value: CorrelationMethod }
      enabledMetricIds: { value: number[] }
      timelineStart: { value: number | undefined }
      timelineEnd: { value: number | undefined }
    }
    /** Pure AOI list (does NOT include the whole-stimulus sentinel). */
    aoiOptions: SelectOption[]
    /** Workspace-level metric library. Empty/undefined → system seeds used. */
    metricInstances?: readonly MetricInstance[]
    /** Invoked when a user renames a library instance inline. */
    onrenameInstance?: (id: number, label: string) => void
  }

  let { syncs, aoiOptions, metricInstances, onrenameInstance }: Props = $props()

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

  const library = $derived<readonly MetricInstance[]>(
    metricInstances && metricInstances.length > 0
      ? metricInstances
      : createSystemMetricInstances()
  )

  // Empty selection is persisted as "all system" — but for the picker UI we
  // want to expand it so the user can see and manage what's included.
  const effectiveIds = $derived(
    syncs.enabledMetricIds.value.length > 0
      ? syncs.enabledMetricIds.value
      : library.filter(i => i.system).map(i => i.id)
  )

  function onMetricsChange(ids: number[]) {
    syncs.enabledMetricIds.value = ids
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
    <MetricInstancePicker
      instances={library}
      selectedIds={effectiveIds}
      onchange={onMetricsChange}
      {onrenameInstance}
    />
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
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .range-inputs {
    display: flex;
    gap: 8px;
  }
</style>
