<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio, Select } from '$lib/shared/components'
  import {
    ColorScalePicker,
    CommonPlotPaneFields,
    TimelineRangeSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { evolvingMetricsDefinition } from '../definition'
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
</script>

<CommonPlotPaneFields {item} contract={evolvingMetricsDefinition.consumesMetrics!} />

<PaneSection title="Visualisation">
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
