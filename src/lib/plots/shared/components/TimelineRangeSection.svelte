<script lang="ts" generics="TType extends PlotType, TSettings extends { timelineStart?: number; timelineEnd?: number }">
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
  import { PaneSection } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PlotItemContract } from '../../definePlot'
  import type { PlotType } from '$lib/workspace'

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

  function update(patch: Partial<TSettings>): void {
    workspace.updateItemSettings(item.id, patch, source)
  }

  // Stable per-plot ids to keep label associations correct when multiple
  // panes mount simultaneously (e.g. side-by-side tab views).
  const startId = $derived(`timeline-start-${item.type}-${item.id}`)
  const endId = $derived(`timeline-end-${item.type}-${item.id}`)

  // Resolve displayed values and heading based on mode
  const effectiveStart = $derived(ordinal ? ordinalStart : settings.timelineStart)
  const effectiveEnd = $derived(ordinal ? ordinalEnd : settings.timelineEnd)
  const defaultTitle = $derived(ordinal ? 'Ordinal range [indices]' : 'Time range [ms]')
  const effectiveTitle = $derived(title ?? defaultTitle)

  const rangeSummary = $derived(
    (!effectiveStart && !effectiveEnd) || (effectiveStart === 0 && effectiveEnd === 0)
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
      value={effectiveStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={handleStartChange}
    />
    <InputNumber
      id={endId}
      label="End (0 = Auto)"
      value={effectiveEnd}
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
