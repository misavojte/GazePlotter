<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio } from '$lib/shared/components'
  import {
    createBulkContext,
    ScaleRangePair,
    HideNoAoiCheck,
  } from '$lib/plots/shared/components/sections'
  import { getGazePlotterSession } from '$lib/session'
  import { resolveInstance, getMetric } from '$lib/metrics'
  import type { BarPlotItem, BarPlotSettings } from '../../types'

  let { item }: { item: BarPlotItem } = $props()
  const bulk = createBulkContext<BarPlotSettings>(() => item)
  const { engine } = getGazePlotterSession()

  // Divergence per field from the real selection — never a sentinel.
  const overlay = $derived(bulk.common(s => s.statisticalOverlay))
  // Proportion metrics (e.g. noticed-rate) render as plain bars; the beeswarm
  // statistical-overlay paradigm does not apply, so its picker is hidden.
  const metricId = $derived(bulk.common(s => s.metricInstanceIds?.[0] ?? null))
  const isProportion = $derived.by(() => {
    if (metricId.mixed || !metricId.value) return false
    const inst = resolveInstance(engine.metadata?.metricInstances ?? [], metricId.value)
    return inst ? getMetric(inst.baseId)?.meta.measurementClass === 'proportion' : false
  })
  const orientation = $derived(bulk.common(s => s.barPlottingType))
  const orderBy = $derived(bulk.common(s => s.orderBy))
  const orderDirection = $derived(bulk.common(s => s.orderDirection))
  const minScale = $derived(bulk.common(s => s.scaleRange?.[0] ?? 0))
  const maxScale = $derived(bulk.common(s => s.scaleRange?.[1] ?? 0))

  function updateScale(patch: { min?: number; max?: number }) {
    // Per item from each plot's OWN scaleRange so a partial edit (only min or
    // only max) doesn't pull the untouched bound from a peer and overwrite it.
    bulk.updateEach(s => {
      const cur = s.scaleRange ?? [0, 0]
      return {
        scaleRange: [patch.min ?? cur[0], patch.max ?? cur[1]] as [
          number,
          number,
        ],
      }
    })
  }

  const visSummary = $derived.by(() => {
    const o = orientation.mixed
      ? 'Mixed'
      : orientation.value === 'horizontal'
        ? 'Horizontal'
        : 'Vertical'
    if (isProportion) return `${o} (Bars)`
    if (orientation.mixed || overlay.mixed) return 'Mixed'
    const ov =
      overlay.value === 'none'
        ? 'No overlay'
        : overlay.value === 'meanCi95'
          ? 'M ± 95% CI'
          : overlay.value === 'meanSd'
            ? 'M ± SD'
            : 'Boxplot'
    return `${o} (${ov})`
  })
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  {#if !isProportion}
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
        value={overlay.value}
        mixed={overlay.mixed}
        onchange={e => {
          const v = (e as CustomEvent<string>).detail as BarPlotSettings['statisticalOverlay']
          bulk.update({ statisticalOverlay: v })
        }}
      />
    </div>
  {/if}
  <Radio
    legend="Orientation"
    options={[
      { label: 'Horizontal', value: 'horizontal' },
      { label: 'Vertical', value: 'vertical' },
    ]}
    appearance="compact"
    direction="row"
    value={orientation.value}
    mixed={orientation.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['barPlottingType']
      bulk.update({ barPlottingType: v })
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
    value={orderBy.value}
    mixed={orderBy.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderBy']
      bulk.update({ orderBy: v })
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
    value={orderDirection.value}
    mixed={orderDirection.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as BarPlotSettings['orderDirection']
      bulk.update({ orderDirection: v })
    }}
  />
  <ScaleRangePair
    idPrefix="bar-scale"
    legend="Scale range"
    min={minScale}
    max={maxScale}
    onUpdate={updateScale}
  />
  <HideNoAoiCheck {bulk} />
</PaneSection>

<style>
  .statistical-overlay-group {
    width: 100%;
  }

  /* Two-column options grid if width is at least 240px */
  .statistical-overlay-group :global(.options) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--spacing-xxs) var(--spacing-sm);
    width: 100%;
  }

  .statistical-overlay-group :global(.option) {
    width: auto;
  }
</style>
