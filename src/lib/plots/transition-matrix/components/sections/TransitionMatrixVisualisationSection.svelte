<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck, InputColor } from '$lib/shared/components'
  import {
    createBulkContext,
    StimulusColorRange,
    ColorScalePickerControl,
    HideNoAoiCheck,
  } from '$lib/plots/shared/components/sections'
  import type {
    TransitionMatrixPlotItem,
    TransitionMatrixPlotSettings,
  } from '../../types'

  let { item }: { item: TransitionMatrixPlotItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<TransitionMatrixPlotSettings>(() => item)

  const belowMin = $derived(bulk.common(s => s.belowMinColor))
  const aboveMax = $derived(bulk.common(s => s.aboveMaxColor))
  const showBelowMinLabels = $derived(bulk.common(s => s.showBelowMinLabels))
  const showAboveMaxLabels = $derived(bulk.common(s => s.showAboveMaxLabels))
</script>

<PaneSection title="Visualisation" summary="Matrix">
  <div class="sub-group">
    <div class="legend">Color scale</div>
    <StimulusColorRange {bulk} idPrefix="tm" />
    <ColorScalePickerControl
      {bulk}
      colorScale={settings.colorScale}
      defaultMin={'#f7fbff'}
      defaultMax={'#08306b'}
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
  <HideNoAoiCheck {bulk} />
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
    gap: var(--spacing-xs);
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
