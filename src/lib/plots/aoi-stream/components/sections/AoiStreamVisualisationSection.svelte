<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select, InputCheck } from '$lib/shared/components'
  import { ColorScalePicker } from '$lib/plots/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import { RIDGELINE_SCALE } from '../../const'
  import type { AoiStreamPlotItem, AoiStreamPlotSettings } from '../../types'

  let { item }: { item: AoiStreamPlotItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<AoiStreamPlotSettings>(() => item)

  // Divergence is computed from the real selection, so `.value` is always a
  // real value — `.charAt`/comparisons below never break on a "Mixed" marker.
  const alignment = $derived(bulk.common(s => s.alignment ?? 'stream'))
  const ridgelineScale = $derived(
    bulk.common(s => s.ridgelineScale ?? RIDGELINE_SCALE)
  )
  const hideNoAoi = $derived(bulk.common(s => s.hideNoAoi ?? false))

  // Sub-controls gated on alignment are hidden while alignment diverges — we
  // can't meaningfully show one plot's mode-specific options for a mixed set.
  const isRidgeline = $derived(!alignment.mixed && alignment.value === 'ridgeline')
  const isHeatmap = $derived(!alignment.mixed && alignment.value === 'heatmap')
  const visSummary = $derived(
    alignment.mixed
      ? 'Mixed'
      : alignment.value.charAt(0).toUpperCase() + alignment.value.slice(1)
  )
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={[
      { label: 'Stream', value: 'stream' },
      { label: 'Distribution', value: 'distribution' },
      { label: 'Ridgeline', value: 'ridgeline' },
      { label: 'Heatmap', value: 'heatmap' },
    ]}
    value={alignment.value}
    mixed={alignment.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>)
        .detail as AoiStreamPlotSettings['alignment']
      bulk.update({ alignment: v })
    }}
  />

  {#if isRidgeline}
    <InputNumber
      id="aoi-stream-ridge-scale"
      label="Ridge scale"
      value={ridgelineScale.value}
      mixed={ridgelineScale.mixed}
      min={1}
      max={10}
      step={0.1}
      appearance="compact"
      onValueChange={v => bulk.update({ ridgelineScale: v ?? RIDGELINE_SCALE })}
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
      onCommit={patch => bulk.update({ colorScale: patch })}
    />
  </div>
  <div class="sub-group">
    <div class="legend">Hide data</div>
    <InputCheck
      label="No AOI data"
      appearance="compact"
      size="xs"
      checked={hideNoAoi.value}
      mixed={hideNoAoi.mixed}
      onchange={e => bulk.update({ hideNoAoi: (e as CustomEvent<boolean>).detail })}
    />
  </div>
</PaneSection>

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
