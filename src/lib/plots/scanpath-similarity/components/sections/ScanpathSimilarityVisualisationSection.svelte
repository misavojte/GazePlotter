<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputNumber, Select } from '$lib/shared/components'
  import { buildValueRangePatch } from '$lib/plots/shared'
  import { ColorScalePicker } from '$lib/plots/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { PRESET_PALETTES } from '$lib/color/palettes'
  import type {
    ScanpathSimilarityItem,
    ScanpathSimilaritySettings,
    ScanpathSimilarityView,
  } from '../../types'

  let { item }: { item: ScanpathSimilarityItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<ScanpathSimilaritySettings>(() => item)

  const view = $derived(bulk.common(s => s.view ?? 'matrix'))
  // View-gated sub-controls are hidden while view diverges.
  const isScangraph = $derived(!view.mixed && view.value === 'scangraph')
  const isMatrix = $derived(!view.mixed && view.value === 'matrix')
  const visSummary = $derived(
    view.mixed ? 'Mixed' : view.value === 'matrix' ? 'Matrix' : 'ScanGraph'
  )

  const threshold = $derived(bulk.common(s => s.threshold ?? 0.5))

  // Current-stimulus range keyed by EACH plot's own stimulusId.
  const rangeMin = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[0] ?? 0)
  )
  const rangeMax = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[1] ?? 0)
  )

  function updateValueRange(next: { min?: number; max?: number }) {
    // Per-item patch (each plot's own per-stimulus ranges + stimulusId) so a
    // bulk edit never clobbers other selected plots' other-stimulus ranges.
    bulk.updateEach(s => {
      const r = s.stimuliColorValueRanges?.[s.stimulusId] ?? [0, 0]
      const draft = { minValue: next.min ?? r[0], maxValue: next.max ?? r[1] }
      const committed = { minValue: r[0], maxValue: r[1] }
      const patch = buildValueRangePatch(
        draft,
        committed,
        s.stimuliColorValueRanges,
        s.stimulusId
      )
      return patch ? { stimuliColorValueRanges: patch } : null
    })
  }
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Select
    options={[
      { label: 'Matrix', value: 'matrix' },
      { label: 'ScanGraph', value: 'scangraph' },
    ]}
    value={view.value}
    mixed={view.mixed}
    onchange={e => {
      const v = (e as CustomEvent<string>).detail as ScanpathSimilarityView
      bulk.update({ view: v })
    }}
  />

  {#if isScangraph}
    <InputNumber
      id="scanpath-threshold"
      label="Similarity threshold (0–1)"
      value={threshold.value}
      mixed={threshold.mixed}
      min={0}
      max={1}
      step={0.01}
      appearance="compact"
      onValueChange={v => bulk.update({ threshold: v ?? 0.5 })}
    />
  {/if}

  <!-- Picker stays mounted regardless of view — toggling via an
       outer `{#if}` broke the bindable plumbing in practice (the picker
       remounted with stale bindings on re-entry and its writes never
       reached parent state, so the colorScale commit never fired). Hide
       visually unless matrix (and while view diverges), but keep the
       component instance alive so the `bind:` bindings never tear down. -->
  <div style:display={isMatrix ? 'contents' : 'none'}>
    <div class="inline-pair">
      <InputNumber
        id="scanpath-min-val"
        label="Min"
        value={rangeMin.value}
        mixed={rangeMin.mixed}
        min={0}
        max={1}
        step={0.01}
        appearance="compact"
        onValueChange={v => updateValueRange({ min: v ?? 0 })}
      />
      <InputNumber
        id="scanpath-max-val"
        label="Max (0 = Auto)"
        value={rangeMax.value}
        mixed={rangeMax.mixed}
        min={0}
        max={1}
        step={0.01}
        appearance="compact"
        onValueChange={v => updateValueRange({ max: v ?? 0 })}
      />
    </div>
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={PRESET_PALETTES.BLUE.colors[0]}
      defaultMax={PRESET_PALETTES.BLUE.colors[2]}
      onCommit={patch => bulk.update({ colorScale: patch })}
    />
  </div>
</PaneSection>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
