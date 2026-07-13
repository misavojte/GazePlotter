<script lang="ts">
  import { InputNumber } from '$lib/shared/components'

  interface BulkNumber {
    value: number
    mixed: boolean
  }

  /**
   * The min/max value-range input pair every scaled plot uses ("0 = Auto" max
   * convention). Presentational only — the caller owns the settings write
   * (plain field for the `scaleRange` kind, per-stimulus keyed write for the
   * `stimulusColorRange` kind).
   */
  interface Props {
    idPrefix: string
    legend?: string
    min: BulkNumber
    max: BulkNumber
    inputMax?: number
    step?: number
    onUpdate: (next: { min?: number; max?: number }) => void
  }

  let {
    idPrefix,
    legend = undefined,
    min,
    max,
    inputMax = undefined,
    step = undefined,
    onUpdate,
  }: Props = $props()
</script>

<div class="range-group">
  {#if legend}<div class="legend">{legend}</div>{/if}
  <div class="inline-pair">
    <InputNumber
      id="{idPrefix}-min"
      label="Min"
      value={min.value}
      mixed={min.mixed}
      min={0}
      max={inputMax}
      {step}
      appearance="compact"
      onValueChange={v => onUpdate({ min: v ?? 0 })}
    />
    <InputNumber
      id="{idPrefix}-max"
      label="Max (0 = Auto)"
      value={max.value}
      mixed={max.mixed}
      min={0}
      max={inputMax}
      {step}
      appearance="compact"
      onValueChange={v => onUpdate({ max: v ?? 0 })}
    />
  </div>
</div>

<style>
  .range-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
