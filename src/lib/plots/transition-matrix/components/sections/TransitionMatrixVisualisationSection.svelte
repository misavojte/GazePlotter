<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import {
    InputNumber,
    InputCheck,
    InputColor,
  } from '$lib/shared/components'
  import { buildValueRangePatch } from '$lib/plots/shared'
  import { ColorScalePicker } from '$lib/plots/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '../../types'

  let { item }: { item: TransitionMatrixPlotItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<TransitionMatrixPlotSettings>(() => item)

  // The current-stimulus range is keyed by EACH plot's own stimulusId — read
  // divergence from that same per-item accessor so "Mixed" reflects what the
  // user actually sees on each plot.
  const rangeMin = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[0] ?? 0)
  )
  const rangeMax = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[1] ?? 0)
  )

  const belowMin = $derived(bulk.common(s => s.belowMinColor))
  const aboveMax = $derived(bulk.common(s => s.aboveMaxColor))
  const showBelowMinLabels = $derived(bulk.common(s => s.showBelowMinLabels))
  const showAboveMaxLabels = $derived(bulk.common(s => s.showAboveMaxLabels))
  const hideNoAoi = $derived(bulk.common(s => s.hideNoAoi ?? false))

  function updateValueRange(next: { min?: number; max?: number }) {
    // Compute the patch PER ITEM from each plot's own per-stimulus ranges and
    // its own stimulusId — broadcasting the representative's full array would
    // clobber other selected plots' ranges for their other stimuli.
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

<PaneSection title="Visualisation" summary="Matrix">
  <div class="sub-group">
    <div class="legend">Color scale</div>
    <div class="inline-pair">
      <InputNumber
        id="tm-min-val"
        label="Min"
        value={rangeMin.value}
        mixed={rangeMin.mixed}
        min={0}
        appearance="compact"
        onValueChange={v => updateValueRange({ min: v ?? 0 })}
      />
      <InputNumber
        id="tm-max-val"
        label="Max (0 = Auto)"
        value={rangeMax.value}
        mixed={rangeMax.mixed}
        min={0}
        appearance="compact"
        onValueChange={v => updateValueRange({ max: v ?? 0 })}
      />
    </div>
    <ColorScalePicker
      colorScale={settings.colorScale}
      defaultMin={'#f7fbff'}
      defaultMax={'#08306b'}
      onCommit={patch => bulk.update({ colorScale: patch })}
    />
  </div>

  <div class="sub-group">
    <div class="legend">Out of bounds</div>
    <div class="inline-pair">
      <InputColor
        label="Below min"
        size="xs"
        value={belowMin.value}
        mixed={belowMin.mixed}
        oninput={(e: CustomEvent<string>) => bulk.update({ belowMinColor: e.detail })}
        width={40}
      />
      <div class="oob-check">
        <InputCheck
          label="Show text"
          appearance="compact"
          size="xs"
          checked={showBelowMinLabels.value}
          mixed={showBelowMinLabels.mixed}
          onchange={e => bulk.update({ showBelowMinLabels: (e as CustomEvent<boolean>).detail })}
        />
      </div>
    </div>
    <div class="inline-pair">
      <InputColor
        label="Above max"
        size="xs"
        value={aboveMax.value}
        mixed={aboveMax.mixed}
        oninput={(e: CustomEvent<string>) => bulk.update({ aboveMaxColor: e.detail })}
        width={40}
      />
      <div class="oob-check">
        <InputCheck
          label="Show text"
          appearance="compact"
          size="xs"
          checked={showAboveMaxLabels.value}
          mixed={showAboveMaxLabels.mixed}
          onchange={e => bulk.update({ showAboveMaxLabels: (e as CustomEvent<boolean>).detail })}
        />
      </div>
    </div>
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
  .inline-pair {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .oob-check {
    padding-bottom: 2px;
  }

  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    margin-top: 4px;
  }

  .sub-group:first-of-type {
    margin-top: 0;
  }

  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
</style>
