<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select, InputCheck } from '$lib/shared/components'
  import {
    ColorScalePicker,
    TimelineRangeSection,
    AoiPaneSection,
    StimulusPaneSection,
    ParticipantGroupPaneSection,
    MetricPaneSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { RIDGELINE_SCALE } from '../const'



  import type {
    AoiStreamPlotItem,
    AoiStreamPlotSettings,
  } from '../types'

  interface Props {
    item: AoiStreamPlotItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<AoiStreamPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const alignment = $derived(settings.alignment ?? 'stream')
  const isRidgeline = $derived(alignment === 'ridgeline')
  const isHeatmap = $derived(alignment === 'heatmap')
  const visSummary = $derived(alignment.charAt(0).toUpperCase() + alignment.slice(1))
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
  <Select
    options={[
      { label: 'Stream', value: 'stream' },
      { label: 'Distribution', value: 'distribution' },
      { label: 'Ridgeline', value: 'ridgeline' },
      { label: 'Heatmap', value: 'heatmap' },
    ]}
    value={alignment}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as AoiStreamPlotSettings['alignment']
      update({ alignment: v })
    }}
  />

  {#if isRidgeline}
    <InputNumber
      id="aoi-stream-ridge-scale"
      label="Ridge scale"
      value={settings.ridgelineScale ?? RIDGELINE_SCALE}
      min={1}
      max={10}
      step={0.1}
      appearance="compact"
      onValueChange={v => update({ ridgelineScale: v ?? RIDGELINE_SCALE })}
    />
  {/if}

  <!-- Picker stays mounted regardless of alignment — toggling via an
       outer `{#if}` broke the bindable plumbing in practice (the picker
       remounted with stale bindings on re-entry and its writes never
       reached parent state, so the colorScale commit never fired). Hide
       visually when not heatmap, but keep the component instance alive
       so the `bind:` bindings never tear down mid-edit. -->
  <div style:display={isHeatmap ? 'contents' : 'none'}>
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={PRESET_PALETTES.HEAT.colors[0]}
      defaultMax={PRESET_PALETTES.HEAT.colors[2]}
      onCommit={patch => update({ colorScale: patch })}
    />
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
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
</style>
