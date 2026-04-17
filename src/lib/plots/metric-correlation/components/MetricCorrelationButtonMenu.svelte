<script lang="ts">
  import {
    PlotMenuButton,
    createAoiCustomizationMenuAction,
    createParticipantsGroupsMenuAction,
    createPlotMenuErrorContext,
    createPlotMenuDivider,
    createPlotModalAction,
    createStimulusCustomizationMenuAction,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import Download from 'lucide-svelte/icons/download'
  import { downloadPlotModal } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'
  import type { MetricCorrelationItem } from '../types'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  let items = $derived([
    createAoiCustomizationMenuAction({
      openModal,
      source,
      stimulusId: settings.stimulusId,
      errorContext,
    }),
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
