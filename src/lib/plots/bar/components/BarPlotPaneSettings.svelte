<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Radio } from '$lib/shared/components'
  import {
    CommonPlotPaneFields,
    TimelineRangeSection,
  } from '$lib/plots/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { BarPlotItem, BarPlotSettings } from '../types'
  import { barPlotDefinition } from '../definition'

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
</script>

<CommonPlotPaneFields {item} contract={barPlotDefinition.consumesMetrics!} />

<PaneSection title="Layout">
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
</PaneSection>

<PaneSection title="Scale range">
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
</PaneSection>

<TimelineRangeSection {item} />

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
