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
  import type { BarPlotItem } from '$lib/plots/bar/types'
  import Download from 'lucide-svelte/icons/download'
  import {
    downloadBarPlotModal,
    exportAggregatedDataModal,
  } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: BarPlotItem
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
      definition: exportAggregatedDataModal,
      props: {
        item,
      },
      icon: Download,
      errorContext,
    }),
    createPlotModalAction({
      openModal,
      definition: downloadBarPlotModal,
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

