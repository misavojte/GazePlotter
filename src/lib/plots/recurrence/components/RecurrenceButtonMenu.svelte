<script lang="ts">
  import {
    PlotMenuButton,
    createPlotMenuErrorContext,
    createStimulusCustomizationMenuAction,
  } from '$lib/plots/shared'
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(
    untrack(() => item),
    'modal'
  )

  let items = $derived([
    createStimulusCustomizationMenuAction({
      openModal,
      source,
      errorContext,
    }),
  ])
</script>

<PlotMenuButton {items} />
