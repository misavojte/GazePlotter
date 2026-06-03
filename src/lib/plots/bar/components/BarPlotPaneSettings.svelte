<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, InputCheck, Select } from '$lib/shared/components'
  import {
    TimelineRangeSection,
    AoiPaneSection,
    StimulusPaneSection,
    ParticipantGroupPaneSection,
    MetricPaneSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { BarPlotItem, BarPlotSettings } from '../types'

  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<BarPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const minScale = $derived(settings.scaleRange?.[0] ?? 0)
  const maxScale = $derived(settings.scaleRange?.[1] ?? 0)

  function updateScale(patch: { min?: number; max?: number }) {
    const next: [number, number] = [
      patch.min ?? minScale,
      patch.max ?? maxScale,
    ]
    update({ scaleRange: next })
  }

  const visSummary = $derived.by(() => {
    const orientation = settings.barPlottingType === 'horizontal' ? 'Horizontal' : 'Vertical'
    const overlay = settings.statisticalOverlay === 'none'
      ? 'No overlay'
      : settings.statisticalOverlay === 'meanCi95'
        ? 'M ± 95% CI'
        : settings.statisticalOverlay === 'meanSd'
          ? 'M ± SD'
          : 'Boxplot'
    return `${orientation} (${overlay})`
  })
</script>

<StimulusPaneSection
  stimulusId={settings.stimulusId}
  onchange={id => update({ stimulusId: id })}
  {source}
/>

<ParticipantGroupPaneSection
  groupId={settings.groupId}
  stimulusId={settings.stimulusId}
  onchange={id => update({ groupId: id })}
  {source}
/>

<MetricPaneSection
  {item}
  metricInstanceIds={settings.metricInstanceIds}
  onchange={ids => update({ metricInstanceIds: ids })}
/>

<PaneSection title="Visualisation" summary={visSummary}>
  <div class="statistical-overlay-group">
    <Radio
      legend="Statistical overlay"
      options={[
        { label: 'None', value: 'none' },
        { label: 'Mean ± 95% CI', value: 'meanCi95' },
        { label: 'Mean ± SD', value: 'meanSd' },
        { label: 'Boxplot', value: 'boxplot' },
      ]}
      appearance="compact"
      value={settings.statisticalOverlay}
      onchange={e => {
        const v = (e as CustomEvent<string>).detail as BarPlotSettings['statisticalOverlay']
        update({ statisticalOverlay: v })
      }}
    />
  </div>
  <Radio
    legend="Orientation"
    options={[
      { label: 'Horizontal', value: 'horizontal' },
      { label: 'Vertical', value: 'vertical' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.barPlottingType}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['barPlottingType']
      update({ barPlottingType: v })
    }}
  />
  <Radio
    legend="Order by"
    options={[
      { label: 'Value', value: 'value' },
      { label: 'AOI order', value: 'aoi' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.orderBy}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderBy']
      update({ orderBy: v })
    }}
  />
  <Radio
    legend="Direction"
    options={[
      { label: 'ASC', value: 'asc' },
      { label: 'DESC', value: 'desc' },
    ]}
    appearance="compact"
    direction="row"
    value={settings.orderDirection}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderDirection']
      update({ orderDirection: v })
    }}
  />
  <div class="scale-range-group">
    <div class="legend">Scale range</div>
    <div class="inline-pair">
      <InputNumber
        id="bar-min-scale"
        label="Min"
        value={minScale}
        min={0}
        appearance="compact"
        onValueChange={v => updateScale({ min: v ?? 0 })}
      />
      <InputNumber
        id="bar-max-scale"
        label="Max (0 = Auto)"
        value={maxScale}
        min={0}
        appearance="compact"
        onValueChange={v => updateScale({ max: v ?? 0 })}
      />
    </div>
  </div>
  <div class="sub-group">
    <div class="legend">Hide data</div>
    <InputCheck
      label="No AOI data"
      appearance="compact"
      size="xs"
      checked={settings.hideNoAoi ?? false}
      onchange={e => update({ hideNoAoi: (e as CustomEvent<boolean>).detail })}
    />
  </div>
</PaneSection>

<TimelineRangeSection {item} />

<AoiPaneSection stimulusId={settings.stimulusId} {source} />


<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }

  .scale-range-group,
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .scale-range-group .legend,
  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .statistical-overlay-group {
    width: 100%;
  }

  /* Two-column options grid if width is at least 240px */
  .statistical-overlay-group :global(.options) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 5px 12px;
    width: 100%;
  }

  .statistical-overlay-group :global(.option) {
    width: auto;
  }
</style>
