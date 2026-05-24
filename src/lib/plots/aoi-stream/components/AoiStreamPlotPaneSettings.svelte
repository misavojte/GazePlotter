<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio, Select } from '$lib/shared/components'
  import {
    ColorScalePicker,
    CommonPlotPaneFields,
    TimelineRangeSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { aoiStreamPlotDefinition } from '../definition'
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
</script>

<CommonPlotPaneFields {item} contract={aoiStreamPlotDefinition.consumesMetrics!} />

<PaneSection title="Visualisation">
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
</PaneSection>

<TimelineRangeSection {item} />
