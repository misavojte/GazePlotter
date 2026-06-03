<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio, Select } from '$lib/shared/components'
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
  import type { EvolvingMetricsItem, EvolvingMetricsSettings } from '../types'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<EvolvingMetricsSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const presentation = $derived(settings.presentation ?? 'heatmap')
  const isHeatmap = $derived(presentation === 'heatmap')
  const visSummary = $derived(presentation.charAt(0).toUpperCase() + presentation.slice(1))
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
      { label: 'Heatmap', value: 'heatmap' },
      { label: 'Overlay', value: 'overlay' },
    ]}
    value={presentation}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as 'heatmap' | 'overlay'
      update({ presentation: v })
    }}
  />
  <div style:display={isHeatmap ? 'contents' : 'none'}>
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={PRESET_PALETTES.HEAT.colors[0]}
      defaultMax={PRESET_PALETTES.HEAT.colors[2]}
      onCommit={patch => update({ colorScale: patch })}
    />
  </div>
</PaneSection>

<TimelineRangeSection {item} />

<AoiPaneSection stimulusId={settings.stimulusId} {source} />


