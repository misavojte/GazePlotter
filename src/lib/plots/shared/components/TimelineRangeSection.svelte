<script lang="ts" generics="TType extends string, TSettings extends { timelineStart?: number; timelineEnd?: number }">
  /**
   * Shared "range" section used by every plot pane that has start/end bounds.
   *
   * By default it binds to `timelineStart` / `timelineEnd` and renders
   * "Time range [ms]". When the caller passes `ordinal={true}` together with
   * explicit `ordinalStart` / `ordinalEnd` values and an `onOrdinalChange`
   * callback, the section switches to ordinal-index editing instead.
   *
   * A custom `title` prop can override the section heading for either mode
   * (e.g. the Scarf plot uses "Ordinal range [indices]" when in ordinal mode).
   */
  import { InputNumber } from '$lib/shared/components'
  import { PaneSection, getPaneEditItems } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { computeCommonValue } from './sections/common'
  import type { PlotItemContract } from '../../definePlot'

  interface Props {
    item: PlotItemContract<TType, TSettings>
    /** Override the section heading (defaults to "Time range [ms]" or "Ordinal range [indices]"). */
    title?: string
    /** When true, the section edits ordinal indices instead of ms timestamps. */
    ordinal?: boolean
    /** Current ordinal start value (only used when `ordinal` is true). */
    ordinalStart?: number
    /** Current ordinal end value (only used when `ordinal` is true). */
    ordinalEnd?: number
    /** Callback for ordinal value changes: `boundary` is 'start' | 'end'. */
    onOrdinalChange?: (boundary: 'start' | 'end', value: number | undefined) => void
  }

  let {
    item,
    title,
    ordinal = false,
    ordinalStart,
    ordinalEnd,
    onOrdinalChange,
  }: Props = $props()

  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  // Edits target this item, or every selected item in a bulk (multi-select)
  // pane. Same command either way (single = set of one).
  const editItems = getPaneEditItems()
  function update(patch: Partial<TSettings>): void {
    const targets = editItems ? editItems() : [item]
    workspace.updateItemsSettings(
      targets.map(t => t.id),
      patch,
      source
    )
  }

  // Stable per-plot ids to keep label associations correct when multiple
  // panes mount simultaneously (e.g. side-by-side tab views).
  const startId = $derived(`timeline-start-${item.type}-${item.id}`)
  const endId = $derived(`timeline-end-${item.type}-${item.id}`)

  // Bulk-aware display: in ms mode, show the value common to the whole edit
  // set, or "Mixed" when the selected plots disagree (any edit then makes them
  // agree). Ordinal mode is only used in a same-type scarf context, where the
  // representative's ordinal bounds are shown.
  const targets = $derived(editItems ? editItems() : [item])
  const commonStart = $derived(
    ordinal
      ? { value: ordinalStart, mixed: false }
      : computeCommonValue(targets.map(t => t.settings.timelineStart))
  )
  const commonEnd = $derived(
    ordinal
      ? { value: ordinalEnd, mixed: false }
      : computeCommonValue(targets.map(t => t.settings.timelineEnd))
  )
  const effectiveStart = $derived(commonStart.mixed ? undefined : commonStart.value)
  const effectiveEnd = $derived(commonEnd.mixed ? undefined : commonEnd.value)
  const defaultTitle = $derived(ordinal ? 'Ordinal range [indices]' : 'Time range [ms]')
  const effectiveTitle = $derived(title ?? defaultTitle)

  const rangeSummary = $derived(
    commonStart.mixed || commonEnd.mixed
      ? 'Mixed'
      : (!effectiveStart && !effectiveEnd) ||
          (effectiveStart === 0 && effectiveEnd === 0)
        ? 'Full'
        : `${effectiveStart ?? 0}-${effectiveEnd || 'Auto'}`
  )

  function handleStartChange(v: number | undefined) {
    if (ordinal && onOrdinalChange) {
      onOrdinalChange('start', v)
    } else {
      update({ timelineStart: v } as Partial<TSettings>)
    }
  }

  function handleEndChange(v: number | undefined) {
    if (ordinal && onOrdinalChange) {
      onOrdinalChange('end', v)
    } else {
      update({ timelineEnd: v } as Partial<TSettings>)
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
      appearance="compact"
      allowEmpty={true}
      onValueChange={handleStartChange}
    />
    <InputNumber
      id={endId}
      label="End (0 = Auto)"
      value={commonEnd.value}
      mixed={commonEnd.mixed}
      min={0}
      appearance="compact"
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
