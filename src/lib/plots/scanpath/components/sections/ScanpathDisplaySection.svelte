<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck } from '$lib/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import type { ScanpathPlotItem, ScanpathPlotSettings } from '../../types'

  let { item }: { item: ScanpathPlotItem } = $props()
  const bulk = createBulkContext<ScanpathPlotSettings>(() => item)

  const showFixationOrder = $derived(bulk.common(s => s.showFixationOrder))
  const showNumbers = $derived(bulk.common(s => s.showNumbers))

  const displaySummary = $derived.by(() => {
    if (showFixationOrder.mixed || showNumbers.mixed) return 'Mixed'
    const parts: string[] = []
    if (showFixationOrder.value) parts.push('Order line')
    if (showNumbers.value) parts.push('Numbers')
    return parts.length === 0 ? 'None' : parts.join(', ')
  })
</script>

<PaneSection title="Display" summary={displaySummary}>
  <InputCheck
    label="Show fixation order line"
    appearance="compact"
    size="xs"
    checked={showFixationOrder.value}
    mixed={showFixationOrder.mixed}
    onchange={e =>
      bulk.update({ showFixationOrder: (e as CustomEvent<boolean>).detail })}
  />
  <InputCheck
    label="Show fixation numbers"
    appearance="compact"
    size="xs"
    checked={showNumbers.value}
    mixed={showNumbers.mixed}
    onchange={e => bulk.update({ showNumbers: (e as CustomEvent<boolean>).detail })}
  />
</PaneSection>
