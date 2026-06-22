<script lang="ts">
  import { TimelineRangeSection } from '$lib/plots/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import type { ScarfPlotItem, ScarfPlotSettings } from '../../types'

  // Scarf's range section is dual-mode: in 'ordinal' timeline mode it edits
  // ordinal indices (ordinalStart/End) rather than ms (timelineStart/End). The
  // canonical TimelineRangeSection handles ms itself (incl. divergence); we
  // supply the ordinal wiring. Ordinal mode shows the representative's bounds.
  let { item }: { item: ScarfPlotItem } = $props()
  const settings = $derived(item.settings)
  const bulk = createBulkContext<ScarfPlotSettings>(() => item)

  const isOrdinal = $derived(settings.timeline === 'ordinal')
  const rangeTitle = $derived(
    isOrdinal ? 'Ordinal range [indices]' : 'Time range [ms]'
  )

  function handleOrdinalChange(
    boundary: 'start' | 'end',
    value: number | undefined
  ) {
    const patch: Partial<ScarfPlotSettings> =
      boundary === 'start' ? { ordinalStart: value } : { ordinalEnd: value }
    bulk.update(patch)
  }
</script>

<TimelineRangeSection
  {item}
  title={rangeTitle}
  ordinal={isOrdinal}
  ordinalStart={settings.ordinalStart}
  ordinalEnd={settings.ordinalEnd}
  onOrdinalChange={handleOrdinalChange}
/>
