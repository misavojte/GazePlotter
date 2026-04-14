<script lang="ts">
  import {
    PlotMenuButton,
    createParticipantsGroupsMenuAction,
    createPlotMenuErrorContext,
    createPlotMenuDivider,
    createPlotModalAction,
    createStimulusCustomizationMenuAction,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import type { EvolvingMetricsItem } from '$lib/plots/evolving-metrics/types'
  import Download from 'lucide-svelte/icons/download'

  import { downloadPlotModal } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: EvolvingMetricsItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  let items = $derived([
    createStimulusCustomizationMenuAction({
      openModal,
      source,
      errorContext,
    }),
    createParticipantsGroupsMenuAction({
      openModal,
      source,
      errorContext,
    }),
    createPlotMenuDivider(),
    createPlotModalAction({
      openModal,
      definition: downloadPlotModal,
      props: {
        item,
      },
      label: 'Download plot',
      icon: Download,
      errorContext,
    }),
  ])
</script>

<PlotMenuButton {items} />
