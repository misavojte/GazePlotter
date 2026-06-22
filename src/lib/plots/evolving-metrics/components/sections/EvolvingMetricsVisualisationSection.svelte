<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Select } from '$lib/shared/components'
  import { ColorScalePicker } from '$lib/plots/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import type { EvolvingMetricsItem, EvolvingMetricsSettings } from '../../types'

  let { item }: { item: EvolvingMetricsItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<EvolvingMetricsSettings>(() => item)

  const presentation = $derived(bulk.common(s => s.presentation ?? 'heatmap'))
  const isHeatmap = $derived(!presentation.mixed && presentation.value === 'heatmap')
  const visSummary = $derived(
    presentation.mixed
      ? 'Mixed'
      : presentation.value.charAt(0).toUpperCase() + presentation.value.slice(1)
  )
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={[
      { label: 'Heatmap', value: 'heatmap' },
      { label: 'Overlay', value: 'overlay' },
    ]}
    value={presentation.value}
    mixed={presentation.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as 'heatmap' | 'overlay'
      bulk.update({ presentation: v })
    }}
  />
  <div style:display={isHeatmap ? 'contents' : 'none'}>
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={PRESET_PALETTES.HEAT.colors[0]}
      defaultMax={PRESET_PALETTES.HEAT.colors[2]}
      onCommit={patch => bulk.update({ colorScale: patch })}
    />
  </div>
</PaneSection>
