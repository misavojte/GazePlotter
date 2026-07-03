<script lang="ts">
  import { buildValueRangePatch } from '../../colorScalePreview'
  import ScaleRangePair from './ScaleRangePair.svelte'
  import type { BulkContext } from './common'

  /** Settings shape for plots with a per-stimulus color value range. */
  interface ColorRangeSettings {
    stimulusId: number
    stimuliColorValueRanges?: [number, number][]
  }

  interface Props {
    bulk: BulkContext<ColorRangeSettings>
    idPrefix: string
    legend?: string
    inputMax?: number
    step?: number
  }

  let {
    bulk,
    idPrefix,
    legend = undefined,
    inputMax = undefined,
    step = undefined,
  }: Props = $props()

  // The current-stimulus range is keyed by EACH plot's own stimulusId — read
  // divergence from that same per-item accessor so "Mixed" reflects what the
  // user actually sees on each plot.
  const rangeMin = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[0] ?? 0)
  )
  const rangeMax = $derived(
    bulk.common(s => s.stimuliColorValueRanges?.[s.stimulusId]?.[1] ?? 0)
  )

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

<ScaleRangePair
  {idPrefix}
  {legend}
  min={rangeMin}
  max={rangeMax}
  {inputMax}
  {step}
  onUpdate={updateValueRange}
/>
