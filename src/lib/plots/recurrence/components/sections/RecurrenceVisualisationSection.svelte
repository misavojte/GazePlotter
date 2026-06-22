<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { Radio } from '$lib/shared/components'
  import { createBulkContext } from '$lib/plots/shared/components/sections'
  import { RECURRENCE_HIGHLIGHTS, RECURRENCE_MASKINGS } from '../../const'
  import type {
    RecurrencePlotItem,
    RecurrencePlotSettings,
    RecurrenceHighlight,
    RecurrenceMasking,
  } from '../../types'

  let { item }: { item: RecurrencePlotItem } = $props()
  const bulk = createBulkContext<RecurrencePlotSettings>(() => item)

  const highlight = $derived(bulk.common(s => s.highlight))
  const masking = $derived(bulk.common(s => s.masking))

  const visSummary = $derived.by(() => {
    if (highlight.mixed || masking.mixed) return 'Mixed'
    const hl = highlight.value
    const mask = masking.value

    const hlLabel = hl === 'none'
      ? ''
      : hl === 'diagonal'
        ? 'Diagonal'
        : hl === 'horizontal'
          ? 'Horizontal'
          : 'Vertical'

    const maskLabel = mask === 'none'
      ? ''
      : mask === 'diagonal'
        ? 'No main diag.'
        : 'Upper'

    if (!hlLabel && !maskLabel) return 'Standard'
    if (hlLabel && maskLabel) return `${hlLabel} (${maskLabel})`
    return hlLabel || maskLabel
  })
</script>

<PaneSection title="Visualisation" summary={visSummary}>
  <Radio
    legend="Highlight"
    options={[...RECURRENCE_HIGHLIGHTS]}
    appearance="compact"
    value={highlight.value}
    mixed={highlight.mixed}
    onchange={e =>
      bulk.update({ highlight: (e as CustomEvent<string>).detail as RecurrenceHighlight })}
  />
  <Radio
    legend="Masking"
    options={[...RECURRENCE_MASKINGS]}
    appearance="compact"
    value={masking.value}
    mixed={masking.mixed}
    onchange={e =>
      bulk.update({ masking: (e as CustomEvent<string>).detail as RecurrenceMasking })}
  />
</PaneSection>
