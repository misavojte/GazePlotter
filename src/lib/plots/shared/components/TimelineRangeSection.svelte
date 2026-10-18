<script lang="ts" generics="TType extends string, TSettings extends { timelineStart?: number; timelineEnd?: number }">
  /**
   * Shared "range" section used by every plot pane that has start/end bounds.
   *
   * By default it binds to `timelineStart` / `timelineEnd` and renders
   * "Time range [ms]". A plot with an index-based mode passes `ordinalMode`
   * (data from its pane entry's `props` — scarf): while the predicate holds
   * on the representative settings, the section edits the given ordinal keys
   * and renders "Ordinal range [indices]" instead.
   */
  import { InputNumber } from '$lib/shared/components'
  import { PaneSection } from '$lib/workspace/pane'
  import { createBulkContext } from './sections/common'
  import type { PlotItemContract } from '../../definePlot'

  interface Props {
    item: PlotItemContract<TType, TSettings>
    /** Ordinal-index editing mode (dual-mode plots; scarf). */
    ordinalMode?: {
      when: (settings: TSettings) => boolean
      startKey: keyof TSettings & string
      endKey: keyof TSettings & string
    }
  }

  let { item, ordinalMode }: Props = $props()

  const settings = $derived(item.settings)
  // Edits target this item, or every selected item in a bulk (multi-select)
  // pane. Same command either way (single = set of one).
  const bulk = createBulkContext<TSettings>(() => item)

  // Stable per-plot ids to keep label associations correct when multiple
  // panes mount simultaneously (e.g. side-by-side tab views).
  const startId = $derived(`timeline-start-${item.type}-${item.id}`)
  const endId = $derived(`timeline-end-${item.type}-${item.id}`)

  const ordinal = $derived(ordinalMode ? ordinalMode.when(settings) : false)

  // Bulk-aware display: in ms mode, show the value common to the whole edit
  // set, or "Mixed" when the selected plots disagree (any edit then makes them
  // agree). Ordinal mode is only used in a same-type scarf context, where the
  // representative's ordinal bounds are shown.
  const commonStart = $derived(
    ordinal && ordinalMode
      ? { value: settings[ordinalMode.startKey] as number | undefined, mixed: false }
      : bulk.common(s => s.timelineStart)
  )
  const commonEnd = $derived(
    ordinal && ordinalMode
      ? { value: settings[ordinalMode.endKey] as number | undefined, mixed: false }
      : bulk.common(s => s.timelineEnd)
  )
  const effectiveStart = $derived(commonStart.mixed ? undefined : commonStart.value)
  const effectiveEnd = $derived(commonEnd.mixed ? undefined : commonEnd.value)
  const effectiveTitle = $derived(ordinal ? 'Ordinal range [indices]' : 'Time range [ms]')

  const rangeSummary = $derived(
    commonStart.mixed || commonEnd.mixed
      ? 'Mixed'
      : (!effectiveStart && !effectiveEnd) ||
          (effectiveStart === 0 && effectiveEnd === 0)
        ? 'Full'
        : `${effectiveStart ?? 0}-${effectiveEnd || 'Auto'}`
  )

  function handleStartChange(v: number | undefined) {
    if (ordinal && ordinalMode) {
      bulk.update({ [ordinalMode.startKey]: v } as Partial<TSettings>)
    } else {
      bulk.update({ timelineStart: v } as Partial<TSettings>)
    }
  }

  function handleEndChange(v: number | undefined) {
    if (ordinal && ordinalMode) {
      bulk.update({ [ordinalMode.endKey]: v } as Partial<TSettings>)
    } else {
      bulk.update({ timelineEnd: v } as Partial<TSettings>)
    }
  }
</script>

<PaneSection title={effectiveTitle} summary={rangeSummary}>
  <div class="inline-pair">
    <InputNumber
      id={startId}
      label="Start"
      value={commonStart.value}
      mixed={commonStart.mixed}
      min={0}
      compact
      allowEmpty={true}
      onValueChange={handleStartChange}
    />
    <InputNumber
      id={endId}
      label="End (0 = Auto)"
      value={commonEnd.value}
      mixed={commonEnd.mixed}
      min={0}
      compact
      allowEmpty={true}
      onValueChange={handleEndChange}
    />
  </div>
</PaneSection>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
